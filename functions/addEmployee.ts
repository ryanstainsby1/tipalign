import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeData = await req.json();

    // Validate required fields
    if (!employeeData.full_name || !employeeData.email) {
      return Response.json({ 
        error: 'Missing required fields: full_name and email are required' 
      }, { status: 400 });
    }

    // Check for duplicate email
    const existing = await base44.asServiceRole.entities.Employee.filter({
      email: employeeData.email,
      organization_id: user.organization_id || user.id
    });

    if (existing.length > 0) {
      return Response.json({ 
        error: 'An employee with this email already exists' 
      }, { status: 409 });
    }

    // Create employee
    const employee = await base44.asServiceRole.entities.Employee.create({
      organization_id: user.organization_id || user.id,
      full_name: employeeData.full_name,
      email: employeeData.email,
      phone: employeeData.phone || '',
      role: employeeData.role || 'server',
      role_weight: employeeData.role_weight || 1.0,
      employment_status: 'active',
      employment_type: employeeData.employment_type || 'full_time',
      start_date: employeeData.start_date || new Date().toISOString(),
      locations: employeeData.locations || [],
      payroll_id: employeeData.payroll_id || ''
    });

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: user.organization_id || user.id,
      event_type: 'employee_added',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'employee',
      entity_id: employee.id,
      after_snapshot: employee,
      changes_summary: `Employee ${employee.full_name} added`,
      severity: 'info'
    });

    return Response.json({ success: true, employee });
  } catch (error) {
    console.error('Add employee error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});