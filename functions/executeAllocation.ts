import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Calculate allocation based on rule set
function calculateAllocation(ruleSet, payments, employees, shifts) {
  const allocations = [];
  const explanations = [];

  const rules = ruleSet.rule_definition;
  const method = ruleSet.allocation_method;

  // Filter active employees
  const activeEmployees = employees.filter(e => 
    rules.pool_roles?.includes(e.role) && e.employment_status === 'active'
  );

  if (method === 'individual') {
    // Direct attribution - tips go to the employee who processed the payment
    for (const payment of payments) {
      if (payment.tip_amount > 0 && payment.employee_id) {
        const employee = employees.find(e => e.id === payment.employee_id);
        if (employee) {
          allocations.push({
            payment_id: payment.id,
            employee_id: employee.id,
            gross_amount: payment.tip_amount,
            allocation_method: 'individual',
            calculation_metadata: {
              explanation: `Direct tip to ${employee.full_name} who processed the transaction`,
              payment_total: payment.total_amount,
              tip_amount: payment.tip_amount,
              method: 'individual'
            }
          });
        }
      }
    }
  } else if (method === 'pooled') {
    // Pool all tips equally among active employees
    const totalTips = payments.reduce((sum, p) => sum + (p.tip_amount || 0), 0);
    const sharePerEmployee = totalTips / activeEmployees.length;

    for (const employee of activeEmployees) {
      allocations.push({
        payment_id: null, // Pooled allocation not tied to single payment
        employee_id: employee.id,
        gross_amount: Math.round(sharePerEmployee),
        allocation_method: 'pooled',
        pool_share_percentage: (1 / activeEmployees.length) * 100,
        calculation_metadata: {
          explanation: `Equal share of pooled tips: ${activeEmployees.length} team members sharing £${(totalTips / 100).toFixed(2)}`,
          total_pool: totalTips,
          employee_count: activeEmployees.length,
          share_amount: sharePerEmployee,
          method: 'pooled'
        }
      });
    }
  } else if (method === 'weighted') {
    // Role-weighted pool
    const totalTips = payments.reduce((sum, p) => sum + (p.tip_amount || 0), 0);
    const weights = rules.role_weights || {};
    
    // Calculate total weight points
    const totalWeightPoints = activeEmployees.reduce((sum, e) => 
      sum + (weights[e.role] || 1.0), 0
    );

    for (const employee of activeEmployees) {
      const employeeWeight = weights[employee.role] || 1.0;
      const employeeShare = (employeeWeight / totalWeightPoints) * totalTips;
      const percentage = (employeeWeight / totalWeightPoints) * 100;

      allocations.push({
        payment_id: null,
        employee_id: employee.id,
        gross_amount: Math.round(employeeShare),
        allocation_method: 'weighted',
        weight_factor: employeeWeight,
        pool_share_percentage: percentage,
        calculation_metadata: {
          explanation: `${employee.full_name} (${employee.role}) receives ${percentage.toFixed(1)}% based on role weight ${employeeWeight}x`,
          total_pool: totalTips,
          employee_role: employee.role,
          employee_weight: employeeWeight,
          total_weight_points: totalWeightPoints,
          share_amount: employeeShare,
          method: 'weighted'
        }
      });
    }
  } else if (method === 'shift_based') {
    // Hours-weighted pool - only employees who worked during the period
    const totalTips = payments.reduce((sum, p) => sum + (p.tip_amount || 0), 0);
    const employeesWithShifts = activeEmployees.filter(e => 
      shifts.some(s => s.employee_id === e.id)
    );

    const totalHours = shifts.reduce((sum, s) => sum + (s.hours_worked || 0), 0);

    for (const employee of employeesWithShifts) {
      const employeeShifts = shifts.filter(s => s.employee_id === employee.id);
      const employeeHours = employeeShifts.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
      const employeeShare = (employeeHours / totalHours) * totalTips;
      const percentage = (employeeHours / totalHours) * 100;

      allocations.push({
        payment_id: null,
        employee_id: employee.id,
        gross_amount: Math.round(employeeShare),
        allocation_method: 'shift_based',
        hours_worked: employeeHours,
        pool_share_percentage: percentage,
        calculation_metadata: {
          explanation: `${employee.full_name} worked ${employeeHours.toFixed(1)} hours (${percentage.toFixed(1)}% of ${totalHours.toFixed(1)} total hours)`,
          total_pool: totalTips,
          employee_hours: employeeHours,
          total_hours: totalHours,
          share_amount: employeeShare,
          shifts_count: employeeShifts.length,
          method: 'shift_based'
        }
      });
    }
  } else if (method === 'hybrid') {
    // Hybrid: Direct tips first, then pool remainder
    const directShare = rules.direct_percentage || 50; // Default 50% direct
    const poolShare = 100 - directShare;

    for (const payment of payments) {
      if (payment.tip_amount > 0 && payment.employee_id) {
        const directAmount = Math.round((payment.tip_amount * directShare) / 100);
        const employee = employees.find(e => e.id === payment.employee_id);

        if (employee) {
          allocations.push({
            payment_id: payment.id,
            employee_id: employee.id,
            gross_amount: directAmount,
            allocation_method: 'hybrid',
            calculation_metadata: {
              explanation: `${directShare}% direct attribution to ${employee.full_name} (${poolShare}% goes to pool)`,
              payment_total: payment.total_amount,
              tip_amount: payment.tip_amount,
              direct_amount: directAmount,
              pooled_amount: payment.tip_amount - directAmount,
              method: 'hybrid_direct'
            }
          });
        }
      }
    }

    // Calculate pooled portion
    const totalTips = payments.reduce((sum, p) => sum + (p.tip_amount || 0), 0);
    const pooledAmount = Math.round((totalTips * poolShare) / 100);
    const sharePerEmployee = pooledAmount / activeEmployees.length;

    for (const employee of activeEmployees) {
      allocations.push({
        payment_id: null,
        employee_id: employee.id,
        gross_amount: Math.round(sharePerEmployee),
        allocation_method: 'hybrid',
        pool_share_percentage: (1 / activeEmployees.length) * 100,
        calculation_metadata: {
          explanation: `${poolShare}% pooled share of all tips split equally among ${activeEmployees.length} team members`,
          total_pool: pooledAmount,
          employee_count: activeEmployees.length,
          share_amount: sharePerEmployee,
          method: 'hybrid_pooled'
        }
      });
    }
  }

  return allocations;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      location_id, 
      period_start, 
      period_end, 
      preview_only = false,
      tip_rule_set_id 
    } = await req.json();

    if (!location_id || !period_start || !period_end) {
      return Response.json({ 
        error: 'Missing required parameters: location_id, period_start, period_end' 
      }, { status: 400 });
    }

    const orgId = user.organization_id || user.id;

    // Get rule set
    let ruleSet;
    if (tip_rule_set_id) {
      const ruleSets = await base44.asServiceRole.entities.TipRuleSet.filter({ id: tip_rule_set_id });
      ruleSet = ruleSets[0];
    } else {
      // Get current active rule set for location
      const ruleSets = await base44.asServiceRole.entities.TipRuleSet.filter({
        organization_id: orgId,
        location_id: location_id,
        is_current: true
      });
      ruleSet = ruleSets[0];
    }

    if (!ruleSet) {
      return Response.json({ error: 'No active tip rule set found for this location' }, { status: 404 });
    }

    // Fetch payments in period
    const allPayments = await base44.asServiceRole.entities.Payment.filter({
      organization_id: orgId,
      location_id: location_id
    });

    const payments = allPayments.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return paymentDate >= new Date(period_start) && paymentDate <= new Date(period_end);
    });

    // Fetch employees
    const employees = await base44.asServiceRole.entities.Employee.filter({
      organization_id: orgId,
      employment_status: 'active'
    });

    // Fetch shifts in period
    const allShifts = await base44.asServiceRole.entities.Shift.filter({
      organization_id: orgId,
      location_id: location_id
    });

    const shifts = allShifts.filter(s => {
      const shiftStart = new Date(s.start_at);
      return shiftStart >= new Date(period_start) && shiftStart <= new Date(period_end);
    });

    // Calculate allocations
    const allocations = calculateAllocation(ruleSet, payments, employees, shifts);

    if (preview_only) {
      return Response.json({
        success: true,
        preview: true,
        allocations: allocations,
        summary: {
          total_tips: payments.reduce((sum, p) => sum + (p.tip_amount || 0), 0),
          total_allocated: allocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0),
          employee_count: new Set(allocations.map(a => a.employee_id)).size,
          payment_count: payments.length,
          rule_set_name: ruleSet.name,
          allocation_method: ruleSet.allocation_method
        }
      });
    }

    // Create allocation batch
    const batch = await base44.asServiceRole.entities.TipAllocationBatch.create({
      organization_id: orgId,
      location_id: location_id,
      batch_date: new Date().toISOString().split('T')[0],
      allocation_period_start: period_start,
      allocation_period_end: period_end,
      tip_rule_set_id: ruleSet.id,
      rule_version: ruleSet.version,
      total_tips_collected: payments.reduce((sum, p) => sum + (p.tip_amount || 0), 0),
      total_tips_allocated: allocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0),
      payment_count: payments.length,
      employee_count: new Set(allocations.map(a => a.employee_id)).size,
      status: 'draft'
    });

    // Create allocation lines
    const createdLines = [];
    for (const allocation of allocations) {
      const line = await base44.asServiceRole.entities.TipAllocationLine.create({
        organization_id: orgId,
        allocation_batch_id: batch.id,
        payment_id: allocation.payment_id,
        employee_id: allocation.employee_id,
        location_id: location_id,
        allocation_date: new Date().toISOString(),
        gross_amount: allocation.gross_amount,
        allocation_method: allocation.allocation_method,
        pool_share_percentage: allocation.pool_share_percentage,
        weight_factor: allocation.weight_factor,
        hours_worked: allocation.hours_worked,
        calculation_metadata: allocation.calculation_metadata
      });
      createdLines.push(line);
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: orgId,
      event_type: 'allocation_batch_created',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'allocation_batch',
      entity_id: batch.id,
      after_snapshot: {
        batch_id: batch.id,
        location_id: location_id,
        period_start: period_start,
        period_end: period_end,
        total_allocated: batch.total_tips_allocated,
        employee_count: batch.employee_count,
        rule_set_id: ruleSet.id
      },
      changes_summary: `Created allocation batch with ${createdLines.length} allocations`,
      hmrc_relevant: true,
      severity: 'info'
    });

    return Response.json({
      success: true,
      batch_id: batch.id,
      allocations_created: createdLines.length,
      total_allocated: batch.total_tips_allocated,
      summary: {
        total_tips: batch.total_tips_collected,
        total_allocated: batch.total_tips_allocated,
        employee_count: batch.employee_count,
        payment_count: batch.payment_count
      }
    });

  } catch (error) {
    console.error('Allocation execution error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});