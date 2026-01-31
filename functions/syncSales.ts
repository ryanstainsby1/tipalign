import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, days = 7 } = body;

    console.log('=== SYNC SALES ===');

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

    // Get locations from Square
    const locRes = await fetch(baseUrl + '/locations', {
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
    });

    if (!locRes.ok) {
      const errText = await locRes.text();
      return Response.json({ success: false, error: 'Square API error: ' + errText }, { status: 500 });
    }

    const locData = await locRes.json();
    const squareLocations = locData.locations || [];

    // Sync locations to database
    const existingLocs = await base44.asServiceRole.entities.Location.filter({ organization_id: orgId });
    await wait(200);
    
    const locMap = new Map();
    
    for (const sq of squareLocations) {
      const existing = existingLocs.find(l => l.square_location_id === sq.id);
      
      if (existing) {
        locMap.set(sq.id, existing.id);
      } else {
        const newLoc = await base44.asServiceRole.entities.Location.create({
          organization_id: orgId,
          square_location_id: sq.id,
          name: sq.name,
          active: sq.status === 'ACTIVE',
          currency: sq.currency || 'GBP'
        });
        locMap.set(sq.id, newLoc.id);
        await wait(200);
      }
    }

    // Get team members from Square
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
      if (!empMap.has(tm.id)) {
        const name = ((tm.given_name || '') + ' ' + (tm.family_name || '')).trim() || 'Unknown';
        const newEmp = await base44.asServiceRole.entities.Employee.create({
          organization_id: orgId,
          square_team_member_id: tm.id,
          full_name: name,
          email: tm.email_address || '',
          employment_status: 'active',
          role: 'server'
        });
        empMap.set(tm.id, newEmp.id);
        await wait(200);
      }
    }

    // Get existing payments to avoid duplicates
    const existingPayments = await base44.asServiceRole.entities.SquarePaymentSummary.filter({ organization_id: orgId });
    await wait(200);
    
    const existingPaymentIds = new Set(existingPayments.map(p => p.square_payment_id));

    // Fetch payments from Square
    const beginTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();

    let totalCreated = 0;
    let totalTips = 0;
    let totalRevenue = 0;

    for (const sq of squareLocations) {
      const ourLocId = locMap.get(sq.id);
      if (!ourLocId) continue;

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
          if (existingPaymentIds.has(p.id)) continue;

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

          try {
            await base44.asServiceRole.entities.SquarePaymentSummary.create({
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
            });

            totalCreated++;
            totalRevenue += gross;
            totalTips += tip;
            existingPaymentIds.add(p.id);

            if (totalCreated % 10 === 0) {
              await wait(300);
            }
          } catch (e) {
            console.error('Failed to create payment:', e.message);
          }
        }

        // Safety limit
        if (pageCount >= 5) break;
        if (cursor) await wait(500);

      } while (cursor);
    }

    // Update connection
    await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
      last_sync_at: new Date().toISOString()
    });

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      summary: {
        locations_synced: squareLocations.length,
        employees_synced: teamMembers.length,
        payments_created: totalCreated,
        total_revenue_gbp: '£' + (totalRevenue / 100).toFixed(2),
        total_tips_gbp: '£' + (totalTips / 100).toFixed(2)
      },
      duration_ms: duration
    });

  } catch (error) {
    console.error('Sync error:', error.message);
    console.error('Stack:', error.stack);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});