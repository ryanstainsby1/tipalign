import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id } = body;

    console.log('=== SALES SYNC DIAGNOSTIC ===');

    if (!connection_id) {
      return Response.json({ success: false, error: 'connection_id is required' }, { status: 400 });
    }

    // Get connection
    let connection;
    try {
      const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
      if (connections.length === 0) {
        return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
      }
      connection = connections[0];
      console.log('Connection found:', connection.id);
    } catch (e) {
      return Response.json({ success: false, error: 'Failed to get connection: ' + e.message }, { status: 500 });
    }

    const accessToken = connection.square_access_token_encrypted;
    const baseUrl = 'https://connect.squareup.com/v2';

    if (!accessToken) {
      return Response.json({ success: false, error: 'No access token found in connection' }, { status: 400 });
    }

    console.log('Access token exists:', !!accessToken);
    console.log('Token length:', accessToken.length);

    // Test 1: Get Locations
    console.log('--- TEST 1: Fetching Locations ---');
    let locations = [];
    try {
      const locRes = await fetch(baseUrl + '/locations', {
        method: 'GET',
        headers: { 
          'Authorization': 'Bearer ' + accessToken, 
          'Square-Version': '2024-12-18',
          'Content-Type': 'application/json'
        }
      });

      console.log('Locations response status:', locRes.status);
      
      if (!locRes.ok) {
        const errorText = await locRes.text();
        console.error('Locations error:', errorText);
        return Response.json({ 
          success: false, 
          error: 'Square API error fetching locations',
          status: locRes.status,
          details: errorText
        }, { status: 500 });
      }

      const locData = await locRes.json();
      locations = locData.locations || [];
      console.log('Locations found:', locations.length);
      console.log('Location names:', locations.map(l => l.name).join(', '));
    } catch (e) {
      console.error('Locations fetch error:', e.message);
      return Response.json({ success: false, error: 'Failed to fetch locations: ' + e.message }, { status: 500 });
    }

    // Test 2: Get Payments for first location
    console.log('--- TEST 2: Fetching Payments ---');
    const beginTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();
    
    let allPayments = [];
    let totalTips = 0;
    let totalRevenue = 0;

    for (const loc of locations) {
      console.log('Fetching payments for:', loc.name, '(' + loc.id + ')');
      
      try {
        const url = baseUrl + '/payments?location_id=' + loc.id + 
          '&begin_time=' + encodeURIComponent(beginTime) + 
          '&end_time=' + encodeURIComponent(endTime) + 
          '&limit=100';

        const payRes = await fetch(url, {
          method: 'GET',
          headers: { 
            'Authorization': 'Bearer ' + accessToken, 
            'Square-Version': '2024-12-18',
            'Content-Type': 'application/json'
          }
        });

        console.log('Payments response for', loc.name, ':', payRes.status);

        if (payRes.ok) {
          const payData = await payRes.json();
          const payments = payData.payments || [];
          console.log('Payments found:', payments.length);

          for (const p of payments) {
            if (p.status === 'COMPLETED') {
              const gross = p.amount_money?.amount || 0;
              const tip = p.tip_money?.amount || 0;
              totalRevenue += gross;
              totalTips += tip;
              
              allPayments.push({
                id: p.id,
                location: loc.name,
                gross: gross,
                tip: tip,
                total: p.total_money?.amount || 0,
                team_member_id: p.team_member_id || null,
                created_at: p.created_at
              });

              if (tip > 0) {
                console.log('TIP FOUND: £' + (tip/100).toFixed(2) + ' at ' + loc.name + ' (team_member: ' + (p.team_member_id || 'NONE') + ')');
              }
            }
          }
        } else {
          const errorText = await payRes.text();
          console.error('Payment fetch error for', loc.name, ':', errorText);
        }
      } catch (e) {
        console.error('Payment fetch exception for', loc.name, ':', e.message);
      }
    }

    // Test 3: Get Team Members
    console.log('--- TEST 3: Fetching Team Members ---');
    let teamMembers = [];
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

      console.log('Team members response:', teamRes.status);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        teamMembers = teamData.team_members || [];
        console.log('Team members found:', teamMembers.length);
      } else {
        const errorText = await teamRes.text();
        console.error('Team fetch error:', errorText);
      }
    } catch (e) {
      console.error('Team fetch exception:', e.message);
    }

    // Summary
    const duration = Date.now() - startTime;
    
    const summary = {
      success: true,
      diagnostic: true,
      duration_ms: duration,
      connection: {
        id: connection.id,
        status: connection.connection_status,
        has_token: !!accessToken
      },
      square_data: {
        locations_count: locations.length,
        locations: locations.map(l => ({ id: l.id, name: l.name, status: l.status })),
        team_members_count: teamMembers.length,
        payments_count: allPayments.length,
        total_revenue_pence: totalRevenue,
        total_revenue_gbp: '£' + (totalRevenue / 100).toFixed(2),
        total_tips_pence: totalTips,
        total_tips_gbp: '£' + (totalTips / 100).toFixed(2),
        tip_rate: totalRevenue > 0 ? ((totalTips / totalRevenue) * 100).toFixed(1) + '%' : '0%'
      },
      sample_payments: allPayments.slice(0, 10),
      payments_with_tips: allPayments.filter(p => p.tip > 0).length
    };

    console.log('=== DIAGNOSTIC COMPLETE ===');
    console.log(JSON.stringify(summary, null, 2));

    return Response.json(summary);

  } catch (error) {
    console.error('Diagnostic error:', error.message);
    console.error('Stack:', error.stack);
    return Response.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});