import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    
    let employee_id;
    if (req.method === 'GET') {
      employee_id = url.searchParams.get('employee_id') || '';
    } else {
      const body = await req.json();
      employee_id = body.employee_id || '';
    }

    console.log('=== PKPass Generator ===');

    if (!employee_id) {
      return Response.json({ success: false, error: 'employee_id is required' }, { status: 400 });
    }

    const PASS_TYPE_ID = Deno.env.get('APPLE_WALLET_PASS_TYPE_ID');
    const TEAM_ID = Deno.env.get('APPLE_WALLET_TEAM_ID');
    const CERT_P12_BASE64 = Deno.env.get('APPLE_WALLET_CERT_P12_BASE64');
    const CERT_PASSWORD = Deno.env.get('APPLE_WALLET_CERT_PASSWORD');
    const WEB_SERVICE_URL = Deno.env.get('APPLE_WALLET_WEB_SERVICE_URL') || 'https://tiply.co.uk/functions/walletWebService';

    if (!PASS_TYPE_ID || !TEAM_ID) {
      return Response.json({
        success: false,
        error: 'Apple Wallet not configured. Set APPLE_WALLET_PASS_TYPE_ID and APPLE_WALLET_TEAM_ID.',
        setup_required: true
      }, { status: 400 });
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
    let totalEarned = employee.total_earned_pence || 0;
    let pending = employee.pending_pence || 0;

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
    } catch (e) {}

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
    } catch (e) {}

    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: PASS_TYPE_ID,
      teamIdentifier: TEAM_ID,
      serialNumber: serialNumber,
      authenticationToken: authToken,
      webServiceURL: WEB_SERVICE_URL,
      organizationName: orgName,
      description: employee.full_name + ' - Tips Pass',
      logoText: 'Tiply',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(16, 185, 129)',
      labelColor: 'rgb(209, 250, 229)',
      generic: {
        headerFields: [{ key: 'period', label: 'THIS WEEK', value: '£' + (currentPeriodTips / 100).toFixed(2), textAlignment: 'PKTextAlignmentRight' }],
        primaryFields: [{ key: 'name', label: 'EMPLOYEE', value: employee.full_name || 'Employee' }],
        secondaryFields: [
          { key: 'total', label: 'TOTAL EARNED', value: '£' + (totalEarned / 100).toFixed(2) },
          { key: 'pending', label: 'PENDING', value: '£' + (pending / 100).toFixed(2) }
        ],
        auxiliaryFields: [
          { key: 'location', label: 'LOCATION', value: locationName },
          { key: 'role', label: 'ROLE', value: (employee.role || 'Server') }
        ],
        backFields: [
          { key: 'details', label: 'Tip Details', value: 'Current Week: £' + (currentPeriodTips / 100).toFixed(2) + '\nTotal Earned: £' + (totalEarned / 100).toFixed(2) + '\nPending: £' + (pending / 100).toFixed(2) },
          { key: 'employer', label: 'Employer', value: orgName },
          { key: 'updated', label: 'Last Updated', value: new Date().toLocaleString('en-GB') },
          { key: 'help', label: 'Need Help?', value: 'Contact your manager or visit tiply.co.uk/support' }
        ]
      },
      barcodes: [{
        format: 'PKBarcodeFormatQR',
        message: 'https://tiply.app/tip/' + employee_id + '/' + serialNumber,
        messageEncoding: 'iso-8859-1',
        altText: 'Scan to tip'
      }]
    };

    return Response.json({
      success: true,
      message: 'Pass JSON generated',
      pass_json: passJson,
      serial_number: serialNumber,
      employee_name: employee.full_name,
      download_note: 'Full .pkpass signing requires server-side implementation. Use pass_json to create passes via PassKit or similar service.'
    });

  } catch (error) {
    console.error('PKPass error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});