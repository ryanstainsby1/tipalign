import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { employee_id, invite_method = 'email', custom_message } = body;

    console.log('=== Wallet Invite Service ===');
    console.log('Employee:', employee_id, 'Method:', invite_method);

    if (!employee_id) {
      return Response.json({ success: false, error: 'employee_id is required' }, { status: 400 });
    }

    // Check Apple Wallet configuration
    const PASS_TYPE_ID = Deno.env.get('APPLE_WALLET_PASS_TYPE_ID');
    const TEAM_ID = Deno.env.get('APPLE_WALLET_TEAM_ID');
    
    if (!PASS_TYPE_ID || !TEAM_ID) {
      return Response.json({ 
        success: false, 
        error: 'Apple Wallet is not configured. Please contact support.',
        config_missing: true
      }, { status: 400 });
    }

    // Get employee
    const employees = await base44.asServiceRole.entities.Employee.filter({ id: employee_id });
    if (employees.length === 0) {
      return Response.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];
    const orgId = employee.organization_id;

    // Validate email for email invites
    if (invite_method === 'email') {
      if (!employee.email || !employee.email.includes('@')) {
        return Response.json({ 
          success: false, 
          error: 'Employee does not have a valid email address. Please update their profile first.'
        }, { status: 400 });
      }
    }

    // Get organization name
    let orgName = 'Tiply';
    try {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
      if (orgs.length > 0) orgName = orgs[0].name || 'Tiply';
    } catch (e) {}

    // Generate/get serial number
    let serialNumber = employee.wallet_serial_number;
    if (!serialNumber) {
      serialNumber = crypto.randomUUID();
      await base44.asServiceRole.entities.Employee.update(employee_id, {
        wallet_serial_number: serialNumber,
        wallet_status: 'invited',
        wallet_last_updated: new Date().toISOString()
      });
    }

    // Generate URLs
    const webUrl = 'https://tiply.co.uk/wallet/' + employee_id + '/' + serialNumber;
    const downloadUrl = 'https://tiply.co.uk/api/wallet/download/' + employee_id;

    // Create invite record
    let inviteId = null;
    try {
      const invite = await base44.asServiceRole.entities.WalletInvite.create({
        organization_id: orgId,
        employee_id: employee_id,
        invite_type: invite_method,
        recipient: employee.email,
        status: 'pending',
        sent_at: new Date().toISOString()
      });
      inviteId = invite.id;
    } catch (e) {
      console.log('Could not create invite record:', e.message);
    }

    // Send email
    if (invite_method === 'email') {
      const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #10b981; margin: 0; font-size: 28px;">💰 Tiply</h1>
      <p style="color: #666; margin: 8px 0 0 0;">Your Tips, In Your Wallet</p>
    </div>

    <h2 style="color: #1f2937; margin-bottom: 16px;">Hi ${employee.full_name}!</h2>
    
    <p style="margin-bottom: 20px;">Great news! You can now track your tips in real-time directly from your iPhone using Apple Wallet.</p>

    ${custom_message ? `<div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 20px;">${custom_message}</div>` : ''}

    <div style="text-align: center; margin: 32px 0;">
      <a href="${webUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16,185,129,0.4);">
        📱 Add to Apple Wallet
      </a>
    </div>

    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">What you'll get:</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 12px;">
        <div style="flex: 1; min-width: 120px;">✅ Real-time tip updates</div>
        <div style="flex: 1; min-width: 120px;">✅ Weekly earnings summary</div>
        <div style="flex: 1; min-width: 120px;">✅ Total tips tracker</div>
        <div style="flex: 1; min-width: 120px;">✅ Works offline</div>
      </div>
    </div>

    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      Your pass updates automatically whenever tips are processed. No app download required!
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      Sent by ${orgName} via Tiply<br>
      <a href="https://tiply.co.uk/support" style="color: #10b981;">Need help?</a>
    </p>
  </div>
</body>
</html>`;

      const emailText = `Hi ${employee.full_name}!\n\nGreat news! You can now track your tips in real-time using Apple Wallet.\n\nAdd to Apple Wallet: ${webUrl}\n\nYour pass updates automatically whenever tips are processed.\n\nSent by ${orgName} via Tiply`;

      let emailSent = false;
      let emailError = null;

      // Try SendGrid first
      if (SENDGRID_API_KEY) {
        try {
          const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + SENDGRID_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: employee.email, name: employee.full_name }] }],
              from: { email: 'noreply@tiply.co.uk', name: 'Tiply' },
              subject: '📱 Your Tiply Wallet Pass is Ready!',
              content: [
                { type: 'text/plain', value: emailText },
                { type: 'text/html', value: emailHtml }
              ]
            })
          });

          if (sgResponse.ok || sgResponse.status === 202) {
            emailSent = true;
            console.log('Email sent via SendGrid');
          } else {
            emailError = await sgResponse.text();
            console.error('SendGrid error:', emailError);
          }
        } catch (e) {
          emailError = e.message;
          console.error('SendGrid exception:', emailError);
        }
      }

      // Try Resend as fallback
      if (!emailSent && RESEND_API_KEY) {
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + RESEND_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Tiply <noreply@tiply.co.uk>',
              to: [employee.email],
              subject: '📱 Your Tiply Wallet Pass is Ready!',
              html: emailHtml,
              text: emailText
            })
          });

          if (resendResponse.ok) {
            emailSent = true;
            console.log('Email sent via Resend');
          } else {
            emailError = await resendResponse.text();
            console.error('Resend error:', emailError);
          }
        } catch (e) {
          emailError = e.message;
          console.error('Resend exception:', emailError);
        }
      }

      // Update invite record
      if (inviteId) {
        try {
          await base44.asServiceRole.entities.WalletInvite.update(inviteId, {
            status: emailSent ? 'sent' : 'failed',
            error_message: emailSent ? null : emailError
          });
        } catch (e) {}
      }

      // Update employee status
      await base44.asServiceRole.entities.Employee.update(employee_id, {
        wallet_status: emailSent ? 'invited' : 'invite_failed',
        wallet_last_updated: new Date().toISOString()
      });

      if (emailSent) {
        return Response.json({
          success: true,
          message: 'Wallet invite sent successfully to ' + employee.email,
          method: 'email',
          recipient: employee.email,
          employee_name: employee.full_name
        });
      } else {
        // No email provider configured or all failed
        if (!SENDGRID_API_KEY && !RESEND_API_KEY) {
          return Response.json({
            success: true,
            message: 'Email service not configured. Share this link manually with the employee.',
            method: 'manual',
            wallet_url: webUrl,
            employee_name: employee.full_name,
            employee_email: employee.email,
            requires_manual_share: true
          });
        }
        
        return Response.json({
          success: false,
          error: 'Failed to send email. Please try again or share the link manually.',
          wallet_url: webUrl,
          debug_error: emailError
        }, { status: 500 });
      }
    }

    // For 'link' method, just return the URL
    return Response.json({
      success: true,
      method: 'link',
      wallet_url: webUrl,
      download_url: downloadUrl,
      serial_number: serialNumber,
      employee_name: employee.full_name
    });

  } catch (error) {
    console.error('Invite error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});