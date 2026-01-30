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

    const runningSyncs = await base44.asServiceRole.entities.SyncJob.filter({
      square_connection_id: connection_id,
      status: 'running'
    });

    if (runningSyncs.length > 0) {
      return Response.json({ success: false, error: 'A sync is already in progress' }, { status: 409 });
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
            console.log('Rate limited. Waiting ' + retryAfter + 's...');
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

    async function base44Retry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
      let lastError: Error = new Error('Max retries exceeded');
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error as Error;
          const errorObj = error as { status?: number };
          if (errorObj.status === 429) {
            const waitTime = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
            console.log('Base44 rate limited. Waiting ' + waitTime + 'ms...');
            await delay(waitTime);
            if (attempt === maxRetries) throw error;
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
        existingLocationMap.set(loc.square_location_id, loc);
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
          await delay(100);
        } catch (err) {
          const error = err as Error;
          console.error('Location sync error:', error.message);
          errors.push({ entity_type: 'locations', square_id: sqLocation.id, error_message: error.message });
        }
      }
      console.log('Locations synced');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to sync locations:', error);
      errors.push({ entity_type: 'locations', error_message: error.message });
    }

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
        existingEmployeeMap.set(emp.square_team_member_id, emp);
      }

      for (const member of teamMembers) {
        const existing = existingEmployeeMap.get(member.id);
        const fullName = ((member.given_name || '') + ' ' + (member.family_name || '')).trim() || 'Unknown';
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
          await delay(100);
        } catch (err) {
          const error = err as Error;
          console.error('Team member sync error:', error.message);
          errors.push({ entity_type: 'team_members', square_id: member.id, error_message: error.message });
        }
      }
      console.log('Team members synced');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to sync team members:', error);
      errors.push({ entity_type: 'team_members', error_message: error.message });
    }

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
        if (p.organization_id === connection.organization_id) {
          existingPaymentMap.set(p.square_payment_id, p);
        }
      }
      console.log('Found ' + existingPaymentMap.size + ' existing payment records');

      interface PaymentItem {
        payment: Record<string, unknown>;
        location: typeof locations[0];
      }
      const paymentsToProcess: PaymentItem[] = [];

      for (const location of locations) {
        console.log('Fetching payments for: ' + location.name);
        let cursor: string | null = null;
        let hasMore = true;

        while (hasMore) {
          let url = baseUrl + '/payments?location_id=' + location.square_location_id + 
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
            throw new Error('Failed to fetch payments: ' + paymentsRes.status);
          }

          const paymentsData = await paymentsRes.json();
          const payments = paymentsData.payments || [];

          for (const payment of payments) {
            if (payment.status === 'COMPLETED') {
              paymentsToProcess.push({ payment, location });
            }
          }

          cursor = paymentsData.cursor || null;
          hasMore = cursor !== null;
        }
      }

      console.log('Processing ' + paymentsToProcess.length + ' payments...');

      const BATCH_SIZE = 10;
      const BATCH_DELAY = 1500;
      const totalBatches = Math.ceil(paymentsToProcess.length / BATCH_SIZE);

      for (let i = 0; i < paymentsToProcess.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.log('Processing batch ' + batchNum + '/' + totalBatches);

        const batch = paymentsToProcess.slice(i, i + BATCH_SIZE);

        for (const item of batch) {
          const payment = item.payment as Record<string, unknown>;
          const location = item.location;

          try {
            const amountMoney = payment.amount_money as { amount?: number } | undefined;
            const tipMoney = payment.tip_money as { amount?: number; currency?: string } | undefined;
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

            const summaryData = {
              organization_id: connection.organization_id,
              location_id: location.id,
              square_payment_id: payment.id as string,
              square_order_id: (payment.order_id as string) || null,
              payment_created_at: payment.created_at as string,
              gross_amount_pence: grossAmount,
              tip_amount_pence: tipAmount,
              total_amount_pence: totalAmount,
              processing_fee_pence: processingFee,
              net_amount_pence: netAmount,
              team_member_id: (payment.team_member_id as string) || null,
              card_brand: cardDetails?.card?.card_brand || (cashDetails ? 'CASH' : null),
              source: source,
              synced_at: new Date().toISOString()
            };

            const existing = existingPaymentMap.get(payment.id as string);

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
          } catch (err) {
            const error = err as Error;
            console.error('Payment sync error:', error.message);
            errors.push({ entity_type: 'payments', square_id: payment.id as string, error_message: error.message });
            totalSkipped++;
          }
        }

        if (i + BATCH_SIZE < paymentsToProcess.length) {
          await delay(BATCH_DELAY);
        }
      }

      console.log('Payments synced: ' + totalCreated + ' created, ' + totalUpdated + ' updated');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to sync payments:', error);
      errors.push({ entity_type: 'payments', error_message: error.message });
    }

    // 4. FINALIZE
    console.log('[4/4] Finalizing sync...');
    
    await base44Retry(function() {
      return base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
        completed_at: new Date().toISOString(),
        status: errors.length > 0 ? 'partial' : 'completed',
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