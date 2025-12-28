import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employeeId');
    const serial = url.searchParams.get('serial');
    const auth = url.searchParams.get('auth');

    if (!employeeId || !serial || !auth) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Validate serial + auth
    const passes = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id: employeeId,
      pass_serial_number: serial,
      pass_auth_token: auth,
      pass_status: 'active'
    });

    if (passes.length === 0) {
      return Response.json({ error: 'Invalid or revoked pass' }, { status: 403 });
    }

    const walletPass = passes[0];

    // Fetch employee
    const employees = await base44.asServiceRole.entities.Employee.filter({ 
      id: employeeId 
    });

    if (employees.length === 0) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];

    // Calculate tips
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const allAllocations = await base44.asServiceRole.entities.TipAllocation.filter({
      employee_id: employeeId
    });

    const currentPeriodAllocations = allAllocations.filter(a => {
      const allocDate = new Date(a.allocation_date);
      return allocDate >= sevenDaysAgo && allocDate <= now;
    });

    const currentPeriodTotal = currentPeriodAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);
    const lifetimeTotal = allAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);

    const last3Allocations = allAllocations
      .sort((a, b) => new Date(b.allocation_date) - new Date(a.allocation_date))
      .slice(0, 3);

    // Build pass.json
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: Deno.env.get('APPLE_WALLET_PASS_TYPE_ID') || 'pass.com.tiply.employee',
      serialNumber: serial,
      teamIdentifier: Deno.env.get('APPLE_WALLET_TEAM_ID') || 'YOUR_TEAM_ID',
      organizationName: 'Tiply',
      description: `${employee.full_name} - Tip Tracker`,
      logoText: 'Tiply',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(99, 102, 241)',
      labelColor: 'rgb(255, 255, 255)',
      
      generic: {
        primaryFields: [{
          key: 'this_period',
          label: 'This Week',
          value: `£${(currentPeriodTotal / 100).toFixed(2)}`,
          textAlignment: 'PKTextAlignmentLeft'
        }],
        secondaryFields: [{
          key: 'lifetime',
          label: 'Lifetime Tips',
          value: `£${(lifetimeTotal / 100).toFixed(2)}`,
          textAlignment: 'PKTextAlignmentLeft'
        }],
        auxiliaryFields: [
          {
            key: 'role',
            label: 'Role',
            value: employee.role || 'Staff',
            textAlignment: 'PKTextAlignmentLeft'
          },
          {
            key: 'location',
            label: 'Location',
            value: employee.locations?.[0] || 'All Locations',
            textAlignment: 'PKTextAlignmentRight'
          }
        ],
        backFields: [
          {
            key: 'employee_name',
            label: 'Employee',
            value: employee.full_name
          },
          {
            key: 'recent_tips_header',
            label: 'Recent Tips',
            value: ''
          },
          {
            key: 'recent_tips',
            label: '',
            value: last3Allocations.length > 0 
              ? last3Allocations.map(a => 
                  `${new Date(a.allocation_date).toLocaleDateString('en-GB')}: £${(a.gross_amount / 100).toFixed(2)}`
                ).join('\n')
              : 'No recent tips'
          }
        ]
      },

      barcode: {
        message: `https://tiply.app/tip/${employeeId}/${serial}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1'
      },

      authenticationToken: auth,
      webServiceURL: `${Deno.env.get('BASE_URL') || 'https://tip-align-29fe435b.base44.app'}/functions`,
      
      relevantDate: new Date().toISOString()
    };

    // Check if we have certificate configuration
    const certP12Base64 = Deno.env.get('APPLE_WALLET_CERT_P12_BASE64');
    const certPassword = Deno.env.get('APPLE_WALLET_CERT_PASSWORD');

    if (!certP12Base64 || !certPassword) {
      // Certificate not configured - return pass JSON for testing
      console.warn('Apple Wallet certificate not configured. Set APPLE_WALLET_CERT_P12_BASE64 and APPLE_WALLET_CERT_PASSWORD');
      
      return Response.json({
        error: 'Apple Wallet certificate not configured',
        instructions: 'Contact your administrator to set up Apple Wallet certificates',
        pass_data: passJson
      }, { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // TODO: IMPLEMENT ACTUAL .PKPASS GENERATION
    // This requires:
    // 1. Create a temporary directory
    // 2. Write pass.json
    // 3. Download and add icon.png, icon@2x.png, logo.png, logo@2x.png
    // 4. Generate manifest.json with SHA1 hashes of all files
    // 5. Sign manifest.json using the certificate to create signature
    // 6. Zip all files into .pkpass
    // 7. Return with Content-Type: application/vnd.apple.pkpass

    // For now, use a library or manual implementation
    // Example structure:
    /*
    const tempDir = await Deno.makeTempDir();
    
    // Write pass.json
    await Deno.writeTextFile(`${tempDir}/pass.json`, JSON.stringify(passJson));
    
    // Download/copy icons (you need to have these in your project)
    // await Deno.copyFile('icons/icon.png', `${tempDir}/icon.png`);
    
    // Generate manifest.json
    const manifest = await generateManifest(tempDir);
    await Deno.writeTextFile(`${tempDir}/manifest.json`, JSON.stringify(manifest));
    
    // Sign manifest with certificate
    const signature = await signManifest(manifest, certP12Base64, certPassword);
    await Deno.writeFile(`${tempDir}/signature`, signature);
    
    // Create .pkpass zip
    const pkpassData = await createZip(tempDir);
    
    // Clean up
    await Deno.remove(tempDir, { recursive: true });
    
    return new Response(pkpassData, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="tiply-employee.pkpass"'
      }
    });
    */

    // Placeholder response until signing is implemented
    return Response.json({
      error: 'PKPass generation not fully implemented',
      message: 'Certificate is configured but signing logic needs to be completed',
      instructions: 'The .pkpass generation requires certificate signing implementation',
      pass_data: passJson
    }, { 
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('PKPass generation error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});