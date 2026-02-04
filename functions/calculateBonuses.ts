import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { organization_id, period = 'daily' } = body;

    if (!organization_id) {
      return Response.json({ success: false, error: 'organization_id required' }, { status: 400 });
    }

    console.log('=== Calculate Bonuses ===');
    console.log('Organization:', organization_id);
    console.log('Period:', period);

    // Get all active bonus rules
    const bonusRules = await base44.asServiceRole.entities.BonusRules.filter({
      organization_id,
      is_active: true
    });

    if (bonusRules.length === 0) {
      return Response.json({
        success: true,
        message: 'No active bonus rules found',
        bonuses_created: 0
      });
    }

    const now = new Date();
    const allocations = [];

    for (const rule of bonusRules) {
      // Calculate period bounds
      let periodStart, periodEnd;
      
      if (rule.period === 'daily') {
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(now);
        periodEnd.setHours(23, 59, 59, 999);
      } else if (rule.period === 'weekly') {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - periodStart.getDay());
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
      } else if (rule.period === 'monthly') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      // Get all employees at this location (or all if location_id is null)
      const employeeFilter = { organization_id };
      if (rule.location_id) {
        employeeFilter.primary_location_id = rule.location_id;
      }
      const employees = await base44.asServiceRole.entities.Employee.filter(employeeFilter);

      for (const employee of employees) {
        if (!employee.is_active) continue;

        // Get transactions for this employee in the period
        const txFilter = {
          organization_id,
          employee_id: employee.id
        };
        
        const allTransactions = await base44.asServiceRole.entities.Transaction.filter(txFilter);
        const transactions = allTransactions.filter(tx => {
          const txDate = new Date(tx.transaction_date || tx.timestamp);
          return txDate >= periodStart && txDate <= periodEnd;
        });

        // Calculate metric value
        let metricValue = 0;
        
        if (rule.metric === 'sales') {
          metricValue = transactions.reduce((sum, tx) => sum + (tx.amount || tx.total_amount || 0), 0);
        } else if (rule.metric === 'tips') {
          metricValue = transactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
        } else if (rule.metric === 'items') {
          metricValue = transactions.length;
        }

        console.log(`Employee ${employee.full_name}: ${rule.metric} = ${metricValue}, threshold = ${rule.threshold}`);

        // Check if threshold met
        if (metricValue >= rule.threshold) {
          // Calculate bonus amount
          let bonusAmount = 0;
          if (rule.bonus_type === 'flat') {
            bonusAmount = rule.bonus_amount;
          } else if (rule.bonus_type === 'percent') {
            bonusAmount = Math.floor(metricValue * rule.bonus_amount / 100);
          }

          console.log(`  → Bonus earned: £${(bonusAmount / 100).toFixed(2)}`);

          // Check for existing allocation (idempotency)
          const existing = await base44.asServiceRole.entities.BonusAllocations.filter({
            organization_id,
            employee_id: employee.id,
            bonus_rule_id: rule.id,
            period_start: periodStart.toISOString()
          });

          if (existing.length > 0) {
            // Update existing
            await base44.asServiceRole.entities.BonusAllocations.update(existing[0].id, {
              metric_value: metricValue,
              bonus_amount: bonusAmount,
              period_end: periodEnd.toISOString(),
              rule_name: rule.name
            });
            console.log('  → Updated existing allocation');
          } else {
            // Create new
            const allocation = await base44.asServiceRole.entities.BonusAllocations.create({
              organization_id,
              employee_id: employee.id,
              bonus_rule_id: rule.id,
              rule_name: rule.name,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              metric_value: metricValue,
              bonus_amount: bonusAmount,
              status: 'pending',
              wallet_updated: false
            });
            allocations.push(allocation);
            console.log('  → Created new allocation');
          }
        }
      }
    }

    return Response.json({
      success: true,
      bonuses_calculated: allocations.length,
      rules_evaluated: bonusRules.length,
      allocations
    });

  } catch (error) {
    console.error('Calculate bonuses error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});