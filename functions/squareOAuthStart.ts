import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'production';
    const BASE_URL = Deno.env.get('BASE_URL');

    if (!SQUARE_APP_ID || !BASE_URL) {
      return Response.json({ success: false, error: 'Missing config' }, { status: 500 });
    }

    // Get organization
    const memberships = await base44.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      status: 'active'
    });

    if (memberships.length === 0) {
      return Response.json({ success: false, error: 'No organization' }, { status: 400 });
    }

    const membership = memberships.find(m => m.membership_role === 'owner' || m.membership_role === 'admin');
    if (!membership) {
      return Response.json({ success: false, error: 'Not owner/admin' }, { status: 403 });
    }

    const orgId = membership.organization_id;

    // Create state
    const stateData = { user_id: user.id, org_id: orgId, timestamp: Date.now() };
    const state = btoa(JSON.stringify(stateData)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Log state
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: orgId,
      event_type: 'square_connect_started',
      actor_type: 'user',
      actor_user_id: user.id,
      entity_type: 'square_connection',
      changes_summary: 'OAuth started',
      severity: 'info',
      after_snapshot: { state_token: state, expires_at: new Date(Date.now() + 600000).toISOString() }
    });

    const authUrl = SQUARE_ENVIRONMENT === 'production' 
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: 'PAYMENTS_READ MERCHANT_PROFILE_READ EMPLOYEES_READ TIMECARDS_READ',
      session: 'false',
      state: state
    });

    return Response.json({ success: true, redirect_url: `${authUrl}?${params}` });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});