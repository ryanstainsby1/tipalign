import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id, days = 90 } = body;

    console.log('=== AGGREGATE DAILY SUMMARIES ===');

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

    // Get all payments
    console.log('Fetching payments...');
    const allPayments = await base44.asServiceRole.entities.SquarePaymentSummary.filter({ organization_id: orgId });
    await wait(300);
    console.log('Found', allPayments.length, 'payments');

    // Get locations for mapping
    const locations = await base44.asServiceRole.entities.Location.filter({ organization_id: orgId });
    await wait(300);
    
    const locNameMap = new Map();
    for (const loc of locations) {
      locNameMap.set(loc.id, loc.name);
    }

    // Aggregate by date and location
    const dailyData = new Map();

    for (const p of allPayments) {
      if (!p.payment_created_at) continue;
      
      const date = p.payment_created_at.split('T')[0];
      const locId = p.location_id || 'unknown';
      const key = date + '|' + locId;

      if (!dailyData.has(key)) {
        dailyData.set(key, {
          date: date,
          location_id: locId,
          location_name: locNameMap.get(locId) || 'Unknown',
          gross_revenue_pence: 0,
          tips_pence: 0,
          fees_pence: 0,
          net_revenue_pence: 0,
          transaction_count: 0,
          tips_count: 0
        });
      }

      const daily = dailyData.get(key);
      daily.gross_revenue_pence += p.gross_amount_pence || 0;
      daily.tips_pence += p.tip_amount_pence || 0;
      daily.fees_pence += p.processing_fee_pence || 0;
      daily.net_revenue_pence += p.net_amount_pence || 0;
      daily.transaction_count += 1;
      if (p.tip_amount_pence && p.tip_amount_pence > 0) {
        daily.tips_count += 1;
      }
    }

    console.log('Aggregated into', dailyData.size, 'daily summaries');

    // Get existing daily summaries
    let existingSummaries = [];
    try {
      existingSummaries = await base44.asServiceRole.entities.DailyRevenueSummary.filter({ organization_id: orgId });
      await wait(300);
    } catch (e) {
      console.log('DailyRevenueSummary may not exist:', e.message);
    }

    // Build lookup map
    const existingMap = new Map();
    for (const s of existingSummaries) {
      const key = s.business_date + '|' + s.location_id;
      existingMap.set(key, s);
    }

    // Create or update daily summaries
    let created = 0;
    let updated = 0;

    for (const [key, data] of dailyData) {
      const summaryData = {
        organization_id: orgId,
        location_id: data.location_id,
        business_date: data.date,
        total_gross_revenue_pence: data.gross_revenue_pence,
        total_tip_pence: data.tips_pence,
        total_net_revenue_pence: data.net_revenue_pence,
        avg_tip_percent: data.gross_revenue_pence > 0 ? (data.tips_pence / data.gross_revenue_pence) * 100 : 0,
        transaction_count: data.transaction_count
      };

      try {
        const existing = existingMap.get(key);
        
        if (existing) {
          await base44.asServiceRole.entities.DailyRevenueSummary.update(existing.id, summaryData);
          updated++;
        } else {
          await base44.asServiceRole.entities.DailyRevenueSummary.create(summaryData);
          created++;
        }
        
        await wait(200);
      } catch (e) {
        console.error('Summary save error:', e.message);
      }
    }

    // Calculate totals for verification
    let totalRevenue = 0;
    let totalTips = 0;
    for (const [, data] of dailyData) {
      totalRevenue += data.gross_revenue_pence;
      totalTips += data.tips_pence;
    }

    const duration = Date.now() - startTime;

    console.log('=== AGGREGATION COMPLETE ===');

    return Response.json({
      success: true,
      summary: {
        payments_processed: allPayments.length,
        daily_summaries_created: created,
        daily_summaries_updated: updated,
        total_days: dailyData.size,
        total_revenue_gbp: '£' + (totalRevenue / 100).toFixed(2),
        total_tips_gbp: '£' + (totalTips / 100).toFixed(2),
        tip_rate: totalRevenue > 0 ? ((totalTips / totalRevenue) * 100).toFixed(2) + '%' : '0%'
      },
      duration_ms: duration,
      message: 'Dashboard should now show correct data!'
    });

  } catch (error) {
    console.error('Aggregation error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});