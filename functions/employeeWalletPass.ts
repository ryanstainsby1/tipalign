import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // This endpoint is PUBLIC but secured by serial + auth token
    const url = new URL(req.url);
    const serial = url.searchParams.get('serial');
    const auth = url.searchParams.get('auth');

    if (!serial || !auth) {
      return Response.json({ error: 'Missing serial or auth parameters' }, { status: 400 });
    }

    // Initialize base44 without auth (public endpoint)
    const base44 = createClientFromRequest(req);

    // Validate serial + auth
    const passes = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      pass_serial_number: serial,
      pass_auth_token: auth,
      pass_status: 'active'
    });

    if (passes.length === 0) {
      return Response.json({ error: 'Invalid or revoked pass' }, { status: 403 });
    }

    const walletPass = passes[0];

    // Fetch employee details
    const employees = await base44.asServiceRole.entities.Employee.filter({ 
      id: walletPass.employee_id 
    });

    if (employees.length === 0) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];

    // Calculate tip metrics (last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const allAllocations = await base44.asServiceRole.entities.TipAllocation.filter({
      employee_id: employee.id
    });

    const currentPeriodAllocations = allAllocations.filter(a => {
      const allocDate = new Date(a.allocation_date);
      return allocDate >= sevenDaysAgo && allocDate <= now;
    });

    const currentPeriodTotal = currentPeriodAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);
    const lifetimeTotal = allAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);

    // Get last 3 allocations
    const sortedAllocations = allAllocations
      .sort((a, b) => new Date(b.allocation_date) - new Date(a.allocation_date))
      .slice(0, 3);

    // Build Apple Wallet pass JSON (PKPass structure)
    const passData = {
      formatVersion: 1,
      passTypeIdentifier: "pass.com.tiply.employee",
      serialNumber: walletPass.pass_serial_number,
      teamIdentifier: Deno.env.get('APPLE_TEAM_ID') || 'YOUR_TEAM_ID',
      organizationName: "Tiply",
      description: `${employee.full_name} Tips Tracker`,
      logoText: "Tiply Tips",
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(99, 102, 241)",
      labelColor: "rgb(255, 255, 255)",
      
      generic: {
        primaryFields: [{
          key: "this_week",
          label: "This Week",
          value: `£${(currentPeriodTotal / 100).toFixed(2)}`
        }],
        secondaryFields: [{
          key: "lifetime",
          label: "Lifetime Tips",
          value: `£${(lifetimeTotal / 100).toFixed(2)}`
        }],
        auxiliaryFields: [
          {
            key: "role",
            label: "Role",
            value: employee.role || "Staff"
          },
          {
            key: "location",
            label: "Location",
            value: employee.locations?.[0] || "All Locations"
          }
        ],
        backFields: [
          {
            key: "recent_tips",
            label: "Recent Tips",
            value: sortedAllocations.map(a => 
              `${new Date(a.allocation_date).toLocaleDateString()}: £${(a.gross_amount / 100).toFixed(2)}`
            ).join('\n') || 'No recent tips'
          }
        ]
      },

      barcode: {
        message: walletPass.last_qr_url || `https://tiply.app/tip/${employee.id}/${serial}`,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1"
      },

      authenticationToken: walletPass.pass_auth_token,
      webServiceURL: `${Deno.env.get('BASE_URL') || 'https://tip-align-29fe435b.base44.app'}/functions`,
      
      relevantDate: new Date().toISOString()
    };

    // Update pass metadata
    await base44.asServiceRole.entities.EmployeeWalletPass.update(walletPass.id, {
      last_pass_update_at: new Date().toISOString(),
      last_tip_total: currentPeriodTotal,
      last_period_start: sevenDaysAgo.toISOString().split('T')[0],
      last_period_end: now.toISOString().split('T')[0]
    });

    // Note: Full .pkpass generation requires signing with Apple certificate
    // This would typically use a library like passkit-generator
    // For now, return the pass JSON structure
    
    // In production, you would:
    // 1. Sign the pass.json with your certificate
    // 2. Create manifest.json with file hashes
    // 3. Sign manifest.json
    // 4. Package everything into a .pkpass zip file
    // 5. Return with Content-Type: application/vnd.apple.pkpass

    return Response.json(passData, {
      headers: {
        'Content-Type': 'application/json'
        // In production: 'Content-Type': 'application/vnd.apple.pkpass'
      }
    });

  } catch (error) {
    console.error('Wallet pass generation error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});