import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      allocation_line_id, 
      adjustment_type, 
      adjustment_amount, 
      reason,
      related_dispute_id 
    } = await req.json();

    if (!allocation_line_id || !adjustment_type || !adjustment_amount || !reason) {
      return Response.json({ 
        error: 'Missing required fields: allocation_line_id, adjustment_type, adjustment_amount, reason' 
      }, { status: 400 });
    }

    // Get allocation line
    const lines = await base44.asServiceRole.entities.TipAllocationLine.filter({ id: allocation_line_id });
    if (lines.length === 0) {
      return Response.json({ error: 'Allocation line not found' }, { status: 404 });
    }

    const line = lines[0];

    // Check if batch is locked
    const batches = await base44.asServiceRole.entities.TipAllocationBatch.filter({ id: line.allocation_batch_id });
    const batch = batches[0];

    if (batch.status !== 'finalised' && batch.status !== 'exported') {
      return Response.json({ 
        error: 'Can only create adjustments for finalised or exported batches' 
      }, { status: 400 });
    }

    // Check permissions
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    const isManager = user.role === 'manager';

    if (!isAdmin && !isManager) {
      return Response.json({ error: 'Only admins or managers can create adjustments' }, { status: 403 });
    }

    // Create adjustment
    const adjustment = await base44.asServiceRole.entities.Adjustment.create({
      organization_id: line.organization_id,
      allocation_line_id: allocation_line_id,
      allocation_batch_id: line.allocation_batch_id,
      employee_id: line.employee_id,
      adjustment_type: adjustment_type,
      adjustment_amount: adjustment_amount,
      reason: reason,
      created_by_email: user.email,
      status: 'pending',
      related_dispute_id: related_dispute_id || null
    });

    // Auto-approve if admin
    if (isAdmin) {
      await base44.asServiceRole.entities.Adjustment.update(adjustment.id, {
        status: 'approved',
        approved_by_email: user.email,
        approved_at: new Date().toISOString()
      });

      // Update employee pending tips
      const employee = await base44.asServiceRole.entities.Employee.filter({ id: line.employee_id });
      if (employee.length > 0) {
        const currentPending = employee[0].pending_tips || 0;
        await base44.asServiceRole.entities.Employee.update(employee[0].id, {
          pending_tips: currentPending + adjustment_amount
        });
      }
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: line.organization_id,
      event_type: 'adjustment_created',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'adjustment',
      entity_id: adjustment.id,
      after_snapshot: {
        allocation_line_id: allocation_line_id,
        adjustment_type: adjustment_type,
        adjustment_amount: adjustment_amount,
        employee_id: line.employee_id
      },
      changes_summary: `${adjustment_type} adjustment of ${adjustment_amount} pence created`,
      reason: reason,
      hmrc_relevant: true,
      severity: adjustment_amount < 0 ? 'warning' : 'info'
    });

    // If related to dispute, update dispute
    if (related_dispute_id) {
      await base44.asServiceRole.entities.Dispute.update(related_dispute_id, {
        adjustment_id: adjustment.id
      });
    }

    return Response.json({
      success: true,
      adjustment_id: adjustment.id,
      status: isAdmin ? 'approved' : 'pending'
    });

  } catch (error) {
    console.error('Create adjustment error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});