import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { payment_id } = await req.json();

    if (!payment_id) {
      return Response.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    // Get payment
    const payments = await base44.asServiceRole.entities.Payment.filter({ id: payment_id });
    if (payments.length === 0) {
      return Response.json({ error: 'Payment not found' }, { status: 404 });
    }

    const payment = payments[0];

    if (payment.status !== 'refunded') {
      return Response.json({ error: 'Payment is not refunded' }, { status: 400 });
    }

    // Find allocation lines for this payment
    const allLines = await base44.asServiceRole.entities.TipAllocationLine.filter({
      organization_id: payment.organization_id,
      payment_id: payment_id
    });

    if (allLines.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No allocations found for this payment (not yet allocated or payment has no tips)' 
      });
    }

    // Check if any of these allocations are in exported batches
    const batchIds = [...new Set(allLines.map(l => l.allocation_batch_id))];
    const batches = await base44.asServiceRole.entities.TipAllocationBatch.filter({
      organization_id: payment.organization_id
    });

    const exportedBatches = batches.filter(b => 
      batchIds.includes(b.id) && b.status === 'exported'
    );

    if (exportedBatches.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Allocations not yet exported, no adjustment needed' 
      });
    }

    // Create negative adjustments for each allocation
    const adjustments = [];
    for (const line of allLines) {
      const batch = exportedBatches.find(b => b.id === line.allocation_batch_id);
      if (batch) {
        // Create negative adjustment
        const adjustment = await base44.asServiceRole.entities.Adjustment.create({
          organization_id: payment.organization_id,
          allocation_line_id: line.id,
          allocation_batch_id: line.allocation_batch_id,
          employee_id: line.employee_id,
          adjustment_type: 'clawback',
          adjustment_amount: -line.gross_amount,
          reason: `Automatic clawback: Payment ${payment.square_payment_id} was refunded after export`,
          created_by_email: 'system@tipalign.com',
          status: 'approved',
          approved_by_email: 'system@tipalign.com',
          approved_at: new Date().toISOString()
        });

        adjustments.push(adjustment);

        // Update employee pending tips
        const employees = await base44.asServiceRole.entities.Employee.filter({ 
          id: line.employee_id 
        });
        if (employees.length > 0) {
          const currentPending = employees[0].pending_tips || 0;
          await base44.asServiceRole.entities.Employee.update(employees[0].id, {
            pending_tips: currentPending - line.gross_amount
          });
        }
      }
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: payment.organization_id,
      event_type: 'adjustment_created',
      actor_type: 'system',
      entity_type: 'adjustment',
      entity_id: adjustments[0]?.id,
      after_snapshot: {
        payment_id: payment_id,
        refund_date: payment.refunded_at,
        adjustments_count: adjustments.length,
        total_clawback: adjustments.reduce((sum, a) => sum + a.adjustment_amount, 0)
      },
      changes_summary: `Automatic clawback adjustments created for refunded payment after export`,
      reason: `Payment ${payment.square_payment_id} refunded after allocations were exported`,
      hmrc_relevant: true,
      severity: 'warning'
    });

    return Response.json({
      success: true,
      adjustments_created: adjustments.length,
      total_clawback: adjustments.reduce((sum, a) => sum + a.adjustment_amount, 0),
      message: `Created ${adjustments.length} clawback adjustments for refunded payment`
    });

  } catch (error) {
    console.error('Handle refund after export error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});