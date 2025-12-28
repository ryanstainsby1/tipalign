import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, employee_id, pass_serial, amount, metadata } = await req.json();

    if (!event || !employee_id) {
      return Response.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const validEvents = [
      'wallet_pass_opened',
      'wallet_qr_scanned',
      'wallet_tip_started',
      'wallet_tip_completed'
    ];

    if (!validEvents.includes(event)) {
      return Response.json({
        success: false,
        error: 'Invalid event type'
      }, { status: 400 });
    }

    // Get employee info
    const employees = await base44.asServiceRole.entities.Employee.filter({
      id: employee_id
    });

    if (employees.length === 0) {
      return Response.json({
        success: false,
        error: 'Employee not found'
      }, { status: 404 });
    }

    const employee = employees[0];

    // Log the analytics event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'tip_allocated',
      entity_type: 'wallet_pass',
      entity_id: pass_serial || employee_id,
      actor_email: 'wallet_analytics',
      actor_role: 'system',
      reason: `Wallet event: ${event}${amount ? ` - £${(amount/100).toFixed(2)}` : ''}`,
      new_value: JSON.stringify({
        event,
        employee_id,
        employee_name: employee.full_name,
        pass_serial,
        amount,
        metadata,
        timestamp: new Date().toISOString()
      }),
      hmrc_relevant: false
    });

    return Response.json({
      success: true,
      event,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Track wallet event error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});