import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req: Request): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, triggered_by = 'manual' } = body;

    console.log('=== Square sync started ===');

    if (!connection_id) {
      return Response.json({ success: false, error: 'connection_id is required' }, { status: 400 });
    }

    // Helper function for delays
    function wait(ms: number): Promise<void> {
      return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
    await wait(300);
    
    if (connections.length === 0) {
      return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];
    if (connection.connection_status !== 'connected') {
      return Response.json({ success: false, error: 'Connection is not active' }, { status: 400 });
    }

    // Clean up stuck syncs
    const runningSyncs = await base44.asServiceRole.entities.SyncJob.filter({
      square_connection_id: connection_id,
      status: 'running'
    });
    await wait(300);

    for (const stuckSync of runningSyncs) {
      await base44.asServiceRole.entities.SyncJob.update(stuckSync.id, {
        status: 'failed',
        completed_at: new Date().toISOString()
      });
      await wait(300);
    }

    const syncJob = await base44.asServiceRole.entities.SyncJob.create({
      organization_id: connection.organization_id,
      square_connection_id: connection_id,
      sync_type: 'incremental',
      entities_synced: ['locations', 'team_members', 'payments'],
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by
    });
    await wait(300);

    const accessToken = connection.square_access_token_encrypted;
    const baseUrl = 'https://connect.squareup.com/v2';

    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: Array<{ entity_type: string; error_message: string }> = [];

    // 1. SYNC LOCATIONS
    try {
      console.log('[1/3] Syncing locations...');
      const locRes = await fetch(baseUrl + '/locations', {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
      });

      if (locRes.ok) {
        const locData = await locRes.json();
        const squareLocations = locData.locations || [];
        
        const existingLocs = await base44.asServiceRole.entities.Location.filter({ 
          organization_id: connection.organization_id 
        });
        await wait(300);
        
        const locMap = new Map(existingLocs.map(function(l) { return [l.square_location_id, l]; }));

        for (const sq of squareLocations) {
          const existing = locMap.get(sq.id);
          const data = {
            organization_id: connection.organization_id,
            square_location_id: sq.id,
            name: sq.name,
            active: sq.status === 'ACTIVE',
            currency: sq.currency || 'GBP',
            timezone: sq.timezone || 'Europe/London'
          };

          if (existing) {
            await base44.asServiceRole.entities.Location.update(existing.id, data);
            totalUpdated++;
          } else {
            await base44.asServiceRole.entities.Location.create(data);
            totalCreated++;
          }
          await wait(400);
        }
        console.log('Locations done: ' + squareLocations.length);
      }
    } catch (err) {
      console.error('Location error:', (err as Error).message);
      errors.push({ entity_type: 'locations', error_message: (err as Error).message });
    }

    // 2. SYNC TEAM MEMBERS
    try {
      console.log('[2/3] Syncing team members...');
      const teamRes = await fetch(baseUrl + '/team-members/search', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer ' + accessToken, 
          'Square-Version': '2024-12-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: { filter: { status: 'ACTIVE' } } })
      });

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        const members = teamData.team_members || [];

        const existingEmps = await base44.asServiceRole.entities.Employee.filter({ 
          organization_id: connection.organization_id 
        });
        await wait(300);
        
        const empMap = new Map(existingEmps.map(function(e) { return [e.square_team_member_id, e]; }));

        for (const m of members) {
          const existing = empMap.get(m.id);
          const name = ((m.given_name || '') + ' ' + (m.family_name || '')).trim() || 'Unknown';
          const data = {
            organization_id: connection.organization_id,
            square_team_member_id: m.id,
            full_name: name,
            email: m.email_address || '',
            employment_status: 'active',
            role: 'server'
          };

          if (existing) {
            await base44.asServiceRole.entities.Employee.update(existing.id, data);
            totalUpdated++;
          } else {
            await base44.asServiceRole.entities.Employee.create(data);
            totalCreated++;
          }
          await wait(400);
        }
        console.log('Team members done: ' + members.length);
      }
    } catch (err) {
      console.error('Team error:', (err as Error).message);
      errors.push({ entity_type: 'team_members', error_message: (err as Error).message });
    }

    // 3. SYNC PAYMENTS - Only last 24 hours, only NEW payments with tips
    try {
      console.log('[3/3] Syncing payments...');
      const beginTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const locations = await base44.asServiceRole.entities.Location.filter({ 
        organization_id: connection.organization_id 
      });
      await wait(300);

      // Get existing payment IDs
      const existingPayments = await base44.asServiceRole.entities.SquarePaymentSummary.list('-payment_created_at', 1000);
      await wait(300);
      
      const existingIds = new Set<string>();
      for (const p of existingPayments) {
        if (p.organization_id === connection.organization_id && p.square_payment_id) {
          existingIds.add(p.square_payment_id);
        }
      }
      console.log('Existing payments: ' + existingIds.size);

      for (const loc of locations) {
        if (!loc.square_location_id) continue;

        const url = baseUrl + '/payments?location_id=' + loc.square_location_id + 
          '&begin_time=' + encodeURIComponent(beginTime) + 
          '&end_time=' + encodeURIComponent(endTime) + 
          '&limit=30';

        const payRes = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
        });

        if (!payRes.ok) {
          console.error('Payment fetch failed: ' + payRes.status);
          continue;
        }

        const payData = await payRes.json();
        const payments = payData.payments || [];
        console.log('Fetched ' + payments.length + ' payments for ' + loc.name);

        let newCount = 0;
        for (const p of payments) {
          // Skip if not completed or already exists
          if (p.status !== 'COMPLETED') continue;
          if (existingIds.has(p.id)) continue;

          const gross = p.amount_money?.amount || 0;
          const tip = p.tip_money?.amount || 0;
          const total = p.total_money?.amount || gross;
          
          let fee = 0;
          const fees = p.processing_fee || [];
          for (let i = 0; i < fees.length; i++) {
            fee += fees[i].amount_money?.amount || 0;
          }

          const data = {
            organization_id: connection.organization_id,
            location_id: loc.id,
            square_payment_id: p.id,
            square_order_id: p.order_id || null,
            payment_created_at: p.created_at,
            gross_amount_pence: gross,
            tip_amount_pence: tip,
            total_amount_pence: total,
            processing_fee_pence: fee,
            net_amount_pence: total - fee,
            team_member_id: p.team_member_id || null,
            card_brand: p.card_details?.card?.card_brand || null,
            source: p.source_type || 'CARD',
            synced_at: new Date().toISOString()
          };

          try {
            await base44.asServiceRole.entities.SquarePaymentSummary.create(data);
            totalCreated++;
            newCount++;
            await wait(500);
          } catch (dbErr) {
            console.error('DB error:', (dbErr as Error).message);
          }

          // Limit to 10 new payments per location to avoid timeout
          if (newCount >= 10) {
            console.log('Reached limit for ' + loc.name);
            break;
          }
        }
        
        console.log('Created ' + newCount + ' new payments for ' + loc.name);
      }
    } catch (err) {
      console.error('Payment error:', (err as Error).message);
      errors.push({ entity_type: 'payments', error_message: (err as Error).message });
    }

    // FINALIZE
    await wait(300);
    await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
      completed_at: new Date().toISOString(),
      status: errors.length > 0 ? 'partial' : 'completed',
      records_created: totalCreated,
      records_updated: totalUpdated
    });

    await wait(300);
    await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
      last_sync_at: new Date().toISOString()
    });

    const duration = Date.now() - startTime;
    console.log('=== Sync completed in ' + duration + 'ms ===');

    return Response.json({
      success: true,
      records: { created: totalCreated, updated: totalUpdated },
      errors: errors,
      duration_ms: duration
    });

  } catch (error) {
    console.error('Sync error:', (error as Error).message);
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
});