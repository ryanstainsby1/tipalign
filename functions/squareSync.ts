import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, triggered_by = 'manual' } = body;

    console.log('=== ENHANCED SYNC WITH WALLET UPDATES ===');

    if (!connection_id) {
      return Response.json({ success: false, error: 'connection_id is required' }, { status: 400 });
    }

    function wait(ms) {
      return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
    await wait(300);
    
    if (connections.length === 0) {
      return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];
    const orgId = connection.organization_id;
    const accessToken = connection.square_access_token_encrypted;
    const baseUrl = 'https://connect.squareup.com/v2';

    if (connection.connection_status !== 'connected') {
      return Response.json({ success: false, error: 'Connection is not active' }, { status: 400 });
    }

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
      organization_id: orgId,
      square_connection_id: connection_id,
      sync_type: 'full',
      entities_synced: ['locations', 'team_members', 'payments', 'allocations', 'wallets'],
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by
    });
    await wait(300);

    let totalCreated = 0;
    let totalUpdated = 0;
    let allocationsCreated = 0;
    let walletsUpdated = 0;
    const affectedEmployees = new Set();
    const errors = [];

    // STEP 1: SYNC LOCATIONS
    console.log('[1/6] Syncing locations...');
    const locationMap = new Map();
    
    try {
      const locRes = await fetch(baseUrl + '/locations', {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
      });

      if (locRes.ok) {
        const locData = await locRes.json();
        const squareLocations = locData.locations || [];
        
        const existingLocs = await base44.asServiceRole.entities.Location.filter({ organization_id: orgId });
        await wait(300);
        
        const existingLocMap = new Map(existingLocs.map(function(l) { return [l.square_location_id, l]; }));

        for (const sq of squareLocations) {
          const existing = existingLocMap.get(sq.id);
          const data = {
            organization_id: orgId,
            square_location_id: sq.id,
            name: sq.name,
            active: sq.status === 'ACTIVE',
            currency: sq.currency || 'GBP',
            timezone: sq.timezone || 'Europe/London'
          };

          let locRecord;
          if (existing) {
            await base44.asServiceRole.entities.Location.update(existing.id, data);
            locRecord = existing;
            totalUpdated++;
          } else {
            locRecord = await base44.asServiceRole.entities.Location.create(data);
            totalCreated++;
          }
          locationMap.set(sq.id, { id: locRecord.id, name: sq.name });
          await wait(350);
        }
        console.log('Locations synced: ' + squareLocations.length);
      }
    } catch (err) {
      console.error('Location error:', err.message);
      errors.push({ entity_type: 'locations', error_message: err.message });
    }

    // STEP 2: SYNC EMPLOYEES
    console.log('[2/6] Syncing employees...');
    const employeeMap = new Map();
    
    try {
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

        const existingEmps = await base44.asServiceRole.entities.Employee.filter({ organization_id: orgId });
        await wait(300);
        
        const existingEmpMap = new Map(existingEmps.map(function(e) { return [e.square_team_member_id, e]; }));

        for (const m of members) {
          const existing = existingEmpMap.get(m.id);
          const name = ((m.given_name || '') + ' ' + (m.family_name || '')).trim() || 'Unknown';
          const data = {
            organization_id: orgId,
            square_team_member_id: m.id,
            full_name: name,
            email: m.email_address || '',
            phone: m.phone_number || '',
            employment_status: 'active',
            role: 'server'
          };

          let empRecord;
          if (existing) {
            await base44.asServiceRole.entities.Employee.update(existing.id, data);
            empRecord = existing;
            totalUpdated++;
          } else {
            empRecord = await base44.asServiceRole.entities.Employee.create(data);
            totalCreated++;
          }
          employeeMap.set(m.id, { id: empRecord.id, name: name });
          await wait(350);
        }
        console.log('Employees synced: ' + members.length);
      }
    } catch (err) {
      console.error('Employee error:', err.message);
      errors.push({ entity_type: 'employees', error_message: err.message });
    }

    const allEmployees = await base44.asServiceRole.entities.Employee.filter({ organization_id: orgId });
    await wait(300);
    for (const emp of allEmployees) {
      if (emp.square_team_member_id) {
        employeeMap.set(emp.square_team_member_id, { id: emp.id, name: emp.full_name });
      }
    }

    const allLocations = await base44.asServiceRole.entities.Location.filter({ organization_id: orgId });
    await wait(300);
    for (const loc of allLocations) {
      if (loc.square_location_id) {
        locationMap.set(loc.square_location_id, { id: loc.id, name: loc.name });
      }
    }

    // STEP 3: SYNC PAYMENTS
    console.log('[3/6] Syncing payments...');
    
    const beginTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();

    const existingPayments = await base44.asServiceRole.entities.SquarePaymentSummary.filter({ organization_id: orgId });
    await wait(300);
    
    const existingPaymentMap = new Map();
    for (const p of existingPayments) {
      if (p.square_payment_id) {
        existingPaymentMap.set(p.square_payment_id, p);
      }
    }

    const newPaymentsWithTips = [];

    try {
      for (const loc of allLocations) {
        if (!loc.square_location_id) continue;

        const url = baseUrl + '/payments?location_id=' + loc.square_location_id + 
          '&begin_time=' + encodeURIComponent(beginTime) + 
          '&end_time=' + encodeURIComponent(endTime) + 
          '&limit=100';

        const payRes = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
        });

        if (!payRes.ok) continue;

        const payData = await payRes.json();
        const payments = payData.payments || [];

        let locCount = 0;
        for (const p of payments) {
          if (p.status !== 'COMPLETED') continue;

          const gross = p.amount_money?.amount || 0;
          const tip = p.tip_money?.amount || 0;
          const total = p.total_money?.amount || (gross + tip);
          
          let fee = 0;
          const fees = p.processing_fee || [];
          for (let i = 0; i < fees.length; i++) {
            fee += fees[i].amount_money?.amount || 0;
          }

          const squareTeamId = p.team_member_id || p.employee_id || null;
          let employeeId = null;
          if (squareTeamId && employeeMap.has(squareTeamId)) {
            employeeId = employeeMap.get(squareTeamId)?.id || null;
          }

          const paymentData = {
            organization_id: orgId,
            location_id: loc.id,
            square_payment_id: p.id,
            square_order_id: p.order_id || null,
            payment_created_at: p.created_at,
            gross_amount_pence: gross,
            tip_amount_pence: tip,
            total_amount_pence: total,
            processing_fee_pence: fee,
            net_amount_pence: total - fee,
            square_team_member_id: squareTeamId,
            employee_id: employeeId,
            card_brand: p.card_details?.card?.card_brand || null,
            source: p.source_type || 'CARD',
            synced_at: new Date().toISOString()
          };

          const existing = existingPaymentMap.get(p.id);
          const isNew = !existing;

          try {
            if (existing) {
              await base44.asServiceRole.entities.SquarePaymentSummary.update(existing.id, paymentData);
              totalUpdated++;
            } else {
              await base44.asServiceRole.entities.SquarePaymentSummary.create(paymentData);
              totalCreated++;
            }
            locCount++;
            await wait(250);

            if (isNew && tip > 0) {
              newPaymentsWithTips.push({
                paymentId: p.id,
                tip: tip,
                employeeId: employeeId,
                locationId: loc.id,
                createdAt: p.created_at
              });
              
              if (employeeId) {
                affectedEmployees.add(employeeId);
              }
            }
          } catch (dbErr) {
            console.error('Payment DB error:', dbErr.message);
          }

          if (locCount >= 25) break;
        }
      }
    } catch (err) {
      console.error('Payment sync error:', err.message);
      errors.push({ entity_type: 'payments', error_message: err.message });
    }

    console.log('New payments with tips: ' + newPaymentsWithTips.length);

    // STEP 4: CREATE ALLOCATIONS
    console.log('[4/6] Creating allocations...');

    let existingAllocations = [];
    try {
      existingAllocations = await base44.asServiceRole.entities.TipAllocation.filter({ organization_id: orgId });
      await wait(300);
    } catch (e) {
      console.log('TipAllocation entity may not exist');
    }

    const existingAllocationPaymentIds = new Set();
    for (const a of existingAllocations) {
      if (a.square_payment_id) {
        existingAllocationPaymentIds.add(a.square_payment_id);
      }
    }

    for (const tipPayment of newPaymentsWithTips) {
      if (existingAllocationPaymentIds.has(tipPayment.paymentId)) continue;

      const allocationData = {
        organization_id: orgId,
        location_id: tipPayment.locationId,
        employee_id: tipPayment.employeeId,
        square_payment_id: tipPayment.paymentId,
        amount: tipPayment.tip,
        tip_amount_pence: tipPayment.tip,
        tip_amount: tipPayment.tip / 100,
        allocation_date: tipPayment.createdAt.split('T')[0],
        date: tipPayment.createdAt.split('T')[0],
        status: tipPayment.employeeId ? 'pending' : 'unassigned',
        created_at: new Date().toISOString()
      };

      try {
        await base44.asServiceRole.entities.TipAllocation.create(allocationData);
        allocationsCreated++;
        await wait(400);
      } catch (allocErr) {
        console.error('Allocation error:', allocErr.message);
      }

      if (allocationsCreated >= 30) break;
    }

    console.log('Allocations created: ' + allocationsCreated);

    // STEP 5: UPDATE EMPLOYEE TOTALS
    console.log('[5/6] Updating employee totals...');

    try {
      const allAllocations = await base44.asServiceRole.entities.TipAllocation.filter({ organization_id: orgId });
      await wait(300);

      const empTotals = new Map();
      
      for (const alloc of allAllocations) {
        const empId = alloc.employee_id;
        if (!empId) continue;
        
        const current = empTotals.get(empId) || { earned: 0, pending: 0 };
        const amount = alloc.tip_amount_pence || alloc.amount || 0;
        const status = alloc.status;
        
        if (status === 'confirmed' || status === 'paid' || status === 'completed') {
          current.earned += amount;
        } else {
          current.pending += amount;
        }
        
        empTotals.set(empId, current);
        affectedEmployees.add(empId);
      }

      let empUpdated = 0;
      for (const [empId, totals] of empTotals) {
        try {
          await base44.asServiceRole.entities.Employee.update(empId, {
            total_earned_pence: totals.earned,
            pending_pence: totals.pending
          });
          empUpdated++;
          await wait(350);
        } catch (err) {
          console.error('Employee update error:', err.message);
        }

        if (empUpdated >= 25) break;
      }
      
      console.log('Employee totals updated: ' + empUpdated);
    } catch (err) {
      console.error('Employee totals error:', err.message);
    }

    // STEP 6: UPDATE WALLET PASSES
    console.log('[6/6] Updating wallet passes...');

    if (affectedEmployees.size > 0) {
      for (const empId of affectedEmployees) {
        try {
          const walletPasses = await base44.asServiceRole.entities.WalletPass.filter({ employee_id: empId });

          if (walletPasses.length > 0) {
            let currentTips = 0;
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const empAllocations = await base44.asServiceRole.entities.TipAllocation.filter({ employee_id: empId });

            for (const alloc of empAllocations) {
              const allocDate = new Date(alloc.allocation_date || alloc.created_at);
              if (allocDate >= weekStart) {
                currentTips += alloc.tip_amount_pence || alloc.amount || 0;
              }
            }

            await base44.asServiceRole.entities.WalletPass.update(walletPasses[0].id, {
              current_tips_pence: currentTips,
              last_updated: new Date().toISOString()
            });
            
            walletsUpdated++;
            console.log('Updated wallet for employee: ' + empId);
          }
          
          await wait(300);
        } catch (walletErr) {
          console.log('Wallet update error:', walletErr.message);
        }

        if (walletsUpdated >= 10) break;
      }
    }

    console.log('Wallet passes updated: ' + walletsUpdated);

    // FINALIZE
    await wait(300);
    await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
      completed_at: new Date().toISOString(),
      status: errors.length > 0 ? 'partial' : 'completed',
      records_created: totalCreated + allocationsCreated,
      records_updated: totalUpdated
    });

    await wait(300);
    await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
      last_sync_at: new Date().toISOString()
    });

    const duration = Date.now() - startTime;
    console.log('=== SYNC COMPLETED in ' + duration + 'ms ===');

    return Response.json({
      success: true,
      summary: {
        records_created: totalCreated,
        records_updated: totalUpdated,
        allocations_created: allocationsCreated,
        wallets_updated: walletsUpdated,
        affected_employees: affectedEmployees.size
      },
      errors: errors,
      duration_ms: duration
    });

  } catch (error) {
    console.error('Sync error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});