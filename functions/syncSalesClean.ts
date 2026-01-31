import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, days = 30, clear_old = false } = body;

    console.log('=== CLEAN SALES SYNC ===');
    console.log('Days:', days, 'Clear old:', clear_old);

    if (!connection_id) {
      return Response.json({ success: false, error: 'connection_id is required' }, { status: 400 });
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
    if (connections.length === 0) {
      return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }
    
    const connection = connections[0];
    const orgId = connection.organization_id;
    const accessToken = connection.square_access_token_encrypted;
    const baseUrl = 'https://connect.squareup.com/v2';

    if (!accessToken) {
      return Response.json({ success: false, error: 'No access token' }, { status: 400 });
    }

    // STEP 1: Optionally clear old payment data
    if (clear_old) {
      console.log('Clearing old payment data...');
      try {
        const oldPayments = await base44.asServiceRole.entities.SquarePaymentSummary.filter({ organization_id: orgId });
        console.log('Found', oldPayments.length, 'old payments to delete');
        
        let deleted = 0;
        for (const p of oldPayments) {
          try {
            await base44.asServiceRole.entities.SquarePaymentSummary.delete(p.id);
            deleted++;
            if (deleted % 20 === 0) await wait(500);
          } catch (e) {
            console.error('Delete error:', e.message);
          }
        }
        console.log('Deleted', deleted, 'old payments');
        await wait(500);
      } catch (e) {
        console.error('Clear error:', e.message);
      }
    }

    // STEP 2: Get locations from Square
    console.log('Fetching locations...');
    const locRes = await fetch(baseUrl + '/locations', {
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
    });

    if (!locRes.ok) {
      return Response.json({ success: false, error: 'Square API error' }, { status: 500 });
    }

    const locData = await locRes.json();
    const squareLocations = locData.locations || [];
    console.log('Found', squareLocations.length, 'locations');

    // Sync locations
    const existingLocs = await base44.asServiceRole.entities.Location.filter({ organization_id: orgId });
    await wait(200);
    
    const locMap = new Map();
    
    for (const sq of squareLocations) {
      const existing = existingLocs.find(l => l.square_location_id === sq.id);
      
      if (existing) {
        locMap.set(sq.id, existing.id);
        await base44.asServiceRole.entities.Location.update(existing.id, {
          name: sq.name,
          active: sq.status === 'ACTIVE'
        });
      } else {
        const newLoc = await base44.asServiceRole.entities.Location.create({
          organization_id: orgId,
          square_location_id: sq.id,
          name: sq.name,
          active: sq.status === 'ACTIVE',
          currency: sq.currency || 'GBP'
        });
        locMap.set(sq.id, newLoc.id);
      }
      await wait(150);
    }

    // STEP 3: Get team members
    console.log('Fetching team members...');
    const teamRes = await fetch(baseUrl + '/team-members/search', {
      method: 'POST',
      headers: { 
        'Authorization': 'Bearer ' + accessToken, 
        'Square-Version': '2024-12-18',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: { filter: { status: 'ACTIVE' } } })
    });

    let teamMembers = [];
    if (teamRes.ok) {
      const teamData = await teamRes.json();
      teamMembers = teamData.team_members || [];
    }
    console.log('Found', teamMembers.length, 'team members');

    // Sync employees
    const existingEmps = await base44.asServiceRole.entities.Employee.filter({ organization_id: orgId });
    await wait(200);
    
    const empMap = new Map();
    
    for (const emp of existingEmps) {
      if (emp.square_team_member_id) {
        empMap.set(emp.square_team_member_id, emp.id);
      }
    }

    for (const tm of teamMembers) {
      const name = ((tm.given_name || '') + ' ' + (tm.family_name || '')).trim() || 'Unknown';
      
      if (empMap.has(tm.id)) {
        // Update existing
        await base44.asServiceRole.entities.Employee.update(empMap.get(tm.id), {
          full_name: name,
          email: tm.email_address || '',
          employment_status: 'active'
        });
      } else {
        // Create new
        const newEmp = await base44.asServiceRole.entities.Employee.create({
          organization_id: orgId,
          square_team_member_id: tm.id,
          full_name: name,
          email: tm.email_address || '',
          employment_status: 'active',
          role: 'server',
          total_earned_pence: 0,
          pending_pence: 0
        });
        empMap.set(tm.id, newEmp.id);
      }
      await wait(150);
    }

    // STEP 4: Get existing payments for update check
    const existingPayments = await base44.asServiceRole.entities.SquarePaymentSummary.filter({ organization_id: orgId });
    await wait(200);
    
    const existingPaymentMap = new Map();
    for (const p of existingPayments) {
      if (p.square_payment_id) {
        existingPaymentMap.set(p.square_payment_id, p);
      }
    }

    // STEP 5: Fetch ALL payments from Square
    console.log('Fetching payments...');
    const beginTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalTips = 0;
    let totalRevenue = 0;
    let paymentsWithTips = 0;

    for (const sq of squareLocations) {
      const ourLocId = locMap.get(sq.id);
      if (!ourLocId) continue;

      console.log('Processing', sq.name, '...');
      let cursor = null;
      let pageCount = 0;

      do {
        let url = baseUrl + '/payments?location_id=' + sq.id + 
          '&begin_time=' + encodeURIComponent(beginTime) + 
          '&end_time=' + encodeURIComponent(endTime) + 
          '&limit=100';
        
        if (cursor) url += '&cursor=' + encodeURIComponent(cursor);

        const payRes = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
        });

        if (!payRes.ok) {
          console.error('Payment fetch failed for', sq.name);
          break;
        }

        const payData = await payRes.json();
        const payments = payData.payments || [];
        cursor = payData.cursor || null;
        pageCount++;

        for (const p of payments) {
          if (p.status !== 'COMPLETED') continue;

          const gross = p.amount_money?.amount || 0;
          const tip = p.tip_money?.amount || 0;
          const total = p.total_money?.amount || (gross + tip);
          
          let fee = 0;
          if (p.processing_fee) {
            for (const f of p.processing_fee) {
              fee += f.amount_money?.amount || 0;
            }
          }

          const squareTeamId = p.team_member_id || p.employee_id || null;
          const employeeId = squareTeamId ? empMap.get(squareTeamId) || null : null;

          const paymentData = {
            organization_id: orgId,
            location_id: ourLocId,
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

          try {
            const existing = existingPaymentMap.get(p.id);
            
            if (existing) {
              // UPDATE existing record
              await base44.asServiceRole.entities.SquarePaymentSummary.update(existing.id, paymentData);
              totalUpdated++;
            } else {
              // CREATE new record
              await base44.asServiceRole.entities.SquarePaymentSummary.create(paymentData);
              totalCreated++;
            }

            totalRevenue += gross;
            totalTips += tip;
            if (tip > 0) paymentsWithTips++;

          } catch (e) {
            console.error('Payment save error:', e.message);
          }
        }

        // Rate limiting
        await wait(300);
        if (pageCount >= 10) break; // Safety limit per location

      } while (cursor);
    }

    // STEP 6: Create allocations for tips
    console.log('Creating allocations...');
    
    const existingAllocs = await base44.asServiceRole.entities.TipAllocation.filter({ organization_id: orgId });
    await wait(200);
    
    const existingAllocPaymentIds = new Set(existingAllocs.map(a => a.square_payment_id));
    
    // Get fresh payment list
    const freshPayments = await base44.asServiceRole.entities.SquarePaymentSummary.filter({ organization_id: orgId });
    await wait(200);

    let allocsCreated = 0;
    
    for (const payment of freshPayments) {
      if (!payment.tip_amount_pence || payment.tip_amount_pence <= 0) continue;
      if (existingAllocPaymentIds.has(payment.square_payment_id)) continue;

      try {
        await base44.asServiceRole.entities.TipAllocation.create({
          organization_id: orgId,
          location_id: payment.location_id,
          employee_id: payment.employee_id || null,
          square_payment_id: payment.square_payment_id,
          tip_amount_pence: payment.tip_amount_pence,
          amount: payment.tip_amount_pence,
          allocation_date: payment.payment_created_at ? payment.payment_created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          status: payment.employee_id ? 'pending' : 'unassigned',
          created_at: new Date().toISOString()
        });
        allocsCreated++;
        await wait(200);
      } catch (e) {
        console.error('Allocation error:', e.message);
      }
      
      if (allocsCreated >= 50) break; // Rate limit
    }

    // STEP 7: Update employee totals
    console.log('Updating employee totals...');
    
    const allAllocs = await base44.asServiceRole.entities.TipAllocation.filter({ organization_id: orgId });
    await wait(200);

    const empTotals = new Map();
    for (const alloc of allAllocs) {
      if (!alloc.employee_id) continue;
      const current = empTotals.get(alloc.employee_id) || 0;
      empTotals.set(alloc.employee_id, current + (alloc.tip_amount_pence || alloc.amount || 0));
    }

    for (const [empId, total] of empTotals) {
      try {
        await base44.asServiceRole.entities.Employee.update(empId, {
          pending_pence: total,
          total_earned_pence: 0
        });
        await wait(150);
      } catch (e) {}
    }

    // Update connection
    await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
      last_sync_at: new Date().toISOString()
    });

    const duration = Date.now() - startTime;

    console.log('=== SYNC COMPLETE ===');
    console.log('Created:', totalCreated, 'Updated:', totalUpdated);
    console.log('Revenue:', totalRevenue, 'Tips:', totalTips);

    return Response.json({
      success: true,
      summary: {
        locations: squareLocations.length,
        employees: teamMembers.length,
        payments_created: totalCreated,
        payments_updated: totalUpdated,
        payments_with_tips: paymentsWithTips,
        allocations_created: allocsCreated,
        total_revenue_pence: totalRevenue,
        total_revenue_gbp: '£' + (totalRevenue / 100).toFixed(2),
        total_tips_pence: totalTips,
        total_tips_gbp: '£' + (totalTips / 100).toFixed(2),
        tip_rate: totalRevenue > 0 ? ((totalTips / totalRevenue) * 100).toFixed(2) + '%' : '0%'
      },
      duration_ms: duration
    });

  } catch (error) {
    console.error('Sync error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});