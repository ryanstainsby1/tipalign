import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { connection_id } = body;

    console.log('=== DIAGNOSTIC + FULL SYNC ===');

    if (!connection_id) {
      return Response.json({ success: false, error: 'connection_id is required' }, { status: 400 });
    }

    function wait(ms) {
      return new Promise(function(resolve) { setTimeout(resolve, ms); });
    }

    const connections = await base44.asServiceRole.entities.SquareConnection.filter({ id: connection_id });
    await wait(300);
    
    if (connections.length === 0) {
      return Response.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];
    const orgId = connection.organization_id;
    const accessToken = connection.square_access_token_encrypted;
    const baseUrl = 'https://connect.squareup.com/v2';

    // Clean up stuck syncs
    const runningSyncs = await base44.asServiceRole.entities.SyncJob.filter({
      square_connection_id: connection_id,
      status: 'running'
    });
    await wait(300);

    for (const stuckSync of runningSyncs) {
      await base44.asServiceRole.entities.SyncJob.update(stuckSync.id, {
        status: 'failed',
        completed_at: new Date().toISOString()
      });
      await wait(300);
    }

    // ============================================
    // DIAGNOSTIC: Check what data exists
    // ============================================
    console.log('=== RUNNING DIAGNOSTICS ===');

    // Get employees
    const employees = await base44.asServiceRole.entities.Employee.filter({ organization_id: orgId });
    await wait(300);
    console.log('Employees found: ' + employees.length);
    
    if (employees.length > 0) {
      console.log('Sample employee fields: ' + JSON.stringify(Object.keys(employees[0])));
      console.log('Sample employee: ' + JSON.stringify(employees[0]));
    }

    // Get locations
    const locations = await base44.asServiceRole.entities.Location.filter({ organization_id: orgId });
    await wait(300);
    console.log('Locations found: ' + locations.length);

    // Get payments with tips
    const payments = await base44.asServiceRole.entities.Payment.filter({ organization_id: orgId });
    await wait(300);
    console.log('Total payments: ' + payments.length);

    // Find payments with tips
    const paymentsWithTips = payments.filter(function(p) { 
      return p.tip_amount && p.tip_amount > 0; 
    });
    console.log('Payments with tips: ' + paymentsWithTips.length);

    if (paymentsWithTips.length > 0) {
      console.log('Sample payment with tip fields: ' + JSON.stringify(Object.keys(paymentsWithTips[0])));
      console.log('Sample payment with tip: ' + JSON.stringify(paymentsWithTips[0]));
    }

    // Check for team_member_id in payments
    const paymentsWithTeamMember = payments.filter(function(p) {
      return p.square_team_member_id || p.employee_id;
    });
    console.log('Payments with team_member assigned: ' + paymentsWithTeamMember.length);

    // Check existing allocations
    let existingAllocations = [];
    try {
      existingAllocations = await base44.asServiceRole.entities.TipAllocation.filter({ organization_id: orgId });
      await wait(300);
      console.log('Existing allocations: ' + existingAllocations.length);
      if (existingAllocations.length > 0) {
        console.log('Sample allocation fields: ' + JSON.stringify(Object.keys(existingAllocations[0])));
      }
    } catch (err) {
      console.log('TipAllocation entity might not exist or different name: ' + err.message);
    }

    // ============================================
    // FETCH FRESH DATA FROM SQUARE WITH DIAGNOSTICS
    // ============================================
    console.log('=== FETCHING FRESH DATA FROM SQUARE ===');
    
    const beginTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endTime = new Date().toISOString();

    let totalTips = 0;
    let tipsWithEmployee = 0;
    let tipsWithoutEmployee = 0;
    const tipPayments = [];

    // Build employee lookup
    const empBySquareId = new Map();
    for (const e of employees) {
      if (e.square_team_member_id) {
        empBySquareId.set(e.square_team_member_id, e);
      }
    }

    // Build location lookup
    const locById = new Map();
    const locBySquareId = new Map();
    for (const l of locations) {
      locById.set(l.id, l);
      if (l.square_location_id) {
        locBySquareId.set(l.square_location_id, l);
      }
    }

    for (const loc of locations) {
      if (!loc.square_location_id) continue;

      const url = baseUrl + '/payments?location_id=' + loc.square_location_id + 
        '&begin_time=' + encodeURIComponent(beginTime) + 
        '&end_time=' + encodeURIComponent(endTime) + 
        '&limit=100';

      const payRes = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Square-Version': '2024-12-18' }
      });

      if (!payRes.ok) {
        console.error('Failed to fetch payments for ' + loc.name);
        continue;
      }

      const payData = await payRes.json();
      const squarePayments = payData.payments || [];

      for (const p of squarePayments) {
        if (p.status !== 'COMPLETED') continue;
        
        const tip = p.tip_money?.amount || 0;
        if (tip > 0) {
          totalTips++;
          const teamMemberId = p.team_member_id || p.employee_id || null;
          
          if (teamMemberId) {
            tipsWithEmployee++;
          } else {
            tipsWithoutEmployee++;
          }

          tipPayments.push({
            paymentId: p.id,
            tip: tip,
            teamMemberId: teamMemberId,
            employeeId: teamMemberId && empBySquareId.has(teamMemberId) ? empBySquareId.get(teamMemberId)?.id || null : null,
            locationId: loc.id,
            locationName: loc.name,
            createdAt: p.created_at
          });

          console.log('TIP: ' + (tip/100).toFixed(2) + ' GBP at ' + loc.name + ', team_member_id=' + (teamMemberId || 'NONE'));
        }
      }
    }

    console.log('=== TIP ANALYSIS ===');
    console.log('Total tips found in Square: ' + totalTips);
    console.log('Tips WITH team_member_id: ' + tipsWithEmployee);
    console.log('Tips WITHOUT team_member_id: ' + tipsWithoutEmployee);

    // ============================================
    // CREATE ALLOCATIONS
    // ============================================
    console.log('=== CREATING ALLOCATIONS ===');

    let allocationsCreated = 0;
    let allocationsSkipped = 0;
    const errors = [];

    // Get existing allocation payment IDs
    const existingAllocationPaymentIds = new Set();
    for (const a of existingAllocations) {
      const paymentId = a.payment_id;
      if (paymentId) {
        const payment = payments.find(function(p) { return p.id === paymentId; });
        if (payment && payment.square_payment_id) {
          existingAllocationPaymentIds.add(payment.square_payment_id);
        }
      }
    }

    for (const tipPayment of tipPayments) {
      // Skip if already allocated
      if (existingAllocationPaymentIds.has(tipPayment.paymentId)) {
        allocationsSkipped++;
        continue;
      }

      // Find or create Payment record
      let paymentRecord = payments.find(function(p) { return p.square_payment_id === tipPayment.paymentId; });
      
      if (!paymentRecord) {
        console.log('Payment record not found for ' + tipPayment.paymentId + ', skipping');
        allocationsSkipped++;
        continue;
      }

      // Determine employee
      let assignedEmployeeId = tipPayment.employeeId;
      let assignedEmployeeName = 'Unassigned';

      if (assignedEmployeeId) {
        const emp = employees.find(function(e) { return e.id === assignedEmployeeId; });
        if (emp) {
          assignedEmployeeName = emp.full_name || 'Unknown';
        }
      }

      const allocationData = {
        organization_id: orgId,
        payment_id: paymentRecord.id,
        location_id: tipPayment.locationId,
        employee_id: assignedEmployeeId,
        square_employee_id: tipPayment.teamMemberId,
        gross_amount: tipPayment.tip,
        allocation_date: tipPayment.createdAt,
        allocation_method: 'individual',
        status: assignedEmployeeId ? 'pending' : 'unassigned'
      };

      try {
        await base44.asServiceRole.entities.TipAllocation.create(allocationData);
        allocationsCreated++;
        existingAllocationPaymentIds.add(tipPayment.paymentId);
        console.log('Created allocation: ' + (tipPayment.tip/100).toFixed(2) + ' GBP for ' + assignedEmployeeName + ' at ' + tipPayment.locationName);
        await wait(400);
      } catch (err) {
        const errMsg = err.message;
        console.error('Failed to create allocation: ' + errMsg);
        errors.push(errMsg);
      }

      // Rate limit
      if (allocationsCreated >= 30) {
        console.log('Allocation rate limit reached');
        break;
      }
    }

    // ============================================
    // UPDATE EMPLOYEE TOTALS
    // ============================================
    console.log('=== UPDATING EMPLOYEE TOTALS ===');

    // Recalculate from allocations
    let allAllocations = [];
    try {
      allAllocations = await base44.asServiceRole.entities.TipAllocation.filter({ organization_id: orgId });
      await wait(300);
    } catch (err) {
      console.log('Could not fetch allocations: ' + err.message);
    }

    const empTotals = new Map();
    
    for (const alloc of allAllocations) {
      const empId = alloc.employee_id;
      if (!empId) continue;
      
      const current = empTotals.get(empId) || { earned: 0, pending: 0 };
      const amount = alloc.gross_amount || 0;
      const status = alloc.status;
      
      if (status === 'confirmed' || status === 'paid') {
        current.earned += amount;
      } else {
        current.pending += amount;
      }
      
      empTotals.set(empId, current);
    }

    console.log('Employee totals calculated: ' + empTotals.size);

    let employeesUpdated = 0;
    for (const [empId, totals] of empTotals) {
      try {
        await base44.asServiceRole.entities.Employee.update(empId, {
          total_tips_earned_lifetime: totals.earned,
          pending_tips: totals.pending
        });
        employeesUpdated++;
        console.log('Updated employee ' + empId + ': earned=' + (totals.earned/100).toFixed(2) + ', pending=' + (totals.pending/100).toFixed(2));
        await wait(350);
      } catch (err) {
        console.error('Failed to update employee: ' + err.message);
      }

      if (employeesUpdated >= 25) break;
    }

    const duration = Date.now() - startTime;
    console.log('=== SYNC COMPLETED in ' + duration + 'ms ===');

    return Response.json({
      success: true,
      diagnostics: {
        employees_count: employees.length,
        locations_count: locations.length,
        total_payments: payments.length,
        payments_with_tips: paymentsWithTips.length,
        payments_with_team_member: paymentsWithTeamMember.length,
        existing_allocations: existingAllocations.length,
        square_tips_found: totalTips,
        tips_with_employee: tipsWithEmployee,
        tips_without_employee: tipsWithoutEmployee
      },
      results: {
        allocations_created: allocationsCreated,
        allocations_skipped: allocationsSkipped,
        employees_updated: employeesUpdated
      },
      errors: errors,
      duration_ms: duration
    });

  } catch (error) {
    console.error('Sync error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});