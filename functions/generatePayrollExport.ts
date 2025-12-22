import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { period_start, period_end, location_ids, export_format } = await req.json();

    if (!period_start || !period_end || !export_format) {
      return Response.json({ 
        error: 'Missing required fields: period_start, period_end, export_format' 
      }, { status: 400 });
    }

    const orgId = user.organization_id || user.id;

    // Check permissions
    if (user.role !== 'admin' && user.role !== 'owner') {
      return Response.json({ error: 'Only admins can generate payroll exports' }, { status: 403 });
    }

    // Get finalised/exported batches in period
    const allBatches = await base44.asServiceRole.entities.TipAllocationBatch.filter({
      organization_id: orgId
    });

    const periodBatches = allBatches.filter(b => {
      const batchDate = new Date(b.batch_date);
      const start = new Date(period_start);
      const end = new Date(period_end);
      const matchesDate = batchDate >= start && batchDate <= end;
      const matchesStatus = b.status === 'finalised' || b.status === 'exported';
      const matchesLocation = !location_ids || location_ids.length === 0 || location_ids.includes(b.location_id);
      return matchesDate && matchesStatus && matchesLocation;
    });

    if (periodBatches.length === 0) {
      return Response.json({ error: 'No finalised batches found in this period' }, { status: 404 });
    }

    // Get all allocation lines for these batches
    const allLines = await base44.asServiceRole.entities.TipAllocationLine.filter({
      organization_id: orgId
    });

    const relevantLines = allLines.filter(line => 
      periodBatches.some(b => b.id === line.allocation_batch_id)
    );

    // Get adjustments for these batches
    const allAdjustments = await base44.asServiceRole.entities.Adjustment.filter({
      organization_id: orgId,
      status: 'approved'
    });

    const relevantAdjustments = allAdjustments.filter(adj =>
      periodBatches.some(b => b.id === adj.allocation_batch_id)
    );

    // Get employees
    const employees = await base44.asServiceRole.entities.Employee.filter({
      organization_id: orgId
    });

    // Get locations
    const locations = await base44.asServiceRole.entities.Location.filter({
      organization_id: orgId
    });

    // Aggregate by employee
    const employeeData = {};

    for (const line of relevantLines) {
      if (!employeeData[line.employee_id]) {
        const employee = employees.find(e => e.id === line.employee_id);
        employeeData[line.employee_id] = {
          employee_id: line.employee_id,
          payroll_id: employee?.payroll_id || '',
          full_name: employee?.full_name || '',
          ni_number: employee?.ni_number_encrypted || '',
          total_tips: 0,
          adjustments: 0,
          locations: {}
        };
      }
      employeeData[line.employee_id].total_tips += line.gross_amount;
      
      // Track by location
      const location = locations.find(l => l.id === line.location_id);
      const locationName = location?.name || 'Unknown';
      if (!employeeData[line.employee_id].locations[locationName]) {
        employeeData[line.employee_id].locations[locationName] = 0;
      }
      employeeData[line.employee_id].locations[locationName] += line.gross_amount;
    }

    // Add adjustments
    for (const adj of relevantAdjustments) {
      if (employeeData[adj.employee_id]) {
        employeeData[adj.employee_id].adjustments += adj.adjustment_amount;
      }
    }

    // Generate CSV
    const csvRows = [];
    csvRows.push([
      'Payroll ID',
      'Employee Name',
      'Period Start',
      'Period End',
      'Total Tips Allocated (£)',
      'Adjustments (£)',
      'Net Tips for Payroll (£)',
      'Location Breakdown'
    ].join(','));

    for (const data of Object.values(employeeData)) {
      const netTips = data.total_tips + data.adjustments;
      const locationBreakdown = Object.entries(data.locations)
        .map(([loc, amt]) => `${loc}: £${(amt / 100).toFixed(2)}`)
        .join('; ');

      csvRows.push([
        data.payroll_id,
        `"${data.full_name}"`,
        period_start,
        period_end,
        (data.total_tips / 100).toFixed(2),
        (data.adjustments / 100).toFixed(2),
        (netTips / 100).toFixed(2),
        `"${locationBreakdown}"`
      ].join(','));
    }

    const csvContent = csvRows.join('\n');

    // Create export run record
    const exportRun = await base44.asServiceRole.entities.ExportRun.create({
      organization_id: orgId,
      export_type: 'payroll',
      export_format: export_format,
      period_start: period_start,
      period_end: period_end,
      location_filter: location_ids || [],
      allocation_batch_ids: periodBatches.map(b => b.id),
      total_tips_exported: Object.values(employeeData).reduce((sum, e) => sum + e.total_tips + e.adjustments, 0),
      employee_count: Object.keys(employeeData).length,
      line_count: relevantLines.length,
      status: 'ready',
      generated_by_email: user.email
    });

    // Mark batches as exported
    for (const batch of periodBatches) {
      if (batch.status === 'finalised') {
        await base44.asServiceRole.entities.TipAllocationBatch.update(batch.id, {
          status: 'exported'
        });
      }
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: orgId,
      event_type: 'export_generated',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'export_run',
      entity_id: exportRun.id,
      after_snapshot: {
        period_start,
        period_end,
        batches_count: periodBatches.length,
        employees_count: Object.keys(employeeData).length,
        total_tips: exportRun.total_tips_exported
      },
      changes_summary: `Payroll export generated for ${period_start} to ${period_end}`,
      hmrc_relevant: true,
      severity: 'info'
    });

    return Response.json({
      success: true,
      export_run_id: exportRun.id,
      csv_content: csvContent,
      summary: {
        batches_exported: periodBatches.length,
        employees: Object.keys(employeeData).length,
        total_tips: exportRun.total_tips_exported,
        lines: relevantLines.length,
        adjustments: relevantAdjustments.length
      }
    });

  } catch (error) {
    console.error('Generate payroll export error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});