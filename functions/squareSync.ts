import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, triggered_by = 'manual' } = body;

    console.log('=== Square sync started ===', { connection_id, triggered_by, timestamp: new Date().toISOString() });

    if (!connection_id) {
      return Response.json({ 
        success: false, 
        error: 'connection_id is required' 
      }, { status: 400 });
    }

    // Get connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      id: connection_id
    });

    if (connections.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Connection not found' 
      }, { status: 404 });
    }

    const connection = connections[0];

    if (connection.connection_status !== 'connected') {
      return Response.json({ 
        success: false, 
        error: 'Connection is not active' 
      }, { status: 400 });
    }

    // Check for existing running sync
    const runningSyncs = await base44.asServiceRole.entities.SyncJob.filter({
      square_connection_id: connection_id,
      status: 'running'
    });

    if (runningSyncs.length > 0) {
      return Response.json({ 
        success: false, 
        error: 'A sync is already in progress' 
      }, { status: 409 });
    }

    // Create sync job
    const syncJob = await base44.asServiceRole.entities.SyncJob.create({
      organization_id: connection.organization_id,
      square_connection_id: connection_id,
      sync_type: triggered_by === 'initial_setup' ? 'full' : 'incremental',
      entities_synced: ['locations', 'team_members', 'shifts', 'payments'],
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by
    });

    const accessToken = connection.square_access_token_encrypted;
    const environment = Deno.env.get('SQUARE_ENVIRONMENT')?.toLowerCase() || 'production';
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com/v2'
      : 'https://connect.squareupsandbox.com/v2';

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Square-Version': '2024-12-18',
      'Content-Type': 'application/json'
    };

    // Retry helper with exponential backoff
    const retryFetch = async (url, options, maxRetries = 3) => {
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt}/${maxRetries} for ${url}`);
          const response = await fetch(url, options);
          
          // Handle rate limiting
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
            console.log(`Rate limited. Waiting ${retryAfter}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
          
          return response;
        } catch (error) {
          lastError = error;
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.error(`Fetch error (attempt ${attempt}):`, error.message);
          if (attempt < maxRetries) {
            console.log(`Retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }
      throw lastError || new Error('Max retries exceeded');
    };

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const errors = [];
    const entityCounts = {
      locations: { created: 0, updated: 0, skipped: 0 },
      team_members: { created: 0, updated: 0, skipped: 0 },
      shifts: { created: 0, updated: 0, skipped: 0 },
      payments: { created: 0, updated: 0, skipped: 0 }
    };

    // 1. Sync Locations
    try {
      console.log('[1/3] Syncing locations...');
      const locationsRes = await retryFetch(`${baseUrl}/locations`, { headers });
      
      if (!locationsRes.ok) {
        throw new Error(`Failed to fetch locations: ${locationsRes.statusText}`);
      }

      const locationsData = await locationsRes.json();
      const squareLocations = locationsData.locations || [];

      for (const sqLocation of squareLocations) {
        try {
          const existing = await base44.asServiceRole.entities.Location.filter({
            organization_id: connection.organization_id,
            square_location_id: sqLocation.id
          });

          const locationData = {
            organization_id: connection.organization_id,
            square_location_id: sqLocation.id,
            name: sqLocation.name,
            address: sqLocation.address ? {
              line1: sqLocation.address.address_line_1 || '',
              line2: sqLocation.address.address_line_2 || '',
              city: sqLocation.address.locality || '',
              postcode: sqLocation.address.postal_code || '',
              country: sqLocation.address.country || 'GB'
            } : {},
            phone: sqLocation.phone_number || '',
            timezone: sqLocation.timezone || 'Europe/London',
            active: sqLocation.status === 'ACTIVE',
            currency: sqLocation.currency || 'GBP',
            first_synced_at: existing.length > 0 ? existing[0].first_synced_at : new Date().toISOString()
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Location.update(existing[0].id, locationData);
            entityCounts.locations.updated++;
            totalUpdated++;
          } else {
            await base44.asServiceRole.entities.Location.create(locationData);
            entityCounts.locations.created++;
            totalCreated++;
          }
        } catch (err) {
          console.error('Location sync error:', err);
          errors.push({
            entity_type: 'locations',
            square_id: sqLocation.id,
            error_message: err.message
          });
          entityCounts.locations.skipped++;
          totalSkipped++;
        }
      }
      console.log(`Locations synced: ${entityCounts.locations.created} created, ${entityCounts.locations.updated} updated`);
    } catch (err) {
      console.error('Failed to sync locations:', err);
      errors.push({
        entity_type: 'locations',
        error_message: err.message
      });
    }

    // 2. Sync Team Members
    try {
      console.log('[2/3] Syncing team members...');
      const teamRes = await retryFetch(`${baseUrl}/team-members/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: {
            filter: {
              status: 'ACTIVE'
            }
          }
        })
      });

      if (!teamRes.ok) {
        throw new Error(`Failed to fetch team members: ${teamRes.statusText}`);
      }

      const teamData = await teamRes.json();
      const teamMembers = teamData.team_members || [];

      for (const member of teamMembers) {
        try {
          const existing = await base44.asServiceRole.entities.Employee.filter({
            organization_id: connection.organization_id,
            square_team_member_id: member.id
          });

          const employeeData = {
            organization_id: connection.organization_id,
            square_team_member_id: member.id,
            full_name: `${member.given_name || ''} ${member.family_name || ''}`.trim() || 'Unknown',
            email: member.email_address || '',
            phone: member.phone_number || '',
            employment_status: member.status === 'ACTIVE' ? 'active' : 'terminated',
            role: 'server'
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Employee.update(existing[0].id, employeeData);
            entityCounts.team_members.updated++;
            totalUpdated++;
          } else {
            await base44.asServiceRole.entities.Employee.create(employeeData);
            entityCounts.team_members.created++;
            totalCreated++;
          }
        } catch (err) {
          console.error('Team member sync error:', err);
          errors.push({
            entity_type: 'team_members',
            square_id: member.id,
            error_message: err.message
          });
          entityCounts.team_members.skipped++;
          totalSkipped++;
        }
      }
      console.log(`Team members synced: ${entityCounts.team_members.created} created, ${entityCounts.team_members.updated} updated`);
    } catch (err) {
      console.error('Failed to sync team members:', err);
      errors.push({
        entity_type: 'team_members',
        error_message: err.message
      });
    }

    // 3. Sync Payments (last 7 days)
    try {
      console.log('[3/3] Syncing payments...');
      const beginTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const paymentsRes = await retryFetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          begin_time: beginTime,
          end_time: endTime,
          limit: 100
        })
      });

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        const payments = paymentsData.payments || [];

        for (const payment of payments) {
          try {
            const tipAmount = payment.tip_money?.amount || 0;
            if (tipAmount === 0) continue;

            const existing = await base44.asServiceRole.entities.Payment.filter({
              organization_id: connection.organization_id,
              square_payment_id: payment.id
            });

            const paymentData = {
              organization_id: connection.organization_id,
              square_payment_id: payment.id,
              square_location_id: payment.location_id,
              amount_money: payment.amount_money?.amount || 0,
              tip_money: tipAmount,
              currency: payment.amount_money?.currency || 'GBP',
              status: payment.status,
              created_at: payment.created_at,
              updated_at: payment.updated_at
            };

            if (existing.length > 0) {
              await base44.asServiceRole.entities.Payment.update(existing[0].id, paymentData);
              entityCounts.payments.updated++;
              totalUpdated++;
            } else {
              await base44.asServiceRole.entities.Payment.create(paymentData);
              entityCounts.payments.created++;
              totalCreated++;
            }
          } catch (err) {
            console.error('Payment sync error:', err);
            errors.push({
              entity_type: 'payments',
              square_id: payment.id,
              error_message: err.message
            });
            entityCounts.payments.skipped++;
            totalSkipped++;
          }
        }
        console.log(`Payments synced: ${entityCounts.payments.created} created, ${entityCounts.payments.updated} updated`);
      }
    } catch (err) {
      console.error('Failed to sync payments:', err);
      errors.push({
        entity_type: 'payments',
        error_message: err.message
      });
    }

    // Update sync job
    await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
      completed_at: new Date().toISOString(),
      status: errors.length > 0 ? 'partial' : 'completed',
      records_created: totalCreated,
      records_updated: totalUpdated,
      records_skipped: totalSkipped,
      errors: errors.length > 0 ? errors : null
    });

    // Update connection
    await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
      last_sync_at: new Date().toISOString()
    });

    const duration = Date.now() - startTime;
    
    console.log('=== Sync completed ===', {
      created: totalCreated,
      updated: totalUpdated,
      skipped: totalSkipped,
      errors: errors.length,
      duration_ms: duration
    });

    // Alert if sync took too long
    if (duration > 5 * 60 * 1000) {
      console.warn(`⚠️ Sync took ${Math.round(duration / 1000)}s (exceeded 5 minute threshold)`);
    }

    return Response.json({
      success: errors.length === 0,
      sync_job_id: syncJob.id,
      records: {
        created: totalCreated,
        updated: totalUpdated,
        skipped: totalSkipped
      },
      entity_counts: entityCounts,
      errors: errors.length > 0 ? errors : [],
      duration_ms: duration,
      performance: duration > 300000 ? 'slow' : duration > 60000 ? 'normal' : 'fast'
    });

  } catch (error) {
    console.error('Square sync error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});