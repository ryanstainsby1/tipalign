import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // This can be called by system or user
    let actor_email = 'system';
    let actor_role = 'system';
    
    try {
      const user = await base44.auth.me();
      if (user) {
        actor_email = user.email;
        actor_role = user.role || 'user';
      }
    } catch {
      // System call without auth
    }

    const { 
      event_type, 
      entity_type, 
      entity_id, 
      changes, 
      severity = 'info',
      reason = '',
      hmrc_relevant = false 
    } = await req.json();

    if (!event_type || !entity_type) {
      return Response.json({ 
        error: 'Missing required fields: event_type, entity_type' 
      }, { status: 400 });
    }

    // Generate immutable hash for audit trail integrity
    const auditData = {
      event_type,
      entity_type,
      entity_id,
      actor_email,
      timestamp: new Date().toISOString(),
      changes: JSON.stringify(changes || {})
    };
    
    const hashInput = JSON.stringify(auditData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const immutable_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Create audit log entry (non-blocking, async)
    const auditLog = await base44.asServiceRole.entities.AuditLog.create({
      action_type: event_type,
      entity_type,
      entity_id: entity_id || null,
      actor_email,
      actor_role,
      previous_value: changes?.previous ? JSON.stringify(changes.previous) : null,
      new_value: changes?.new ? JSON.stringify(changes.new) : null,
      reason: reason || `${event_type} on ${entity_type}`,
      hmrc_relevant,
      immutable_hash
    });

    return Response.json({
      success: true,
      audit_id: auditLog.id,
      timestamp: auditLog.created_date,
      hash: immutable_hash
    });

  } catch (error) {
    console.error('Audit log event error:', error);
    // Don't fail the parent operation if audit logging fails
    return Response.json({ 
      success: false,
      error: error.message,
      warning: 'Audit log failed but operation may have succeeded'
    }, { status: 200 });
  }
});