import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dispute_id, resolution, resolution_notes, create_adjustment, adjustment_amount } = await req.json();

    if (!dispute_id || !resolution || !resolution_notes) {
      return Response.json({ 
        error: 'Missing required fields: dispute_id, resolution, resolution_notes' 
      }, { status: 400 });
    }

    // Check permissions
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    const isManager = user.role === 'manager';

    if (!isAdmin && !isManager) {
      return Response.json({ error: 'Only admins or managers can resolve disputes' }, { status: 403 });
    }

    // Get dispute
    const disputes = await base44.asServiceRole.entities.Dispute.filter({ id: dispute_id });
    if (disputes.length === 0) {
      return Response.json({ error: 'Dispute not found' }, { status: 404 });
    }

    const dispute = disputes[0];

    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      return Response.json({ error: 'Dispute already resolved' }, { status: 400 });
    }

    // Update dispute
    await base44.asServiceRole.entities.Dispute.update(dispute_id, {
      status: resolution,
      resolution_notes: resolution_notes,
      resolved_at: new Date().toISOString(),
      resolved_by_email: user.email,
      assigned_to_email: user.email
    });

    let adjustmentId = null;

    // Create adjustment if requested
    if (create_adjustment && adjustment_amount && resolution === 'resolved') {
      const adjustmentResponse = await base44.asServiceRole.functions.invoke('createAdjustment', {
        allocation_line_id: dispute.allocation_line_id,
        adjustment_type: 'dispute_resolution',
        adjustment_amount: adjustment_amount,
        reason: `Dispute resolved: ${resolution_notes}`,
        related_dispute_id: dispute_id
      });

      adjustmentId = adjustmentResponse.data?.adjustment_id;
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: dispute.organization_id,
      event_type: 'dispute_resolved',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'dispute',
      entity_id: dispute_id,
      before_snapshot: { status: dispute.status },
      after_snapshot: { 
        status: resolution, 
        resolution_notes: resolution_notes,
        adjustment_created: !!adjustmentId 
      },
      changes_summary: `Dispute ${resolution}`,
      reason: resolution_notes,
      hmrc_relevant: !!adjustmentId,
      severity: resolution === 'rejected' ? 'info' : 'warning'
    });

    return Response.json({
      success: true,
      dispute_id: dispute_id,
      resolution: resolution,
      adjustment_id: adjustmentId
    });

  } catch (error) {
    console.error('Resolve dispute error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});