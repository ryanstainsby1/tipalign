import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const SQUARE_ENVIRONMENT = (Deno.env.get('SQUARE_ENVIRONMENT') || 'production')
  .toLowerCase()
  .trim();

const SQUARE_API_BASE =
  SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'method_not_allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'invalid_json_body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { connection_id, start_date, end_date } = body;

    if (!connection_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'connection_id_required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const connection = await base44.asServiceRole.entities.SquareConnection.retrieve(connection_id);

    if (!connection) {
      return new Response(
        JSON.stringify({ success: false, error: 'connection_not_found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (connection.connection_status !== 'connected') {
      return new Response(
        JSON.stringify({ success: false, error: 'connection_not_active' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = (connection.square_access_token_encrypted || '').trim();
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'missing_access_token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Date range: default last 30 days if not provided
    const today = new Date();
    const defaultEnd = today.toISOString().substring(0, 10);
    const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .substring(0, 10);

    const startDate = (start_date || defaultStart) + 'T00:00:00Z';
    const endDate = (end_date || defaultEnd) + 'T23:59:59Z';

    console.log(`Syncing sales from ${startDate} to ${endDate}`);

    // Fetch all locations once
    const locationsRes = await fetch(`${SQUARE_API_BASE}/v2/locations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18',
        'Content-Type': 'application/json',
      },
    });

    if (!locationsRes.ok) {
      const text = await locationsRes.text();
      console.error('Square locations error', locationsRes.status, text);
      return new Response(
        JSON.stringify({
          success: false,
          step: 'locations',
          status: locationsRes.status,
          error: 'square_locations_failed',
          details: text,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const locJson = await locationsRes.json();
    const locations = locJson.locations || [];

    let totalPayments = 0;
    let createdSummaries = 0;
    let updatedSummaries = 0;

    for (const loc of locations) {
      const locationId = loc.id;
      if (!locationId) continue;

      console.log(`Processing location: ${loc.name} (${locationId})`);
      let cursor = undefined;

      do {
        const params = new URLSearchParams({
          location_id: locationId,
          begin_time: startDate,
          end_time: endDate,
          sort_order: 'ASC',
        });
        if (cursor) params.set('cursor', cursor);

        const paymentsRes = await fetch(
          `${SQUARE_API_BASE}/v2/payments?` + params.toString(),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Square-Version': '2024-12-18',
              'Content-Type': 'application/json',
            },
          }
        );

        if (!paymentsRes.ok) {
          const text = await paymentsRes.text();
          console.error('Square payments error', { locationId, status: paymentsRes.status, text });
          break;
        }

        const payJson = await paymentsRes.json();
        const payments = payJson.payments || [];
        cursor = payJson.cursor || undefined;

        console.log(`  - Fetched ${payments.length} payments${cursor ? ' (more pages)' : ''}`);

        for (const p of payments) {
          totalPayments += 1;

          const paymentId = p.id;
          if (!paymentId) continue;

          const amountMoney = p.amount_money || {};
          const totalMoney = p.total_money || {};
          const tipMoney = p.tip_money || {};
          const grossAmount = amountMoney.amount ?? 0;
          const totalAmount = totalMoney.amount ?? 0;
          const tipAmount = tipMoney.amount ?? 0;

          const processingFees = p.processing_fee || [];
          const totalFees = processingFees.reduce(
            (sum, f) => sum + (f.amount_money?.amount ?? 0),
            0
          );
          const netAmount = totalAmount - totalFees;

          const payload = {
            organization_id: connection.organization_id,
            location_id: locationId,
            square_payment_id: paymentId,
            square_order_id: p.order_id || null,
            payment_created_at: p.created_at || null,
            gross_amount_pence: grossAmount,
            tip_amount_pence: tipAmount,
            total_amount_pence: totalAmount,
            processing_fee_pence: totalFees,
            net_amount_pence: netAmount,
            team_member_id: p.team_member_id || null,
            source: p.source_type || null,
            card_brand: p.card_details?.card?.card_brand || (p.cash_details ? 'CASH' : null),
            synced_at: new Date().toISOString(),
          };

          if (!base44.asServiceRole.entities.SquarePaymentSummary) {
            console.error('Entity SquarePaymentSummary is not defined');
            return new Response(
              JSON.stringify({ success: false, error: 'entity_SquarePaymentSummary_missing' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const existing = await base44.asServiceRole.entities.SquarePaymentSummary.filter(
            {
              organization_id: connection.organization_id,
              square_payment_id: paymentId,
            },
            '-created_date',
            1
          );

          if (existing.length > 0) {
            await base44.asServiceRole.entities.SquarePaymentSummary.update(
              existing[0].id,
              payload
            );
            updatedSummaries += 1;
          } else {
            await base44.asServiceRole.entities.SquarePaymentSummary.create(
              payload
            );
            createdSummaries += 1;
          }
        }
      } while (cursor);
    }

    console.log(`Total payments processed: ${totalPayments}`);

    // Daily aggregation
    console.log('Computing daily revenue summaries...');
    let dailySummariesCreated = 0;
    let dailySummariesUpdated = 0;

    const allLocations = await base44.asServiceRole.entities.Location.filter({
      organization_id: connection.organization_id,
    });

    for (const location of allLocations) {
      const allPayments = await base44.asServiceRole.entities.SquarePaymentSummary.list(
        '-payment_created_at',
        5000
      );
      const locationPayments = allPayments.filter(
        (p) =>
          p.organization_id === connection.organization_id &&
          p.location_id === location.square_location_id
      );

      const dailyData = {};

      for (const payment of locationPayments) {
        const paymentDate = new Date(payment.payment_created_at);
        const businessDate = paymentDate.toISOString().split('T')[0];

        if (!dailyData[businessDate]) {
          dailyData[businessDate] = {
            gross: 0,
            tips: 0,
            net: 0,
            count: 0,
          };
        }

        dailyData[businessDate].gross += payment.gross_amount_pence;
        dailyData[businessDate].tips += payment.tip_amount_pence;
        dailyData[businessDate].net += payment.net_amount_pence;
        dailyData[businessDate].count += 1;
      }

      for (const [businessDate, data] of Object.entries(dailyData)) {
        const avgTipPercent =
          data.gross > 0 ? Math.round((data.tips / data.gross) * 100 * 100) / 100 : 0;

        const existing = await base44.asServiceRole.entities.DailyRevenueSummary.filter({
          organization_id: connection.organization_id,
          location_id: location.id,
          business_date: businessDate,
        });

        const summaryData = {
          organization_id: connection.organization_id,
          location_id: location.id,
          business_date: businessDate,
          total_gross_revenue_pence: data.gross,
          total_tip_pence: data.tips,
          total_net_revenue_pence: data.net,
          avg_tip_percent: avgTipPercent,
          transaction_count: data.count,
        };

        if (existing.length > 0) {
          await base44.asServiceRole.entities.DailyRevenueSummary.update(
            existing[0].id,
            summaryData
          );
          dailySummariesUpdated += 1;
        } else {
          await base44.asServiceRole.entities.DailyRevenueSummary.create(summaryData);
          dailySummariesCreated += 1;
        }
      }
    }

    console.log(`Daily summaries: ${dailySummariesCreated} created, ${dailySummariesUpdated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        total_payments: totalPayments,
        created_summaries: createdSummaries,
        updated_summaries: updatedSummaries,
        daily_summaries_created: dailySummariesCreated,
        daily_summaries_updated: dailySummariesUpdated,
        environment: SQUARE_ENVIRONMENT,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('squareSalesSync fatal error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'unexpected_error',
        message: err.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});