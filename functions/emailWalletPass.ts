import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { employee_id, pass_serial, pass_auth_token } = await req.json();

    if (!employee_id || !pass_serial || !pass_auth_token) {
      return Response.json({
        success: false,
        error: 'Missing required parameters'
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

    // Validate pass exists
    const passes = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id,
      pass_serial_number: pass_serial,
      pass_auth_token,
      pass_status: 'active'
    });

    if (passes.length === 0) {
      return Response.json({
        success: false,
        error: 'Wallet pass not found'
      }, { status: 404 });
    }

    const walletPass = passes[0];

    // Build pass download URL (using Base44 app domain)
    const baseUrl = Deno.env.get('BASE_URL') || 'https://tip-align-29fe435b.base44.app';
    const passUrl = `${baseUrl}/functions/employeePassPkpass?employeeId=${employee_id}&serial=${pass_serial}&auth=${pass_auth_token}`;

    // Build tipping URL for QR code
    const tipUrl = `${baseUrl}/tip/${employee_id}/${pass_serial}`;

    // Send email with pass link
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: employee.email,
      from_name: 'Tiply',
      subject: 'Your Tiply Wallet Pass',
      body: `
Hi ${employee.full_name.split(' ')[0]},

Your Tiply employee wallet pass is ready!

**What's inside:**
- Real-time tip tracking
- Lifetime earnings
- QR code for direct tips from customers

**To add to Apple Wallet:**
On your iPhone, tap this link:
${passUrl}

Then tap "Add" when the Wallet preview appears.

**Your personal tipping link:**
${tipUrl}

Share this link or QR code with customers who want to leave you a tip directly!

---
Tiply – Digital tip management
      `.trim()
    });

    // Log audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'employee_added',
      entity_type: 'wallet_pass',
      entity_id: walletPass.id,
      actor_email: user.email,
      actor_role: 'admin',
      reason: `Wallet pass emailed to ${employee.email}`,
      new_value: JSON.stringify({ employee_id, pass_serial }),
      hmrc_relevant: false
    });

    return Response.json({
      success: true,
      message: `Wallet pass sent to ${employee.email}`,
      pass_url: passUrl
    });

  } catch (error) {
    console.error('Email wallet pass error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});