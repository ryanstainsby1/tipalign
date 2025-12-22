import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHash } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batch_id, action } = await req.json();
    
    if (!batch_id || !action) {
      return Response.json({ error: 'Missing batch_id or action' }, { status: 400 });
    }

    // Get batch
    const batches = await base44.asServiceRole.entities.TipAllocationBatch.filter({ id: batch_id });
    if (batches.length === 0) {
      return Response.json({ error: 'Batch not found' }, { status: 404 });
    }

    const batch = batches[0];

    // Check permissions
    const isAdmin = user.role === 'admin' || user.role === 'owner';
    const isManager = user.role === 'manager';

    if (action === 'finalise') {
      if (batch.status !== 'draft' && batch.status !== 'pending_approval') {
        return Response.json({ error: 'Batch must be in draft or pending_approval status' }, { status: 400 });
      }

      if (!isAdmin && !isManager) {
        return Response.json({ error: 'Only admins or managers can finalise batches' }, { status: 403 });
      }

      // Get all allocation lines
      const lines = await base44.asServiceRole.entities.TipAllocationLine.filter({
        allocation_batch_id: batch_id
      });

      // Generate audit hashes for each line
      for (const line of lines) {
        const hashData = JSON.stringify({
          payment_id: line.payment_id,
          employee_id: line.employee_id,
          gross_amount: line.gross_amount,
          allocation_method: line.allocation_method,
          timestamp: new Date().toISOString()
        });
        const hash = createHash('sha256').update(hashData).digest('hex');

        await base44.asServiceRole.entities.TipAllocationLine.update(line.id, {
          audit_hash: hash,
          immutable: true
        });
      }

      // Update batch
      await base44.asServiceRole.entities.TipAllocationBatch.update(batch_id, {
        status: 'finalised',
        finalised_at: new Date().toISOString(),
        finalised_by_email: user.email,
        immutable: true
      });

      // Create audit event
      await base44.asServiceRole.entities.SystemAuditEvent.create({
        organization_id: batch.organization_id,
        event_type: 'allocation_batch_finalised',
        actor_type: 'user',
        actor_user_id: user.id,
        actor_email: user.email,
        entity_type: 'allocation_batch',
        entity_id: batch_id,
        before_snapshot: { status: batch.status },
        after_snapshot: { status: 'finalised', lines_count: lines.length },
        changes_summary: `Batch finalised with ${lines.length} allocations`,
        hmrc_relevant: true,
        severity: 'info'
      });

      return Response.json({
        success: true,
        message: 'Batch finalised successfully',
        batch_id: batch_id,
        lines_locked: lines.length
      });

    } else if (action === 'export') {
      if (batch.status !== 'finalised') {
        return Response.json({ error: 'Batch must be finalised before export' }, { status: 400 });
      }

      if (!isAdmin) {
        return Response.json({ error: 'Only admins can export batches' }, { status: 403 });
      }

      // Update batch to exported
      await base44.asServiceRole.entities.TipAllocationBatch.update(batch_id, {
        status: 'exported'
      });

      // Create export run record
      const exportRun = await base44.asServiceRole.entities.ExportRun.create({
        organization_id: batch.organization_id,
        export_type: 'payroll',
        export_format: 'csv',
        period_start: batch.allocation_period_start,
        period_end: batch.allocation_period_end,
        location_filter: [batch.location_id],
        allocation_batch_ids: [batch_id],
        total_tips_exported: batch.total_tips_allocated,
        employee_count: batch.employee_count,
        line_count: batch.employee_count,
        status: 'ready',
        generated_by_email: user.email
      });

      // Create audit event
      await base44.asServiceRole.entities.SystemAuditEvent.create({
        organization_id: batch.organization_id,
        event_type: 'export_generated',
        actor_type: 'user',
        actor_user_id: user.id,
        actor_email: user.email,
        entity_type: 'allocation_batch',
        entity_id: batch_id,
        before_snapshot: { status: 'finalised' },
        after_snapshot: { status: 'exported', export_run_id: exportRun.id },
        changes_summary: `Batch exported to payroll`,
        hmrc_relevant: true,
        severity: 'info'
      });

      return Response.json({
        success: true,
        message: 'Batch exported successfully',
        export_run_id: exportRun.id,
        batch_id: batch_id
      });

    } else {
      return Response.json({ error: 'Invalid action. Must be "finalise" or "export"' }, { status: 400 });
    }

  } catch (error) {
    console.error('Finalise batch error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});