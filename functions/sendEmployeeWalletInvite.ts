import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employee_id, channel = 'email' } = await req.json();

    if (!employee_id) {
      return Response.json({
        success: false,
        error: 'Missing employee_id'
      }, { status: 400 });
    }

    // Fetch employee
    const employees = await base44.asServiceRole.entities.Employee.filter({
      id: employee_id
    });

    if (employees.length === 0) {
      return Response.json({
        success: false,
        error: 'Employee not found'
      }, { status: 404 });
    }

    const employee = employees[0];

    if (!employee.email) {
      return Response.json({
        success: false,
        error: 'Employee has no email address'
      }, { status: 400 });
    }

    // Ensure EmployeeWalletPass exists
    let walletPasses = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id,
      pass_status: 'active'
    });

    let walletPass;
    if (walletPasses.length === 0) {
      // Create new pass
      const passSerial = `TIPLY-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const authToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      
      walletPass = await base44.asServiceRole.entities.EmployeeWalletPass.create({
        organization_id: employee.organization_id,
        employee_id,
        pass_serial_number: passSerial,
        pass_auth_token: authToken,
        pass_status: 'active',
        last_pass_update_at: new Date().toISOString(),
        last_tip_total: 0
      });
    } else {
      walletPass = walletPasses[0];
    }

    // Generate secure invite token (40+ chars)
    const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Build invite URL
    const baseUrl = Deno.env.get('BASE_URL') || 'https://tip-align-29fe435b.base44.app';
    const inviteUrl = `${baseUrl}/employee/wallet/invite/${inviteToken}`;

    // Create invite record
    const invite = await base44.asServiceRole.entities.EmployeeWalletInvite.create({
      organization_id: employee.organization_id,
      employee_id,
      invite_token: inviteToken,
      invite_url: inviteUrl,
      status: 'pending',
      sent_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      sent_via: channel,
      delivery_target: employee.email
    });

    // Send email
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: employee.email,
        from_name: 'Tiply',
        subject: 'Add your Tiply pass to Apple Wallet',
        body: `
Hi ${employee.full_name.split(' ')[0]},

Your personal Tiply wallet pass is ready! 

**Track your tips in real-time**
View your tip earnings, allocations, and history directly in your Apple Wallet.

**To add your pass:**
1. Open this email on your iPhone
2. Tap the button below
3. When the Wallet preview appears, tap "Add"

Add to Apple Wallet:
${inviteUrl}

Or copy this link: ${inviteUrl}

The invite link expires in 7 days. If you need a new one, ask your manager to resend.

---
Tiply – Digital tip management
        `.trim()
      });
    } catch (emailError) {
      // Update invite with error
      await base44.asServiceRole.entities.EmployeeWalletInvite.update(invite.id, {
        last_error: emailError.message
      });
      
      return Response.json({
        success: false,
        error: 'Failed to send email',
        details: emailError.message
      }, { status: 500 });
    }

    // Log audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'employee_added',
      entity_type: 'wallet_pass',
      entity_id: invite.id,
      actor_email: user.email,
      actor_role: 'admin',
      reason: `Wallet invite sent to ${employee.email}`,
      new_value: JSON.stringify({
        employee_id,
        invite_id: invite.id,
        delivery_target: employee.email,
        expires_at: expiresAt.toISOString()
      }),
      hmrc_relevant: false
    });

    return Response.json({
      success: true,
      message: `Wallet invite sent to ${employee.email}`,
      invite_id: invite.id,
      invite_url: inviteUrl,
      expires_at: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Send employee wallet invite error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});