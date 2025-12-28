import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date_range_start, date_range_end, format = 'csv', location_filter = null } = await req.json();

    if (!date_range_start || !date_range_end) {
      return Response.json({ 
        error: 'Missing required fields: date_range_start, date_range_end' 
      }, { status: 400 });
    }

    const org_id = user.organization_id || user.id;

    // Build query filters
    const filters = {
      organization_id: org_id
    };

    // Fetch allocations in date range
    const allAllocations = await base44.asServiceRole.entities.TipAllocation.list('-allocation_date', 10000);
    const allocations = allAllocations.filter(a => {
      const allocDate = new Date(a.allocation_date);
      const start = new Date(date_range_start);
      const end = new Date(date_range_end);
      return allocDate >= start && allocDate <= end;
    });

    if (allocations.length === 0) {
      return Response.json({ 
        error: 'No allocations found in date range',
        success: false 
      }, { status: 404 });
    }

    // Group by employee
    const employeeMap = {};
    for (const alloc of allocations) {
      if (!employeeMap[alloc.employee_id]) {
        employeeMap[alloc.employee_id] = {
          employee_id: alloc.employee_id,
          total_tips: 0,
          allocation_count: 0,
          allocations: []
        };
      }
      employeeMap[alloc.employee_id].total_tips += alloc.gross_amount || 0;
      employeeMap[alloc.employee_id].allocation_count += 1;
      employeeMap[alloc.employee_id].allocations.push(alloc);
    }

    // Fetch employee details
    const employeeIds = Object.keys(employeeMap);
    const employees = await base44.asServiceRole.entities.Employee.list();
    const employeeDetails = employees.filter(e => employeeIds.includes(e.id));

    // Generate export based on format
    let fileContent = '';
    let fileType = 'text/csv';

    if (format === 'csv' || format === 'sage50') {
      // CSV format
      const rows = [
        'Employee Name,Employee ID,Payroll ID,Total Tips (£),Allocation Count,Period Start,Period End'
      ];

      for (const empId of employeeIds) {
        const emp = employeeDetails.find(e => e.id === empId);
        const data = employeeMap[empId];
        rows.push([
          emp?.full_name || 'Unknown',
          empId,
          emp?.payroll_id || '',
          (data.total_tips / 100).toFixed(2),
          data.allocation_count,
          date_range_start,
          date_range_end
        ].join(','));
      }

      fileContent = rows.join('\n');
    } else if (format === 'pdf') {
      // Simple PDF representation (text-based)
      fileType = 'application/pdf';
      fileContent = `PAYROLL EXPORT REPORT\n\nPeriod: ${date_range_start} to ${date_range_end}\n\n`;
      fileContent += `Total Employees: ${employeeIds.length}\n`;
      fileContent += `Total Tips: £${(Object.values(employeeMap).reduce((sum, e) => sum + e.total_tips, 0) / 100).toFixed(2)}\n\n`;
      
      for (const empId of employeeIds) {
        const emp = employeeDetails.find(e => e.id === empId);
        const data = employeeMap[empId];
        fileContent += `${emp?.full_name || 'Unknown'}: £${(data.total_tips / 100).toFixed(2)} (${data.allocation_count} allocations)\n`;
      }
    }

    // Create export record
    const exportRecord = await base44.asServiceRole.entities.PayrollExport.create({
      export_date: new Date().toISOString(),
      period_start: date_range_start,
      period_end: date_range_end,
      location_name: location_filter || 'All Locations',
      total_tips: Object.values(employeeMap).reduce((sum, e) => sum + e.total_tips, 0),
      employee_count: employeeIds.length,
      allocation_count: allocations.length,
      export_format: format,
      status: 'finalised',
      exported_by: user.email
    });

    // Log audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'payroll_exported',
      entity_type: 'export',
      entity_id: exportRecord.id,
      actor_email: user.email,
      actor_role: user.role || 'admin',
      reason: `Exported payroll data for ${employeeIds.length} employees (${date_range_start} to ${date_range_end})`,
      hmrc_relevant: true,
      immutable_hash: crypto.randomUUID()
    });

    // Return file content as base64
    const base64Content = btoa(fileContent);

    return Response.json({
      success: true,
      export_id: exportRecord.id,
      file_content: base64Content,
      file_type: fileType,
      file_name: `payroll-export-${date_range_start}-to-${date_range_end}.${format === 'pdf' ? 'pdf' : 'csv'}`,
      records_included: {
        employees: employeeIds.length,
        allocations: allocations.length,
        total_tips: Object.values(employeeMap).reduce((sum, e) => sum + e.total_tips, 0)
      }
    });

  } catch (error) {
    console.error('Payroll export error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});