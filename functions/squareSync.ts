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
      entities_synced: ['locations', 'team_members', 'payments', 'payment_summaries', 'daily_summaries'],
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
          console.log(`Attempt ${attempt}/${maxRetries} for ${url.split('?')[0]}`);
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
      payments: { created: 0, updated: 0, skipped: 0 }
    };

    // 1. Sync Locations
    try {
      console.log('[1/4] Syncing locations...');
      const locationsRes = await retryFetch(`${baseUrl}/locations`, { 
        method: 'GET',
        headers 
      });
      
      if (!locationsRes.ok) {
        const errorText = await locationsRes.text();
        throw new Error(`Failed to fetch locations: ${locationsRes.status} ${locationsRes.statusText} - ${errorText}`);
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
      console.log('[2/4] Syncing team members...');
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
        const errorText = await teamRes.text();
        throw new Error(`Failed to fetch team members: ${teamRes.status} ${teamRes.statusText} - ${errorText}`);
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

    // 3. Sync Payments (last 30 days) - FIXED: Using GET with query params
    try {
      console.log('[3/4] Syncing payments...');
      const beginTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      // Get all locations for this org
      const locations = await base44.asServiceRole.entities.Location.filter({
        organization_id: connection.organization_id
      });

      for (const location of locations) {
        console.log(`Fetching payments for location: ${location.name}`);
        let cursor = null;
        let hasMore = true;
        let locationPaymentCount = 0;

        while (hasMore) {
          // Build query parameters - Square List Payments uses GET
          const params = new URLSearchParams({
            location_id: location.square_location_id,
            begin_time: beginTime,
            end_time: endTime,
            limit: '100'
          });
          if (cursor) {
            params.set('cursor', cursor);
          }

          const paymentsUrl = `${baseUrl}/payments?${params.toString()}`;
          
          const paymentsRes = await retryFetch(paymentsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Square-Version': '2024-12-18'
            }
          });

          if (!paymentsRes.ok) {
            const errorText = await paymentsRes.text();
            console.error(`Payments API error for ${location.name}:`, paymentsRes.status, errorText);
            throw new Error(`Failed to fetch payments for location ${location.name}: ${paymentsRes.status} - ${errorText}`);
          }

          const paymentsData = await paymentsRes.json();
          const payments = paymentsData.payments || [];
          
          console.log(`  - Fetched ${payments.length} payments for ${location.name}`);

          for (const payment of payments) {
            try {
              // Only process COMPLETED payments
              if (payment.status !== 'COMPLETED') continue;

              const grossAmount = payment.amount_money?.amount || 0;
              const tipAmount = payment.tip_money?.amount || 0;
              const totalAmount = payment.total_money?.amount || (grossAmount + tipAmount);
              
              // Calculate processing fees
              let processingFee = 0;
              if (payment.processing_fee && Array.isArray(payment.processing_fee)) {
                processingFee = payment.processing_fee.reduce((sum, fee) => {
                  return sum + (fee.amount_money?.amount || 0);
                }, 0);
              }
              const netAmount = totalAmount - processingFee;

              // Determine source
              let source = 'pos';
              if (payment.source_type === 'CARD' && payment.card_details?.entry_method === 'ON_FILE') {
                source = 'online';
              } else if (payment.source_type === 'WALLET') {
                source = 'wallet_pass';
              } else if (payment.source_type === 'TERMINAL') {
                source = 'terminal';
              } else if (payment.source_type === 'CASH') {
                source = 'cash';
              }

              // Store in SquarePaymentSummary
              const existing = await base44.asServiceRole.entities.SquarePaymentSummary.filter({
                organization_id: connection.organization_id,
                square_payment_id: payment.id
              });

              const summaryData = {
                organization_id: connection.organization_id,
                location_id: location.id,
                square_payment_id: payment.id,
                square_order_id: payment.order_id || null,
                payment_created_at: payment.created_at,
                gross_amount_pence: grossAmount,
                tip_amount_pence: tipAmount,
                total_amount_pence: totalAmount,
                processing_fee_pence: processingFee,
                net_amount_pence: netAmount,
                team_member_id: payment.team_member_id || null,
                card_brand: payment.card_details?.card?.card_brand || (payment.cash_details ? 'CASH' : null),
                source,
                synced_at: new Date().toISOString()
              };

              if (existing.length > 0) {
                await base44.asServiceRole.entities.SquarePaymentSummary.update(existing[0].id, summaryData);
                entityCounts.payments.updated++;
                totalUpdated++;
              } else {
                await base44.asServiceRole.entities.SquarePaymentSummary.create(summaryData);
                entityCounts.payments.created++;
                totalCreated++;
              }
              
              locationPaymentCount++;

              // Also sync to legacy Payment table if tip exists
              if (tipAmount > 0) {
                const legacyExisting = await base44.asServiceRole.entities.Payment.filter({
                  organization_id: connection.organization_id,
                  square_payment_id: payment.id
                });

                const paymentData = {
                  organization_id: connection.organization_id,
                  square_payment_id: payment.id,
                  square_location_id: location.square_location_id,
                  location_id: location.id,
                  square_team_member_id: payment.team_member_id,
                  payment_date: payment.created_at,
                  total_amount: totalAmount,
                  tip_amount: tipAmount,
                  currency: payment.amount_money?.currency || 'GBP',
                  payment_source_type: payment.source_type || 'CARD',
                  card_brand: payment.card_details?.card?.card_brand || null,
                  status: 'completed'
                };

                if (legacyExisting.length > 0) {
                  await base44.asServiceRole.entities.Payment.update(legacyExisting[0].id, paymentData);
                } else {
                  await base44.asServiceRole.entities.Payment.create(paymentData);
                }
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

          cursor = paymentsData.cursor;
          hasMore = !!cursor;
        }
        
        console.log(`  - Total payments synced for ${location.name}: ${locationPaymentCount}`);
      }

      console.log(`Payments synced: ${entityCounts.payments.created} created, ${entityCounts.payments.updated} updated`);
    } catch (err) {
      console.error('Failed to sync payments:', err);
      errors.push({
        entity_type: 'payments',
        error_message: err.message
      });
    }

    // 4. Generate Daily Revenue Summaries
    try {
      console.log('[4/4] Computing daily revenue summaries...');
      
      const locations = await base44.asServiceRole.entities.Location.filter({
        organization_id: connection.organization_id
      });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let summariesCreated = 0;
      let summariesUpdated = 0;
      
      for (const location of locations) {
        // Get all payment summaries for this location
        const allPayments = await base44.asServiceRole.entities.SquarePaymentSummary.list('-payment_created_at', 5000);
        const payments = allPayments.filter(p => 
          p.organization_id === connection.organization_id && 
          p.location_id === location.id
        );

        console.log(`Processing ${payments.length} payments for daily summaries - ${location.name}`);

        // Group by business date
        const dailyData = {};
        
        for (const payment of payments) {
          const paymentDate = new Date(payment.payment_created_at);
          if (paymentDate < thirtyDaysAgo) continue;
          
          const businessDate = paymentDate.toISOString().split('T')[0];
          
          if (!dailyData[businessDate]) {
            dailyData[businessDate] = {
              gross: 0,
              tips: 0,
              net: 0,
              count: 0
            };
          }
          
          dailyData[businessDate].gross += payment.gross_amount_pence || 0;
          dailyData[businessDate].tips += payment.tip_amount_pence || 0;
          dailyData[businessDate].net += payment.net_amount_pence || 0;
          dailyData[businessDate].count += 1;
        }

        console.log(`Computed ${Object.keys(dailyData).length} daily summaries for ${location.name}`);

        // Upsert daily summaries
        for (const [businessDate, data] of Object.entries(dailyData)) {
          const avgTipPercent = data.gross > 0 
            ? Math.round((data.tips / data.gross) * 100 * 100) / 100 
            : 0;

          const existing = await base44.asServiceRole.entities.DailyRevenueSummary.filter({
            organization_id: connection.organization_id,
            location_id: location.id,
            business_date: businessDate
          });

          const summaryData = {
            organization_id: connection.organization_id,
            location_id: location.id,
            business_date: businessDate,
            total_gross_revenue_pence: data.gross,
            total_tip_pence: data.tips,
            total_net_revenue_pence: data.net,
            avg_tip_percent: avgTipPercent,
            transaction_count: data.count
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.DailyRevenueSummary.update(existing[0].id, summaryData);
            summariesUpdated++;
          } else {
            await base44.asServiceRole.entities.DailyRevenueSummary.create(summaryData);
            summariesCreated++;
          }
        }
      }

      console.log(`Daily revenue summaries: ${summariesCreated} created, ${summariesUpdated} updated`);
    } catch (err) {
      console.error('Failed to compute daily summaries:', err);
      errors.push({
        entity_type: 'daily_summaries',
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