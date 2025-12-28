import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { employee_id, pass_serial, pass_auth } = await req.json();

    // Authenticate the admin user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Validate pass
    const passes = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id,
      pass_serial_number: pass_serial,
      pass_auth_token: pass_auth,
      pass_status: 'active'
    });

    if (passes.length === 0) {
      return Response.json({
        success: false,
        error: 'Pass not found or revoked'
      }, { status: 404 });
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
        error: 'Employee has no email configured'
      }, { status: 400 });
    }

    // Generate the .pkpass download URL using the Base44 app domain
    const baseUrl = Deno.env.get('BASE_URL') || 'https://tip-align-29fe435b.base44.app';
    const pkpassUrl = `${baseUrl}/functions/employeePassPkpass?employeeId=${employee_id}&serial=${pass_serial}&auth=${pass_auth}`;

    // Calculate current tips for email body
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const allAllocations = await base44.asServiceRole.entities.TipAllocation.filter({
      employee_id
    });

    const currentPeriodAllocations = allAllocations.filter(a => {
      const allocDate = new Date(a.allocation_date);
      return allocDate >= sevenDaysAgo && allocDate <= now;
    });

    const currentPeriodTotal = currentPeriodAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);

    // Send email with pass link
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: employee.email,
      from_name: 'Tiply',
      subject: 'Your Tiply Apple Wallet Pass',
      body: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #6366f1;">Your Tiply Wallet Pass is Ready!</h2>
            
            <p>Hi ${employee.full_name.split(' ')[0]},</p>
            
            <p>Your personal tip tracker for Apple Wallet is ready. This pass will show your current tips and lifetime earnings right on your iPhone's lock screen.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1e293b;">Your Current Tips</h3>
              <p style="font-size: 28px; font-weight: bold; color: #6366f1; margin: 10px 0;">
                £${(currentPeriodTotal / 100).toFixed(2)}
              </p>
              <p style="color: #64748b; margin: 0;">This week</p>
            </div>
            
            <h3>How to Add to Apple Wallet:</h3>
            <ol style="line-height: 1.8;">
              <li>Open this email on your iPhone</li>
              <li>Tap the link below to download your pass</li>
              <li>Tap "Add" when the Wallet preview appears</li>
              <li>Your pass will update automatically when you receive tips!</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${pkpassUrl}" 
                 style="display: inline-block; background: #000; color: #fff; padding: 14px 32px; 
                        text-decoration: none; border-radius: 8px; font-weight: bold;">
                Add to Apple Wallet
              </a>
            </div>
            
            <div style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 20px;">
              <p style="margin: 0; font-size: 14px; color: #1e40af;">
                <strong>💡 Tip:</strong> Your pass also includes a QR code that customers can scan to tip you directly!
              </p>
            </div>
            
            <p style="margin-top: 30px; color: #64748b; font-size: 12px;">
              Questions? Contact your manager or admin team.
            </p>
          </body>
        </html>
      `
    });

    // Log audit event
    await base44.asServiceRole.entities.AuditLog.create({
      action_type: 'tip_allocated',
      entity_type: 'wallet_pass',
      entity_id: employee_id,
      actor_email: user.email,
      actor_role: 'admin',
      reason: `Wallet pass emailed to ${employee.email}`,
      new_value: JSON.stringify({
        employee_id,
        employee_email: employee.email,
        pass_serial
      }),
      hmrc_relevant: false
    });

    return Response.json({
      success: true,
      message: `Pass emailed to ${employee.email}`
    });

  } catch (error) {
    console.error('Email wallet pass error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});