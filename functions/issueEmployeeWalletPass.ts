import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employee_id } = await req.json();

    if (!employee_id) {
      return Response.json({ error: 'Missing employee_id' }, { status: 400 });
    }

    const org_id = user.organization_id || user.id;

    // Verify employee exists and belongs to organization
    const employees = await base44.asServiceRole.entities.Employee.filter({ 
      id: employee_id,
      organization_id: org_id 
    });

    if (employees.length === 0) {
      return Response.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];

    // Check for existing active pass
    const existingPasses = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id,
      pass_status: 'active'
    });

    let walletPass;
    let isNew = false;

    if (existingPasses.length > 0) {
      // Reuse existing pass
      walletPass = existingPasses[0];
      console.log('Reusing existing pass:', walletPass.pass_serial_number);
    } else {
      // Generate secure random token
      const generateToken = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      };

      // Create new pass
      walletPass = await base44.asServiceRole.entities.EmployeeWalletPass.create({
        organization_id: org_id,
        employee_id,
        pass_serial_number: crypto.randomUUID(),
        pass_auth_token: generateToken(),
        pass_status: 'active',
        last_pass_update_at: new Date().toISOString(),
        last_tip_total: 0
      });
      
      isNew = true;
      console.log('Created new pass:', walletPass.pass_serial_number);
    }

    // Build URLs
    const baseUrl = Deno.env.get('BASE_URL') || 'https://tip-align-29fe435b.base44.app';
    const passUrl = `${baseUrl}/functions/employeeWalletPass?serial=${walletPass.pass_serial_number}&auth=${walletPass.pass_auth_token}`;
    const tippingUrl = `https://tiply.app/tip/${employee_id}/${walletPass.pass_serial_number}`;

    // Update QR URL
    await base44.asServiceRole.entities.EmployeeWalletPass.update(walletPass.id, {
      last_qr_url: tippingUrl
    });

    // Log audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'employee_wallet_pass_issued',
      entity_type: 'wallet_pass',
      entity_id: walletPass.id,
      actor_email: user.email,
      actor_role: user.role || 'admin',
      reason: `Apple Wallet pass ${isNew ? 'issued' : 'reissued'} for ${employee.full_name}`,
      hmrc_relevant: false
    });

    return Response.json({
      success: true,
      pass_id: walletPass.id,
      pass_serial_number: walletPass.pass_serial_number,
      add_to_apple_wallet_url: passUrl,
      tipping_qr_url: tippingUrl,
      employee_name: employee.full_name,
      is_new_pass: isNew
    });

  } catch (error) {
    console.error('Issue wallet pass error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});