import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { employee_id } = body;

    if (!employee_id) {
      return Response.json({ success: false, error: 'employee_id required' }, { status: 400 });
    }

    // Get employee
    const employees = await base44.asServiceRole.entities.Employee.filter({ id: employee_id });
    if (employees.length === 0) {
      return Response.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];
    const orgId = employee.organization_id;

    // Calculate today's bounds
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's transactions
    const allTransactions = await base44.asServiceRole.entities.Transaction.filter({
      organization_id: orgId,
      employee_id: employee_id
    });

    const todayTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.transaction_date || tx.timestamp);
      return txDate >= today && txDate < tomorrow;
    });

    const todaySales = todayTransactions.reduce((sum, tx) => sum + (tx.amount || tx.total_amount || 0), 0);
    const todayTips = todayTransactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);

    // Get current shift status
    const openShifts = await base44.asServiceRole.entities.Shift.filter({
      organization_id: orgId,
      employee_id: employee_id,
      status: 'open'
    });

    const currentShift = openShifts.find(shift => {
      const startTime = new Date(shift.start_at);
      const now = new Date();
      return startTime <= now && (!shift.end_at || new Date(shift.end_at) > now);
    });

    // Get bonus progress for active rules
    const activeRules = await base44.asServiceRole.entities.BonusRules.filter({
      organization_id: orgId,
      is_active: true
    });

    const bonusProgress = [];
    
    for (const rule of activeRules) {
      // Skip if location-specific and employee not at that location
      if (rule.location_id && employee.primary_location_id !== rule.location_id) {
        continue;
      }

      // Calculate period bounds
      let periodStart;
      const now = new Date();
      
      if (rule.period === 'daily') {
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
      } else if (rule.period === 'weekly') {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - periodStart.getDay());
        periodStart.setHours(0, 0, 0, 0);
      } else if (rule.period === 'monthly') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Calculate current metric value
      const periodTransactions = allTransactions.filter(tx => {
        const txDate = new Date(tx.transaction_date || tx.timestamp);
        return txDate >= periodStart;
      });

      let currentValue = 0;
      if (rule.metric === 'sales') {
        currentValue = periodTransactions.reduce((sum, tx) => sum + (tx.amount || tx.total_amount || 0), 0);
      } else if (rule.metric === 'tips') {
        currentValue = periodTransactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
      } else if (rule.metric === 'items') {
        currentValue = periodTransactions.length;
      }

      const progress = Math.min((currentValue / rule.threshold) * 100, 100);
      const achieved = currentValue >= rule.threshold;

      let bonusReward = '';
      if (rule.bonus_type === 'flat') {
        bonusReward = `£${(rule.bonus_amount / 100).toFixed(2)}`;
      } else {
        bonusReward = `${rule.bonus_amount}% of ${rule.metric}`;
      }

      bonusProgress.push({
        rule_id: rule.id,
        rule_name: rule.name,
        metric: rule.metric,
        threshold: rule.threshold,
        current_value: currentValue,
        progress_percent: progress,
        achieved,
        bonus_reward: bonusReward,
        period: rule.period
      });
    }

    // Get pending bonuses
    const pendingBonuses = await base44.asServiceRole.entities.BonusAllocations.filter({
      organization_id: orgId,
      employee_id: employee_id,
      status: 'pending'
    });

    const pendingBonusBalance = pendingBonuses.reduce((sum, b) => sum + (b.bonus_amount || 0), 0);

    // Get recent transactions (last 10)
    const recentTransactions = todayTransactions
      .sort((a, b) => new Date(b.transaction_date || b.timestamp) - new Date(a.transaction_date || a.timestamp))
      .slice(0, 10)
      .map(tx => ({
        id: tx.id,
        timestamp: tx.transaction_date || tx.timestamp,
        amount: tx.amount || tx.total_amount || 0,
        tip_amount: tx.tip_amount || 0,
        location_name: tx.location_name
      }));

    return Response.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.full_name,
        role: employee.role
      },
      today: {
        sales_total: todaySales,
        tips_total: todayTips,
        transaction_count: todayTransactions.length
      },
      current_shift: currentShift ? {
        id: currentShift.id,
        start_time: currentShift.start_at,
        location_id: currentShift.location_id
      } : null,
      bonus_progress: bonusProgress,
      pending_bonus_balance: pendingBonusBalance,
      recent_transactions: recentTransactions
    });

  } catch (error) {
    console.error('Employee dashboard error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});