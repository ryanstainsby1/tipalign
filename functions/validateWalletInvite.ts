import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { invite_token } = await req.json();

    if (!invite_token) {
      return Response.json({
        valid: false,
        error: 'Missing invite_token'
      }, { status: 400 });
    }

    // Look up invite
    const invites = await base44.asServiceRole.entities.EmployeeWalletInvite.filter({
      invite_token
    });

    if (invites.length === 0) {
      return Response.json({
        valid: false,
        error: 'Invite not found'
      });
    }

    const invite = invites[0];

    // Check status
    if (invite.status === 'expired' || invite.status === 'revoked') {
      return Response.json({
        valid: false,
        error: 'This invite has been revoked or expired'
      });
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    
    if (now > expiresAt) {
      // Mark as expired
      await base44.asServiceRole.entities.EmployeeWalletInvite.update(invite.id, {
        status: 'expired'
      });
      
      return Response.json({
        valid: false,
        error: 'This invite has expired'
      });
    }

    // Update status to opened if still pending
    if (invite.status === 'pending') {
      await base44.asServiceRole.entities.EmployeeWalletInvite.update(invite.id, {
        status: 'opened',
        opened_at: new Date().toISOString()
      });
    }

    // Get wallet pass details
    const passes = await base44.asServiceRole.entities.EmployeeWalletPass.filter({
      employee_id: invite.employee_id,
      pass_status: 'active'
    });

    if (passes.length === 0) {
      return Response.json({
        valid: false,
        error: 'Wallet pass not found'
      });
    }

    const walletPass = passes[0];

    // Build pass URL with invite token for tracking
    const baseUrl = Deno.env.get('BASE_URL') || 'https://tip-align-29fe435b.base44.app';
    const passUrl = `${baseUrl}/functions/employeePassPkpass?employeeId=${invite.employee_id}&serial=${walletPass.pass_serial_number}&auth=${walletPass.pass_auth_token}&invite_token=${invite_token}`;

    return Response.json({
      valid: true,
      invite: {
        id: invite.id,
        status: invite.status,
        expires_at: invite.expires_at,
        invite_url: invite.invite_url
      },
      pass_url: passUrl
    });

  } catch (error) {
    console.error('Validate wallet invite error:', error);
    return Response.json({
      valid: false,
      error: error.message
    }, { status: 500 });
  }
});