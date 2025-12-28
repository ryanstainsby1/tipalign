import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tip_id, tip_amount, location_id, timestamp, shift_id, employee_id } = await req.json();

    if (!tip_id || !tip_amount || !location_id) {
      return Response.json({ 
        error: 'Missing required fields: tip_id, tip_amount, location_id' 
      }, { status: 400 });
    }

    // Fetch location to get allocation rules
    const location = await base44.asServiceRole.entities.Location.filter({ id: location_id });
    if (!location || location.length === 0) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }

    const locationData = location[0];
    const allocationMethod = locationData.current_allocation_method || 'individual';

    let allocations = [];
    let method = allocationMethod;
    let confidence_score = 0.95;

    // Fetch employees at this location
    const employees = await base44.asServiceRole.entities.Employee.filter({
      organization_id: user.organization_id,
      locations: location_id,
      employment_status: 'active'
    });

    if (employees.length === 0) {
      return Response.json({ 
        error: 'No active employees at location',
        success: false 
      }, { status: 400 });
    }

    // Apply allocation logic based on method
    if (allocationMethod === 'individual' && employee_id) {
      // Direct allocation to specific employee
      allocations.push({
        employee_id,
        allocated_amount: tip_amount,
        method: 'individual',
        confidence_score: 1.0
      });
    } else if (allocationMethod === 'pooled') {
      // Split equally among all active employees
      const amountPerEmployee = Math.floor(tip_amount / employees.length);
      allocations = employees.map(emp => ({
        employee_id: emp.id,
        allocated_amount: amountPerEmployee,
        method: 'pooled',
        confidence_score: 0.9
      }));
    } else if (allocationMethod === 'weighted') {
      // Split based on role weights
      const totalWeight = employees.reduce((sum, emp) => sum + (emp.role_weight || 1.0), 0);
      allocations = employees.map(emp => {
        const weight = emp.role_weight || 1.0;
        const allocated = Math.floor((tip_amount * weight) / totalWeight);
        return {
          employee_id: emp.id,
          allocated_amount: allocated,
          method: 'weighted',
          weight_factor: weight,
          confidence_score: 0.85
        };
      });
    } else if (allocationMethod === 'shift_based' && shift_id) {
      // Allocate to employees on the shift
      const shifts = await base44.asServiceRole.entities.Shift.filter({
        square_shift_id: shift_id,
        location_id: location_id
      });
      
      if (shifts.length > 0) {
        const shiftEmployees = shifts.map(s => s.employee_id).filter(Boolean);
        const activeShiftEmployees = employees.filter(e => shiftEmployees.includes(e.id));
        
        if (activeShiftEmployees.length > 0) {
          const amountPerEmployee = Math.floor(tip_amount / activeShiftEmployees.length);
          allocations = activeShiftEmployees.map(emp => ({
            employee_id: emp.id,
            allocated_amount: amountPerEmployee,
            method: 'shift_based',
            shift_id: shift_id,
            confidence_score: 0.95
          }));
        }
      }
    }

    // Fallback to equal split if no allocations created
    if (allocations.length === 0) {
      const amountPerEmployee = Math.floor(tip_amount / employees.length);
      allocations = employees.map(emp => ({
        employee_id: emp.id,
        allocated_amount: amountPerEmployee,
        method: 'pooled',
        confidence_score: 0.5
      }));
      confidence_score = 0.5;
    }

    // Create allocation records
    const allocationRecords = [];
    for (const alloc of allocations) {
      const record = await base44.asServiceRole.entities.TipAllocation.create({
        transaction_id: tip_id,
        employee_id: alloc.employee_id,
        square_employee_id: employees.find(e => e.id === alloc.employee_id)?.square_team_member_id,
        location_id: location_id,
        shift_id: shift_id || null,
        allocation_date: timestamp || new Date().toISOString(),
        gross_amount: alloc.allocated_amount,
        allocation_method: alloc.method,
        pool_percentage: allocationMethod === 'pooled' ? (100 / employees.length) : null,
        hours_worked: alloc.hours_worked || null,
        status: 'pending'
      });
      allocationRecords.push(record);
    }

    // Log audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'tip_allocated',
      entity_type: 'allocation',
      entity_id: tip_id,
      actor_email: 'system',
      actor_role: 'system',
      reason: `Allocated £${(tip_amount / 100).toFixed(2)} using ${method} method`,
      hmrc_relevant: true,
      immutable_hash: crypto.randomUUID()
    });

    return Response.json({
      success: true,
      allocations: allocationRecords,
      method,
      confidence_score,
      total_allocated: allocations.reduce((sum, a) => sum + a.allocated_amount, 0),
      audit_log: true
    });

  } catch (error) {
    console.error('Tip allocation engine error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});