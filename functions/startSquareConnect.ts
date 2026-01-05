import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { randomUUID } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's organization
    const memberships = await base44.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      status: 'active'
    });

    const membership = memberships.find(m => m.membership_role === 'owner' || m.membership_role === 'admin');
    if (!membership) {
      return Response.json({ error: 'No organization found or insufficient permissions' }, { status: 403 });
    }

    const orgId = membership.organization_id;

    // Create secure state payload
    const stateData = {
      user_id: user.id,
      org_id: orgId,
      timestamp: Date.now(),
      nonce: randomUUID()
    };

    // Encode state
    const raw = JSON.stringify(stateData);
    const b64 = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    // Log audit event
    await base44.asServiceRole.entities.AppError.create({
      organization_id: orgId,
      user_id: user.id,
      user_email: user.email,
      page: 'square_oauth',
      action_name: 'connect_started',
      error_message: 'Square OAuth flow initiated',
      severity: 'info',
      metadata: {
        state_token: b64,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
    });

    // Build Square OAuth URL
    const SQUARE_ENV = (Deno.env.get('SQUARE_ENVIRONMENT') || 'production').toLowerCase().trim();
    const baseAuth = SQUARE_ENV === 'production'
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const clientId = Deno.env.get('SQUARE_APP_ID');
    const redirectUri = 'https://tip-align-29fe435b.base44.app/functions/squareCallback';
    const scopes = [
      'MERCHANT_PROFILE_READ',
      'PAYMENTS_READ',
      'CUSTOMERS_READ',
      'ORDERS_READ',
      'EMPLOYEES_READ',
      'TEAM_MEMBERS_READ',
      'LABOR_READ'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      session: 'false',
      state: b64,
      redirect_uri: redirectUri,
      response_type: 'code'
    });

    const authUrl = `${baseAuth}?${params.toString()}`;

    return Response.json({ success: true, redirect_url: authUrl });

  } catch (error) {
    console.error('Start Square Connect error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
});