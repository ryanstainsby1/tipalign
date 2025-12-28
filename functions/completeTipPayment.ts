import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { payment_id, employee_id, pass_serial } = await req.json();

    if (!payment_id || !employee_id) {
      return Response.json({
        success: false,
        error: 'Missing payment_id or employee_id'
      }, { status: 400 });
    }

    // Find the pending payment
    const payments = await base44.asServiceRole.entities.Payment.filter({
      square_payment_id: `wallet_${payment_id}`,
      status: 'pending'
    });

    if (payments.length === 0) {
      return Response.json({
        success: false,
        error: 'Payment not found'
      }, { status: 404 });
    }

    const payment = payments[0];

    // Update payment status to completed
    await base44.asServiceRole.entities.Payment.update(payment.id, {
      status: 'completed'
    });

    // Run tip allocation engine
    try {
      await base44.asServiceRole.functions.invoke('tipAllocationEngine', {
        payment_id: payment.id,
        employee_id,
        amount: payment.tip_amount,
        source: 'wallet_pass'
      });
    } catch (allocError) {
      console.error('Allocation engine error:', allocError);
      // Continue even if allocation fails - can be retried later
    }

    // Update employee's wallet pass
    try {
      await base44.asServiceRole.functions.invoke('updateEmployeeWalletPassTips', {
        employee_id
      });
    } catch (walletError) {
      console.error('Wallet update error:', walletError);
      // Non-critical - pass will update on next schedule
    }

    // Log completion audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'tip_allocated',
      entity_type: 'payment',
      entity_id: payment.id,
      actor_email: 'wallet_guest',
      actor_role: 'system',
      reason: `Wallet tip payment completed: £${(payment.tip_amount/100).toFixed(2)}`,
      hmrc_relevant: true
    });

    return Response.json({
      success: true,
      payment_id,
      amount: payment.tip_amount,
      message: 'Tip payment completed successfully'
    });

  } catch (error) {
    console.error('Complete tip payment error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});