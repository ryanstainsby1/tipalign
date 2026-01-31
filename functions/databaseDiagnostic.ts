import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id } = body;

    console.log('=== DATABASE DIAGNOSTIC ===');

    // Get connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
    if (connections.length === 0) {
      return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }
    
    const connection = connections[0];
    const orgId = connection.organization_id;

    // Get ALL payments from database
    const allPayments = await base44.asServiceRole.entities.SquarePaymentSummary.filter({ organization_id: orgId });
    
    // Calculate totals from what's actually in the database
    let dbRevenue = 0;
    let dbTips = 0;
    let dbCount = 0;
    
    const samplePayments = [];
    
    for (const p of allPayments) {
      dbRevenue += p.gross_amount_pence || 0;
      dbTips += p.tip_amount_pence || 0;
      dbCount++;
      
      if (samplePayments.length < 5) {
        samplePayments.push({
          id: p.id,
          square_payment_id: p.square_payment_id,
          gross: p.gross_amount_pence,
          tip: p.tip_amount_pence,
          total: p.total_amount_pence,
          created: p.payment_created_at,
          synced: p.synced_at
        });
      }
    }

    // Get allocations
    let allocations = [];
    try {
      allocations = await base44.asServiceRole.entities.TipAllocation.filter({ organization_id: orgId });
    } catch (e) {}

    // Get employees
    const employees = await base44.asServiceRole.entities.Employee.filter({ organization_id: orgId });

    return Response.json({
      success: true,
      organization_id: orgId,
      database_contents: {
        payments_count: dbCount,
        total_revenue_pence: dbRevenue,
        total_revenue_gbp: '£' + (dbRevenue / 100).toFixed(2),
        total_tips_pence: dbTips,
        total_tips_gbp: '£' + (dbTips / 100).toFixed(2),
        tip_rate: dbRevenue > 0 ? ((dbTips / dbRevenue) * 100).toFixed(2) + '%' : '0%'
      },
      allocations_count: allocations.length,
      employees_count: employees.length,
      sample_payments: samplePayments,
      message: 'This is what is ACTUALLY in your database right now'
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});