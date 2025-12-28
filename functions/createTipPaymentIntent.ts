import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { employee_id, pass_serial, amount, note, source } = await req.json();

    // Validate amount range (£1 - £200 in pence)
    if (!amount || amount < 100 || amount > 20000) {
      return Response.json({
        success: false,
        error: 'Amount must be between £1 and £200'
      }, { status: 400 });
    }

    // Validate employee and pass
    const employees = await base44.asServiceRole.entities.Employee.filter({
      id: employee_id,
      employment_status: 'active'
    });

    if (employees.length === 0) {
      return Response.json({
        success: false,
        error: 'Employee not found'
      }, { status: 404 });
    }

    const employee = employees[0];

    const passes = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id,
      pass_serial_number: pass_serial,
      pass_status: 'active'
    });

    if (passes.length === 0) {
      return Response.json({
        success: false,
        error: 'Invalid tipping link'
      }, { status: 403 });
    }

    // Get organization's Square connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      organization_id: employee.organization_id,
      connection_status: 'connected'
    });

    if (connections.length === 0) {
      return Response.json({
        success: false,
        error: 'Payment processing not configured'
      }, { status: 500 });
    }

    // In production: Create Square payment using Square API
    // For now, create a pending payment record
    
    const paymentId = crypto.randomUUID();
    
    // Create a pending transaction record
    await base44.asServiceRole.entities.Payment.create({
      organization_id: employee.organization_id,
      square_payment_id: `wallet_${paymentId}`,
      square_location_id: employee.locations?.[0] || 'wallet',
      location_id: null,
      square_team_member_id: employee.square_team_member_id,
      employee_id: employee.id,
      payment_date: new Date().toISOString(),
      total_amount: amount,
      tip_amount: amount,
      currency: 'GBP',
      payment_source_type: 'WALLET_PASS',
      status: 'pending'
    });

    // Log audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'tip_allocated',
      entity_type: 'payment',
      entity_id: paymentId,
      actor_email: 'wallet_guest',
      actor_role: 'system',
      reason: `Wallet tip payment initiated for ${employee.full_name}: £${(amount/100).toFixed(2)}`,
      new_value: JSON.stringify({ amount, note, source }),
      hmrc_relevant: true
    });

    // In production, you would:
    // 1. Initialize Square Payment API
    // 2. Create a payment or checkout session
    // 3. Return payment URL or client token

    return Response.json({
      success: true,
      payment_id: paymentId,
      payment_url: `https://square.link/demo-payment/${paymentId}`,
      amount,
      employee_name: employee.full_name
    });

  } catch (error) {
    console.error('Create tip payment intent error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});