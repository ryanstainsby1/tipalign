import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, entity_types = ['payments', 'team_members', 'timecards', 'locations'] } = body;

    if (!connection_id) {
      return Response.json({ success: false, error: 'connection_id required' }, { status: 400 });
    }

    // Get connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
    if (connections.length === 0) {
      return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];
    const orgId = connection.organization_id;
    const accessToken = Deno.env.get('SQUARE_ACCESS_TOKEN') || connection.square_access_token_encrypted;
    const environment = Deno.env.get('SQUARE_ENVIRONMENT') || 'production';
    const baseUrl = environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com/v2'
      : 'https://connect.squareup.com/v2';

    if (!accessToken) {
      throw new Error('Square access token not found');
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2025-05-21'
    };

    let totalSynced = 0;
    const results = {};

    // Sync Locations
    if (entity_types.includes('locations')) {
      try {
        const locRes = await fetch(`${baseUrl}/locations`, { headers });
        if (locRes.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryRes = await fetch(`${baseUrl}/locations`, { headers });
          if (!retryRes.ok) throw new Error('Rate limited');
        }
        const locData = await locRes.json();
        
        for (const loc of locData.locations || []) {
          const existing = await base44.asServiceRole.entities.Location.filter({
            organization_id: orgId,
            square_location_id: loc.id
          });

          const locData = {
            organization_id: orgId,
            square_location_id: loc.id,
            name: loc.name,
            address: loc.address,
            timezone: loc.timezone || 'Europe/London',
            phone: loc.phone_number,
            active: loc.status === 'ACTIVE'
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Location.update(existing[0].id, locData);
          } else {
            await base44.asServiceRole.entities.Location.create(locData);
          }
          totalSynced++;
        }
        results.locations = locData.locations?.length || 0;
      } catch (err) {
        console.error('Location sync error:', err);
        results.locations_error = err.message;
      }
    }

    // Sync Team Members
    if (entity_types.includes('team_members')) {
      try {
        const tmRes = await fetch(`${baseUrl}/team-members/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: { filter: { status: 'ACTIVE' } } })
        });
        const tmData = await tmRes.json();
        
        for (const tm of tmData.team_members || []) {
          const existing = await base44.asServiceRole.entities.Employee.filter({
            organization_id: orgId,
            square_team_member_id: tm.id
          });

          const empData = {
            organization_id: orgId,
            square_team_member_id: tm.id,
            full_name: `${tm.given_name || ''} ${tm.family_name || ''}`.trim(),
            email: tm.email_address,
            phone: tm.phone_number,
            is_active: tm.status === 'ACTIVE',
            employment_status: tm.status === 'ACTIVE' ? 'active' : 'terminated'
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Employee.update(existing[0].id, empData);
          } else {
            await base44.asServiceRole.entities.Employee.create(empData);
          }
          totalSynced++;
        }
        results.team_members = tmData.team_members?.length || 0;
      } catch (err) {
        console.error('Team member sync error:', err);
        results.team_members_error = err.message;
      }
    }

    // Sync Payments (today)
    if (entity_types.includes('payments')) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const paymentsRes = await fetch(`${baseUrl}/payments?begin_time=${today.toISOString()}&end_time=${tomorrow.toISOString()}&limit=100`, {
          headers
        });
        const paymentsData = await paymentsRes.json();
        
        for (const payment of paymentsData.payments || []) {
          if (payment.status !== 'COMPLETED') continue;

          const existing = await base44.asServiceRole.entities.Transaction.filter({
            organization_id: orgId,
            square_payment_id: payment.id
          });

          const amount = parseInt(payment.amount_money?.amount || 0);
          const tipAmount = parseInt(payment.tip_money?.amount || 0);

          const txData = {
            organization_id: orgId,
            square_payment_id: payment.id,
            square_location_id: payment.location_id,
            amount,
            tip_amount: tipAmount,
            total_amount: amount,
            timestamp: payment.created_at,
            transaction_date: payment.created_at,
            currency: payment.amount_money?.currency || 'GBP',
            order_id: payment.order_id,
            sync_status: 'synced'
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Transaction.update(existing[0].id, txData);
          } else {
            await base44.asServiceRole.entities.Transaction.create(txData);
          }
          totalSynced++;
        }
        results.payments = paymentsData.payments?.length || 0;
      } catch (err) {
        console.error('Payment sync error:', err);
        results.payments_error = err.message;
      }
    }

    // Sync Timecards (today)
    if (entity_types.includes('timecards')) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const shiftsRes = await fetch(`${baseUrl}/labor/timecards/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: {
              filter: {
                start_at: { start_at: today.toISOString(), end_at: tomorrow.toISOString() }
              }
            }
          })
        });
        const shiftsData = await shiftsRes.json();
        
        for (const shift of shiftsData.timecards || []) {
          const existing = await base44.asServiceRole.entities.Shift.filter({
            organization_id: orgId,
            square_timecard_id: shift.id
          });

          const shiftData = {
            organization_id: orgId,
            square_timecard_id: shift.id,
            square_team_member_id: shift.team_member_id,
            square_location_id: shift.location_id,
            start_at: shift.start_at,
            end_at: shift.end_at,
            status: shift.state === 'CLOSED' ? 'closed' : 'open',
            tip_eligible: true
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.Shift.update(existing[0].id, shiftData);
          } else {
            await base44.asServiceRole.entities.Shift.create(shiftData);
          }
          totalSynced++;
        }
        results.timecards = shiftsData.timecards?.length || 0;
      } catch (err) {
        console.error('Timecard sync error:', err);
        results.timecards_error = err.message;
      }
    }

    // Log sync
    await base44.asServiceRole.entities.SyncLogs.create({
      organization_id: orgId,
      sync_type: 'manual',
      status: 'success',
      records_synced: totalSynced,
      timestamp: new Date().toISOString(),
      details: results
    });

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      records_synced: totalSynced,
      results,
      duration_ms: duration
    });

  } catch (error) {
    console.error('Sync error:', error);
    
    try {
      const base44 = createClientFromRequest(req);
      const body = await req.json();
      if (body.connection_id) {
        const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: body.connection_id });
        if (connections.length > 0) {
          await base44.asServiceRole.entities.SyncLogs.create({
            organization_id: connections[0].organization_id,
            sync_type: 'manual',
            status: 'error',
            records_synced: 0,
            error_message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }

    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});