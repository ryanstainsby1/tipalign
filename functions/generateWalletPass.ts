import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { employee_id, action = 'generate' } = body;

    console.log('=== Apple Wallet Pass Generator ===');

    const PASS_TYPE_ID = Deno.env.get('APPLE_WALLET_PASS_TYPE_ID');
    const TEAM_ID = Deno.env.get('APPLE_WALLET_TEAM_ID');
    const WEB_SERVICE_URL = Deno.env.get('APPLE_WALLET_WEB_SERVICE_URL') || 'https://tiply.co.uk/functions';

    if (!PASS_TYPE_ID || !TEAM_ID) {
      return Response.json({
        success: false,
        error: 'Apple Wallet not configured',
        setup_required: true
      }, { status: 400 });
    }

    if (!employee_id) {
      return Response.json({ success: false, error: 'employee_id is required' }, { status: 400 });
    }

    const employees = await base44.asServiceRole.entities.Employee.filter({ id: employee_id });
    if (employees.length === 0) {
      return Response.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];
    const orgId = employee.organization_id;

    let orgName = 'Tiply';
    try {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
      if (orgs.length > 0) orgName = orgs[0].name || 'Tiply';
    } catch (e) {}

    let locationName = 'All Locations';
    if (employee.primary_location_id) {
      try {
        const locs = await base44.asServiceRole.entities.Location.filter({ id: employee.primary_location_id });
        if (locs.length > 0) locationName = locs[0].name;
      } catch (e) {}
    }

    let currentPeriodTips = 0;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    try {
      const allocations = await base44.asServiceRole.entities.TipAllocation.filter({ employee_id: employee_id });
      for (const alloc of allocations) {
        const allocDate = new Date(alloc.allocation_date || alloc.created_at);
        if (allocDate >= weekStart) {
          currentPeriodTips += alloc.tip_amount_pence || alloc.amount || 0;
        }
      }
    } catch (err) {}

    let serialNumber = employee.wallet_serial_number;
    if (!serialNumber) {
      serialNumber = crypto.randomUUID();
      await base44.asServiceRole.entities.Employee.update(employee_id, {
        wallet_serial_number: serialNumber,
        wallet_status: 'active',
        wallet_last_updated: new Date().toISOString()
      });
    }

    const authToken = btoa(employee_id + ':' + serialNumber + ':' + Date.now()).substring(0, 32);

    try {
      const existingPasses = await base44.asServiceRole.entities.WalletPass.filter({ employee_id: employee_id });
      if (existingPasses.length > 0) {
        await base44.asServiceRole.entities.WalletPass.update(existingPasses[0].id, {
          serial_number: serialNumber,
          auth_token: authToken,
          current_tips_pence: currentPeriodTips,
          last_updated: new Date().toISOString(),
          status: 'active'
        });
      } else {
        await base44.asServiceRole.entities.WalletPass.create({
          organization_id: orgId,
          employee_id: employee_id,
          serial_number: serialNumber,
          auth_token: authToken,
          pass_type_id: PASS_TYPE_ID,
          current_tips_pence: currentPeriodTips,
          status: 'active',
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        });
      }
    } catch (err) {}

    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      serialNumber: serialNumber,
      authenticationToken: authToken,
      webServiceURL: WEB_SERVICE_URL,
      organizationName: orgName,
      description: 'Employee Tips Pass',
      logoText: 'Tiply',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(16, 185, 129)',
      labelColor: 'rgb(209, 250, 229)',
      generic: {
        headerFields: [{ key: 'period', label: 'THIS WEEK', value: '£' + (currentPeriodTips / 100).toFixed(2) }],
        primaryFields: [{ key: 'name', label: 'EMPLOYEE', value: employee.full_name || 'Employee' }],
        secondaryFields: [
          { key: 'total', label: 'TOTAL EARNED', value: '£' + ((employee.total_earned_pence || 0) / 100).toFixed(2) },
          { key: 'pending', label: 'PENDING', value: '£' + ((employee.pending_pence || 0) / 100).toFixed(2) }
        ],
        auxiliaryFields: [
          { key: 'location', label: 'LOCATION', value: locationName },
          { key: 'role', label: 'ROLE', value: (employee.role || 'Server') }
        ],
        backFields: [
          { key: 'info', label: 'About', value: 'Track your tips in real-time with Tiply.' }
        ]
      },
      barcodes: [{
        format: 'PKBarcodeFormatQR',
        message: 'https://tiply.app/tip/' + employee_id + '/' + serialNumber,
        messageEncoding: 'iso-8859-1'
      }]
    };

    return Response.json({
      success: true,
      pass_data: {
        serial_number: serialNumber,
        employee_name: employee.full_name,
        current_tips: '£' + (currentPeriodTips / 100).toFixed(2),
        qr_url: 'https://tiply.app/tip/' + employee_id + '/' + serialNumber
      },
      pass_json: passJson
    });

  } catch (error) {
    console.error('Wallet pass error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});