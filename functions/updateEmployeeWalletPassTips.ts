import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { employee_id, refresh_all = false } = await req.json();

    if (!employee_id && !refresh_all) {
      return Response.json({ error: 'Missing employee_id or refresh_all flag' }, { status: 400 });
    }

    let passesToUpdate = [];

    if (refresh_all) {
      // Update all active passes
      passesToUpdate = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
        pass_status: 'active'
      });
      console.log(`Refreshing ${passesToUpdate.length} active passes`);
    } else {
      // Update specific employee's pass
      passesToUpdate = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
        employee_id,
        pass_status: 'active'
      });
    }

    const results = [];

    for (const walletPass of passesToUpdate) {
      try {
        // Fetch employee
        const employees = await base44.asServiceRole.entities.Employee.filter({ 
          id: walletPass.employee_id 
        });

        if (employees.length === 0) continue;

        const employee = employees[0];

        // Calculate tip metrics
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const allAllocations = await base44.asServiceRole.entities.TipAllocation.filter({
          employee_id: employee.id
        });

        const currentPeriodAllocations = allAllocations.filter(a => {
          const allocDate = new Date(a.allocation_date);
          return allocDate >= sevenDaysAgo && allocDate <= now;
        });

        const currentPeriodTotal = currentPeriodAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);
        const lifetimeTotal = allAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);

        // Update pass record
        await base44.asServiceRole.entities.EmployeeWalletPass.update(walletPass.id, {
          last_pass_update_at: new Date().toISOString(),
          last_tip_total: currentPeriodTotal,
          last_period_start: sevenDaysAgo.toISOString().split('T')[0],
          last_period_end: now.toISOString().split('T')[0]
        });

        // In production, send push notification to Apple Wallet
        // This requires calling Apple's webServiceURL endpoints
        // POST https://api.push.apple.com/...
        // With proper certificates and device tokens

        results.push({
          employee_id: employee.id,
          employee_name: employee.full_name,
          serial: walletPass.pass_serial_number,
          updated: true,
          current_period_total: currentPeriodTotal,
          lifetime_total: lifetimeTotal
        });

        // Log audit event
        await base44.asServiceRole.entities.AuditLog.create({
          action_type: 'employee_wallet_pass_updated',
          entity_type: 'wallet_pass',
          entity_id: walletPass.id,
          actor_email: 'system',
          actor_role: 'system',
          reason: `Wallet pass updated for ${employee.full_name} - Current: £${(currentPeriodTotal/100).toFixed(2)}`,
          hmrc_relevant: false
        });

      } catch (error) {
        console.error(`Failed to update pass ${walletPass.id}:`, error);
        results.push({
          employee_id: walletPass.employee_id,
          serial: walletPass.pass_serial_number,
          updated: false,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      passes_updated: results.filter(r => r.updated).length,
      passes_failed: results.filter(r => !r.updated).length,
      results
    });

  } catch (error) {
    console.error('Update wallet pass tips error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});