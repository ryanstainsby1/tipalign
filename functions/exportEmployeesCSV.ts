import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employees
    const employees = await base44.asServiceRole.entities.Employee.filter({
      organization_id: user.organization_id || user.id
    });

    // Generate CSV
    const headers = ['ID', 'Full Name', 'Email', 'Role', 'Status', 'Weight', 'Payroll ID', 'Start Date'];
    const rows = employees.map(emp => [
      emp.id,
      emp.full_name,
      emp.email,
      emp.role,
      emp.employment_status,
      emp.role_weight,
      emp.payroll_id || '',
      emp.start_date || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="employees_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Export employees error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});