import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, triggered_by = 'manual' } = body;

    console.log('=== FULL SYNC STARTED ===');

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
      sync_type: 'full',
      entities_synced: ['locations', 'team_members', 'payments', 'allocations'],
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by
    });
    await wait(300);

    const accessToken = connection.square_access_token_encrypted;
    const baseUrl = 'https://connect.squareup.com/v2';
    const orgId = connection.organization_id;

    let totalCreated = 0;
    let totalUpdated = 0;
    let allocationsCreated = 0;
    let totalTipsAllocated = 0;
    const errors = [];

    // ============================================
    // STEP 1: SYNC LOCATIONS
    // ============================================
    console.log('[1/5] Syncing locations...');
    let locationMap = new Map();
    
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

    // ============================================
    // STEP 2: SYNC TEAM MEMBERS / EMPLOYEES
    // ============================================
    console.log('[2/5] Syncing employees...');
    let employeeMap = new Map();
    
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
            role: 'server',
            total_tips_earned_lifetime: existing?.total_tips_earned_lifetime || 0,
            pending_tips: existing?.pending_tips || 0
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

    // Refresh employee list for later use
    const allEmployees = await base44.asServiceRole.entities.Employee.filter({ organization_id: orgId });
    await wait(300);
    for (const emp of allEmployees) {
      if (emp.square_team_member_id) {
        employeeMap.set(emp.square_team_member_id, { id: emp.id, name: emp.full_name });
      }
    }

    // Refresh location list
    const allLocations = await base44.asServiceRole.entities.Location.filter({ organization_id: orgId });
    await wait(300);
    for (const loc of allLocations) {
      if (loc.square_location_id) {
        locationMap.set(loc.square_location_id, { id: loc.id, name: loc.name });
      }
    }

    // ============================================
    // STEP 3: SYNC PAYMENTS
    // ============================================
    console.log('[3/5] Syncing payments...');
    
    const beginTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();

    // Get existing payments
    const existingPayments = await base44.asServiceRole.entities.Payment.list('-payment_date', 2000);
    await wait(300);
    
    const existingPaymentMap = new Map();
    for (const p of existingPayments) {
      if (p.organization_id === orgId && p.square_payment_id) {
        existingPaymentMap.set(p.square_payment_id, p);
      }
    }

    // Get existing allocations to avoid duplicates
    const existingAllocations = await base44.asServiceRole.entities.TipAllocation.list('-created_date', 2000);
    await wait(300);
    
    const existingAllocationPaymentIds = new Set();
    for (const a of existingAllocations) {
      if (a.payment_id) {
        const payment = existingPaymentMap.get(a.payment_id);
        if (payment && payment.square_payment_id) {
          existingAllocationPaymentIds.add(payment.square_payment_id);
        }
      }
    }
    console.log('Existing allocations: ' + existingAllocationPaymentIds.size);

    try {
      for (const loc of allLocations) {
        if (!loc.square_location_id) continue;

        console.log('Processing payments for: ' + loc.name);

        const url = baseUrl + '/payments?location_id=' + loc.square_location_id + 
          '&begin_time=' + encodeURIComponent(beginTime) + 
          '&end_time=' + encodeURIComponent(endTime) + 
          '&limit=100';

        const payRes = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
        });

        if (!payRes.ok) {
          console.error('Payment fetch failed for ' + loc.name + ': ' + payRes.status);
          continue;
        }

        const payData = await payRes.json();
        const payments = payData.payments || [];
        console.log('Fetched ' + payments.length + ' payments');

        let locPaymentCount = 0;

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

          // Get Square team member ID
          const squareTeamId = p.team_member_id || p.employee_id || null;
          
          // Map to our employee
          let employeeId = null;
          if (squareTeamId && employeeMap.has(squareTeamId)) {
            const emp = employeeMap.get(squareTeamId);
            if (emp) {
              employeeId = emp.id;
            }
          }

          const paymentData = {
            organization_id: orgId,
            location_id: loc.id,
            square_location_id: loc.square_location_id,
            square_payment_id: p.id,
            square_order_id: p.order_id || null,
            payment_date: p.created_at,
            total_amount: total,
            tip_amount: tip,
            currency: 'GBP',
            employee_id: employeeId,
            square_team_member_id: squareTeamId,
            processing_fee: fee,
            card_brand: p.card_details?.card?.card_brand || (p.cash_details ? 'CASH' : null),
            payment_source_type: p.source_type || 'CARD',
            status: 'completed'
          };

          const existing = existingPaymentMap.get(p.id);

          try {
            let paymentRecord;
            if (existing) {
              await base44.asServiceRole.entities.Payment.update(existing.id, paymentData);
              paymentRecord = existing;
              totalUpdated++;
            } else {
              paymentRecord = await base44.asServiceRole.entities.Payment.create(paymentData);
              existingPaymentMap.set(p.id, paymentRecord);
              totalCreated++;
            }
            locPaymentCount++;
            await wait(250);
          } catch (dbErr) {
            console.error('Payment DB error: ' + dbErr.message);
          }

          // Rate limit
          if (locPaymentCount >= 25) {
            console.log('Rate limit reached for ' + loc.name);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Payment sync error:', err.message);
      errors.push({ entity_type: 'payments', error_message: err.message });
    }

    // ============================================
    // STEP 4: CREATE TIP ALLOCATIONS
    // ============================================
    console.log('[4/5] Creating tip allocations...');
    
    try {
      // Get fresh payment data with tips
      const paymentsWithTips = await base44.asServiceRole.entities.Payment.filter({
        organization_id: orgId
      });
      await wait(300);

      for (const payment of paymentsWithTips) {
        // Skip if no tip or already allocated
        if (!payment.tip_amount || payment.tip_amount <= 0) continue;
        if (payment.square_payment_id && existingAllocationPaymentIds.has(payment.square_payment_id)) continue;

        // Skip if no employee assigned
        if (!payment.employee_id) continue;

        // Get employee name
        let empName = 'Unknown';
        for (const [sqId, emp] of employeeMap) {
          if (emp.id === payment.employee_id) {
            empName = emp.name;
            break;
          }
        }

        // Get location name
        let locName = 'Unknown Location';
        for (const [sqId, locInfo] of locationMap) {
          if (locInfo.id === payment.location_id) {
            locName = locInfo.name;
            break;
          }
        }

        // Create allocation
        const allocationData = {
          organization_id: orgId,
          transaction_id: payment.square_payment_id,
          employee_id: payment.employee_id,
          square_employee_id: payment.square_team_member_id,
          location_id: payment.location_id,
          allocation_date: payment.payment_date || new Date().toISOString(),
          gross_amount: payment.tip_amount,
          allocation_method: 'individual',
          status: 'pending'
        };

        try {
          await base44.asServiceRole.entities.TipAllocation.create(allocationData);
          allocationsCreated++;
          totalTipsAllocated += payment.tip_amount;
          if (payment.square_payment_id) {
            existingAllocationPaymentIds.add(payment.square_payment_id);
          }
          console.log('Allocation created: ' + (payment.tip_amount/100).toFixed(2) + ' GBP for ' + empName + ' at ' + locName);
          await wait(400);
        } catch (allocErr) {
          console.error('Allocation error: ' + allocErr.message);
        }

        // Rate limit
        if (allocationsCreated >= 30) {
          console.log('Allocation rate limit reached');
          break;
        }
      }
      
      console.log('Allocations created: ' + allocationsCreated);
    } catch (err) {
      console.error('Allocation sync error:', err.message);
      errors.push({ entity_type: 'allocations', error_message: err.message });
    }

    // ============================================
    // STEP 5: UPDATE EMPLOYEE TOTALS
    // ============================================
    console.log('[5/5] Updating employee totals...');
    
    try {
      // Calculate totals from all allocations
      const allAllocations = await base44.asServiceRole.entities.TipAllocation.filter({
        organization_id: orgId
      });
      await wait(300);

      // Sum tips per employee
      const empTotals = new Map();
      
      for (const alloc of allAllocations) {
        if (!alloc.employee_id) continue;
        
        const current = empTotals.get(alloc.employee_id) || { earned: 0, pending: 0 };
        const amount = alloc.gross_amount || 0;
        
        if (alloc.status === 'confirmed' || alloc.status === 'paid') {
          current.earned += amount;
        } else {
          current.pending += amount;
        }
        
        empTotals.set(alloc.employee_id, current);
      }

      // Update each employee
      let empUpdated = 0;
      for (const [empId, totals] of empTotals) {
        try {
          await base44.asServiceRole.entities.Employee.update(empId, {
            total_tips_earned_lifetime: totals.earned,
            pending_tips: totals.pending
          });
          empUpdated++;
          await wait(350);
        } catch (empErr) {
          console.error('Employee update error: ' + empErr.message);
        }

        if (empUpdated >= 25) {
          console.log('Employee update rate limit reached');
          break;
        }
      }
      
      console.log('Employee totals updated: ' + empUpdated);
    } catch (err) {
      console.error('Employee total update error:', err.message);
      errors.push({ entity_type: 'employee_totals', error_message: err.message });
    }

    // ============================================
    // FINALIZE
    // ============================================
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
    console.log('=== FULL SYNC COMPLETED in ' + duration + 'ms ===');
    console.log('Summary: Created=' + totalCreated + ', Updated=' + totalUpdated + ', Allocations=' + allocationsCreated + ', Tips=' + (totalTipsAllocated/100).toFixed(2) + ' GBP');

    return Response.json({
      success: true,
      summary: {
        locations_synced: locationMap.size,
        employees_synced: employeeMap.size,
        payments_created: totalCreated,
        payments_updated: totalUpdated,
        allocations_created: allocationsCreated,
        tips_allocated_pence: totalTipsAllocated,
        tips_allocated_gbp: (totalTipsAllocated/100).toFixed(2)
      },
      errors: errors,
      duration_ms: duration
    });

  } catch (error) {
    console.error('Sync error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});