import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { employee_id, pass_serial } = await req.json();

    if (!employee_id || !pass_serial) {
      return Response.json({
        valid: false,
        error: 'Missing employee_id or pass_serial'
      }, { status: 400 });
    }

    // Validate employee exists and is active
    const employees = await base44.asServiceRole.entities.Employee.filter({
      id: employee_id,
      employment_status: 'active'
    });

    if (employees.length === 0) {
      return Response.json({
        valid: false,
        error: 'Employee not found or inactive'
      });
    }

    const employee = employees[0];

    // Validate pass belongs to employee and is active
    const passes = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id,
      pass_serial_number: pass_serial,
      pass_status: 'active'
    });

    if (passes.length === 0) {
      return Response.json({
        valid: false,
        error: 'Invalid or revoked tipping link'
      });
    }

    // Return employee info (safe fields only)
    return Response.json({
      valid: true,
      employee: {
        id: employee.id,
        full_name: employee.full_name,
        role: employee.role,
        locations: employee.locations || []
      }
    });

  } catch (error) {
    console.error('Validate tip access error:', error);
    return Response.json({
      valid: false,
      error: 'Validation failed'
    }, { status: 500 });
  }
});