import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { organization_id, location_id } = body;

    if (!organization_id) {
      return Response.json({ success: false, error: 'organization_id required' }, { status: 400 });
    }

    // Calculate today's bounds
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's transactions
    const txFilter = { organization_id };
    if (location_id) txFilter.location_id = location_id;
    
    const allTransactions = await base44.asServiceRole.entities.Transaction.filter(txFilter);
    
    const todayTransactions = allTransactions.filter(tx => {
      const txDate = new Date(tx.transaction_date || tx.timestamp);
      return txDate >= today && txDate < tomorrow;
    });

    const totalSalesToday = todayTransactions.reduce((sum, tx) => sum + (tx.amount || tx.total_amount || 0), 0);
    const totalTipsToday = todayTransactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);

    // Get active employees (with open shifts)
    const openShifts = await base44.asServiceRole.entities.Shift.filter({
      organization_id,
      status: 'open'
    });

    const activeEmployeeIds = new Set();
    const now = new Date();
    
    for (const shift of openShifts) {
      const startTime = new Date(shift.start_at);
      if (startTime <= now && (!shift.end_at || new Date(shift.end_at) > now)) {
        activeEmployeeIds.add(shift.employee_id);
      }
    }

    const activeEmployeeCount = activeEmployeeIds.size;

    // Get pending bonuses
    const bonusFilter = { organization_id, status: 'pending' };
    const pendingBonuses = await base44.asServiceRole.entities.BonusAllocations.filter(bonusFilter);
    const totalPendingBonuses = pendingBonuses.reduce((sum, b) => sum + (b.bonus_amount || 0), 0);

    // Build employee leaderboard
    const employeeFilter = { organization_id, is_active: true };
    if (location_id) employeeFilter.primary_location_id = location_id;
    
    const employees = await base44.asServiceRole.entities.Employee.filter(employeeFilter);
    
    const leaderboard = [];
    
    for (const employee of employees) {
      const empTransactions = todayTransactions.filter(tx => tx.employee_id === employee.id);
      const sales = empTransactions.reduce((sum, tx) => sum + (tx.amount || tx.total_amount || 0), 0);
      const tips = empTransactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
      
      const empBonuses = pendingBonuses.filter(b => b.employee_id === employee.id);
      const bonuses = empBonuses.reduce((sum, b) => sum + (b.bonus_amount || 0), 0);

      leaderboard.push({
        employee_id: employee.id,
        name: employee.full_name,
        role: employee.role,
        sales,
        tips,
        bonuses,
        transaction_count: empTransactions.length
      });
    }

    // Sort by sales descending
    leaderboard.sort((a, b) => b.sales - a.sales);

    // Hourly sales breakdown for chart
    const hourlySales = Array(24).fill(0);
    
    for (const tx of todayTransactions) {
      const txDate = new Date(tx.transaction_date || tx.timestamp);
      const hour = txDate.getHours();
      hourlySales[hour] += tx.amount || tx.total_amount || 0;
    }

    const hourlySalesData = hourlySales.map((sales, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      sales
    }));

    // Get last sync status
    const syncLogs = await base44.asServiceRole.entities.SyncLogs.filter(
      { organization_id },
      '-timestamp',
      1
    );

    const lastSync = syncLogs[0] || null;

    return Response.json({
      success: true,
      overview: {
        total_sales_today: totalSalesToday,
        total_tips_today: totalTipsToday,
        active_employees: activeEmployeeCount,
        pending_bonuses: totalPendingBonuses,
        transaction_count: todayTransactions.length
      },
      leaderboard,
      hourly_sales: hourlySalesData,
      last_sync: lastSync ? {
        timestamp: lastSync.timestamp,
        status: lastSync.status,
        records_synced: lastSync.records_synced,
        error_message: lastSync.error_message
      } : null
    });

  } catch (error) {
    console.error('Employer dashboard error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});