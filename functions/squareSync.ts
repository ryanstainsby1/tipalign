import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, triggered_by = 'manual' } = body;

    console.log('=== Square sync started ===', { connection_id, triggered_by, timestamp: new Date().toISOString() });

    if (!connection_id) {
      return Response.json({ success: false, error: 'connection_id is required' }, { status: 400 });
    }

    const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
    if (connections.length === 0) {
      return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];
    if (connection.connection_status !== 'connected') {
      return Response.json({ success: false, error: 'Connection is not active' }, { status: 400 });
    }

    // Check for stuck running syncs and clean them up
    const runningSyncs = await base44.asServiceRole.entities.SyncJob.filter({
      square_connection_id: connection_id,
      status: 'running'
    });

    // Clean up any stuck syncs older than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    for (const stuckSync of runningSyncs) {
      if (stuckSync.started_at < tenMinutesAgo) {
        console.log('Cleaning up stuck sync job: ' + stuckSync.id);
        await base44.asServiceRole.entities.SyncJob.update(stuckSync.id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [{ entity_type: 'sync', error_message: 'Sync timed out and was cleaned up' }]
        });
      } else {
        // Recent sync still running
        return Response.json({ success: false, error: 'A sync is already in progress. Please wait.' }, { status: 409 });
      }
    }

    const syncJob = await base44.asServiceRole.entities.SyncJob.create({
      organization_id: connection.organization_id,
      square_connection_id: connection_id,
      sync_type: triggered_by === 'initial_setup' ? 'full' : 'incremental',
      entities_synced: ['locations', 'team_members', 'payments'],
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by
    });

    const accessToken = connection.square_access_token_encrypted;
    const environment = Deno.env.get('SQUARE_ENVIRONMENT')?.toLowerCase() || 'production';
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com/v2'
      : 'https://connect.squareupsandbox.com/v2';

    const squareHeaders = {
      'Authorization': 'Bearer ' + accessToken,
      'Square-Version': '2024-12-18',
      'Content-Type': 'application/json'
    };

    function delay(ms: number): Promise<void> {
      return new Promise(function(resolve) {
        setTimeout(resolve, ms);
      });
    }

    async function retryFetch(url: string, options: RequestInit, maxRetries: number = 3): Promise<Response> {
      let lastError: Error = new Error('Max retries exceeded');
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(url, options);
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
            console.log('Square rate limited. Waiting ' + retryAfter + 's...');
            await delay(retryAfter * 1000);
            continue;
          }
          return response;
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxRetries) {
            await delay(1000 * Math.pow(2, attempt - 1));
          }
        }
      }
      throw lastError;
    }

    async function base44Retry<T>(operation: () => Promise<T>, maxRetries: number = 5): Promise<T> {
      let lastError: Error = new Error('Max retries exceeded');
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;
          const errorObj = error as { status?: number };
          if (errorObj.status === 429) {
            const waitTime = Math.min(3000 * Math.pow(2, attempt - 1), 60000);
            console.log('Base44 rate limited (attempt ' + attempt + '). Waiting ' + waitTime + 'ms...');
            await delay(waitTime);
          } else {
            throw error;
          }
        }
      }
      throw lastError;
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const errors: Array<{ entity_type: string; square_id?: string; error_message: string }> = [];

    // 1. SYNC LOCATIONS
    try {
      console.log('[1/4] Syncing locations...');
      const locationsRes = await retryFetch(baseUrl + '/locations', { method: 'GET', headers: squareHeaders });
      
      if (!locationsRes.ok) {
        const errorText = await locationsRes.text();
        throw new Error('Failed to fetch locations: ' + locationsRes.status + ' ' + errorText);
      }

      const locationsData = await locationsRes.json();
      const squareLocations = locationsData.locations || [];

      const existingLocations = await base44Retry(function() {
        return base44.asServiceRole.entities.Location.filter({ organization_id: connection.organization_id });
      });
      
      const existingLocationMap = new Map<string, typeof existingLocations[0]>();
      for (const loc of existingLocations) {
        if (loc.square_location_id) {
          existingLocationMap.set(loc.square_location_id, loc);
        }
      }

      for (const sqLocation of squareLocations) {
        const existing = existingLocationMap.get(sqLocation.id);
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
          first_synced_at: existing ? existing.first_synced_at : new Date().toISOString()
        };

        try {
          if (existing) {
            await base44Retry(function() {
              return base44.asServiceRole.entities.Location.update(existing.id, locationData);
            });
            totalUpdated++;
          } else {
            await base44Retry(function() {
              return base44.asServiceRole.entities.Location.create(locationData);
            });
            totalCreated++;
          }
          await delay(150);
        } catch (err) {
          const error = err as Error;
          console.error('Location sync error:', error.message);
          errors.push({ entity_type: 'locations', square_id: sqLocation.id, error_message: error.message });
        }
      }
      console.log('Locations synced: ' + existingLocationMap.size + ' existing, ' + squareLocations.length + ' from Square');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to sync locations:', error);
      errors.push({ entity_type: 'locations', error_message: error.message });
    }

    await delay(500);

    // 2. SYNC TEAM MEMBERS
    try {
      console.log('[2/4] Syncing team members...');
      const teamRes = await retryFetch(baseUrl + '/team-members/search', {
        method: 'POST',
        headers: squareHeaders,
        body: JSON.stringify({ query: { filter: { status: 'ACTIVE' } } })
      });

      if (!teamRes.ok) {
        const errorText = await teamRes.text();
        throw new Error('Failed to fetch team members: ' + teamRes.status + ' ' + errorText);
      }

      const teamData = await teamRes.json();
      const teamMembers = teamData.team_members || [];

      const existingEmployees = await base44Retry(function() {
        return base44.asServiceRole.entities.Employee.filter({ organization_id: connection.organization_id });
      });
      
      const existingEmployeeMap = new Map<string, typeof existingEmployees[0]>();
      for (const emp of existingEmployees) {
        if (emp.square_team_member_id) {
          existingEmployeeMap.set(emp.square_team_member_id, emp);
        }
      }

      for (const member of teamMembers) {
        const existing = existingEmployeeMap.get(member.id);
        const givenName = member.given_name || '';
        const familyName = member.family_name || '';
        const fullName = (givenName + ' ' + familyName).trim() || 'Unknown';
        
        const employeeData = {
          organization_id: connection.organization_id,
          square_team_member_id: member.id,
          full_name: fullName,
          email: member.email_address || '',
          phone: member.phone_number || '',
          employment_status: member.status === 'ACTIVE' ? 'active' : 'terminated',
          role: 'server'
        };

        try {
          if (existing) {
            await base44Retry(function() {
              return base44.asServiceRole.entities.Employee.update(existing.id, employeeData);
            });
            totalUpdated++;
          } else {
            await base44Retry(function() {
              return base44.asServiceRole.entities.Employee.create(employeeData);
            });
            totalCreated++;
          }
          await delay(150);
        } catch (err) {
          const error = err as Error;
          console.error('Team member sync error:', error.message);
          errors.push({ entity_type: 'team_members', square_id: member.id, error_message: error.message });
        }
      }
      console.log('Team members synced: ' + teamMembers.length + ' from Square');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to sync team members:', error);
      errors.push({ entity_type: 'team_members', error_message: error.message });
    }

    await delay(500);

    // 3. SYNC PAYMENTS
    try {
      console.log('[3/4] Syncing payments...');
      const beginTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const locations = await base44Retry(function() {
        return base44.asServiceRole.entities.Location.filter({ organization_id: connection.organization_id });
      });

      console.log('Pre-fetching existing payment records...');
      const existingPayments = await base44Retry(function() {
        return base44.asServiceRole.entities.SquarePaymentSummary.list('-payment_created_at', 5000);
      });
      
      const existingPaymentMap = new Map<string, typeof existingPayments[0]>();
      for (const p of existingPayments) {
        if (p.organization_id === connection.organization_id && p.square_payment_id) {
          existingPaymentMap.set(p.square_payment_id, p);
        }
      }
      console.log('Found ' + existingPaymentMap.size + ' existing payment records');

      interface PaymentToProcess {
        payment: Record<string, unknown>;
        location: typeof locations[0];
      }
      const paymentsToProcess: PaymentToProcess[] = [];

      for (const location of locations) {
        if (!location.square_location_id) continue;
        
        console.log('Fetching payments for: ' + location.name);
        let cursor: string | null = null;
        let hasMore = true;
        let pageCount = 0;

        while (hasMore && pageCount < 20) {
          pageCount++;
          let url = baseUrl + '/payments?location_id=' + encodeURIComponent(location.square_location_id) + 
            '&begin_time=' + encodeURIComponent(beginTime) + 
            '&end_time=' + encodeURIComponent(endTime) + 
            '&limit=100';
          
          if (cursor) {
            url = url + '&cursor=' + encodeURIComponent(cursor);
          }

          const paymentsRes = await retryFetch(url, {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer ' + accessToken,
              'Square-Version': '2024-12-18'
            }
          });

          if (!paymentsRes.ok) {
            const errorText = await paymentsRes.text();
            console.error('Payments error for ' + location.name + ':', paymentsRes.status, errorText);
            break;
          }

          const paymentsData = await paymentsRes.json();
          const payments = paymentsData.payments || [];

          for (const payment of payments) {
            if (payment.status === 'COMPLETED') {
              paymentsToProcess.push({ payment: payment, location: location });
            }
          }

          cursor = paymentsData.cursor || null;
          hasMore = cursor !== null;
          
          if (hasMore) {
            await delay(200);
          }
        }
      }

      console.log('Processing ' + paymentsToProcess.length + ' payments...');

      const BATCH_SIZE = 5;
      const BATCH_DELAY = 2000;
      const totalBatches = Math.ceil(paymentsToProcess.length / BATCH_SIZE);

      for (let i = 0; i < paymentsToProcess.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.log('Processing batch ' + batchNum + '/' + totalBatches);

        const batch = paymentsToProcess.slice(i, i + BATCH_SIZE);

        for (const item of batch) {
          const payment = item.payment;
          const location = item.location;
          const paymentId = payment.id as string;

          try {
            const amountMoney = payment.amount_money as { amount?: number } | undefined;
            const tipMoney = payment.tip_money as { amount?: number } | undefined;
            const totalMoney = payment.total_money as { amount?: number } | undefined;
            const processingFeeArr = payment.processing_fee as Array<{ amount_money?: { amount?: number } }> | undefined;
            const cardDetails = payment.card_details as { card?: { card_brand?: string } } | undefined;
            const cashDetails = payment.cash_details as Record<string, unknown> | undefined;

            const grossAmount = amountMoney?.amount || 0;
            const tipAmount = tipMoney?.amount || 0;
            const totalAmount = totalMoney?.amount || (grossAmount + tipAmount);
            
            let processingFee = 0;
            if (processingFeeArr && Array.isArray(processingFeeArr)) {
              for (const fee of processingFeeArr) {
                processingFee += fee.amount_money?.amount || 0;
              }
            }
            const netAmount = totalAmount - processingFee;

            let source = 'pos';
            const sourceType = payment.source_type as string | undefined;
            if (sourceType === 'WALLET') {
              source = 'wallet_pass';
            } else if (sourceType === 'TERMINAL') {
              source = 'terminal';
            } else if (sourceType === 'CASH') {
              source = 'cash';
            }

            const cardBrand = cardDetails?.card?.card_brand || (cashDetails ? 'CASH' : null);

            const summaryData = {
              organization_id: connection.organization_id,
              location_id: location.id,
              square_payment_id: paymentId,
              square_order_id: (payment.order_id as string) || null,
              payment_created_at: payment.created_at as string,
              gross_amount_pence: grossAmount,
              tip_amount_pence: tipAmount,
              total_amount_pence: totalAmount,
              processing_fee_pence: processingFee,
              net_amount_pence: netAmount,
              team_member_id: (payment.team_member_id as string) || null,
              card_brand: cardBrand,
              source: source,
              synced_at: new Date().toISOString()
            };

            const existing = existingPaymentMap.get(paymentId);

            if (existing) {
              await base44Retry(function() {
                return base44.asServiceRole.entities.SquarePaymentSummary.update(existing.id, summaryData);
              });
              totalUpdated++;
            } else {
              await base44Retry(function() {
                return base44.asServiceRole.entities.SquarePaymentSummary.create(summaryData);
              });
              totalCreated++;
            }
            
            await delay(200);
          } catch (err) {
            const error = err as Error;
            console.error('Payment sync error:', error.message);
            errors.push({ entity_type: 'payments', square_id: paymentId, error_message: error.message });
            totalSkipped++;
          }
        }

        if (i + BATCH_SIZE < paymentsToProcess.length) {
          await delay(BATCH_DELAY);
        }
      }

      console.log('Payments synced: ' + totalCreated + ' created, ' + totalUpdated + ' updated, ' + totalSkipped + ' skipped');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to sync payments:', error);
      errors.push({ entity_type: 'payments', error_message: error.message });
    }

    // 4. FINALIZE
    console.log('[4/4] Finalizing sync...');
    
    const finalStatus = errors.length > 0 ? 'partial' : 'completed';
    
    await base44Retry(function() {
      return base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
        completed_at: new Date().toISOString(),
        status: finalStatus,
        records_created: totalCreated,
        records_updated: totalUpdated,
        records_skipped: totalSkipped,
        errors: errors.length > 0 ? errors : null
      });
    });

    await base44Retry(function() {
      return base44.asServiceRole.entities.SquareConnection.update(connection.id, {
        last_sync_at: new Date().toISOString()
      });
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
      records: { created: totalCreated, updated: totalUpdated, skipped: totalSkipped },
      errors: errors.length > 0 ? errors : [],
      duration_ms: duration
    });

  } catch (error) {
    const err = error as Error;
    console.error('Square sync error:', err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
});