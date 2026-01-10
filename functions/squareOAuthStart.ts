import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  console.log('=== SQUARE OAUTH START ===');
  
  try {
    const base44 = createClientFromRequest(req);
    console.log('SDK initialized');
    
    const user = await base44.auth.me();
    console.log('User authenticated:', user?.id);

    if (!user) {
      return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'production';
    const BASE_URL = Deno.env.get('BASE_URL');

    console.log('Config:', { has_app_id: !!SQUARE_APP_ID, env: SQUARE_ENVIRONMENT, has_base_url: !!BASE_URL });

    if (!SQUARE_APP_ID || !BASE_URL) {
      return Response.json({ success: false, error: 'Missing config' }, { status: 500 });
    }

    // Get organization - use asServiceRole for reliable access
    console.log('Fetching memberships for user:', user.id);
    const userMemberships = await base44.asServiceRole.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      status: 'active'
    });
    console.log('User active memberships:', userMemberships.length);

    if (userMemberships.length === 0) {
      return Response.json({ success: false, error: 'No organization found' }, { status: 400 });
    }

    const membership = userMemberships.find(m => m.membership_role === 'owner' || m.membership_role === 'admin');
    if (!membership) {
      return Response.json({ success: false, error: 'Not owner/admin' }, { status: 403 });
    }

    const orgId = membership.organization_id;
    console.log('Using organization:', orgId);

    // Create state
    const stateData = { user_id: user.id, org_id: orgId, timestamp: Date.now() };
    const state = btoa(JSON.stringify(stateData)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    console.log('State created, length:', state.length);

    const authUrl = SQUARE_ENVIRONMENT === 'production' 
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const redirectUri = `${BASE_URL}/functions/squareCallback`;

    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: 'PAYMENTS_READ MERCHANT_PROFILE_READ EMPLOYEES_READ TIMECARDS_READ',
      session: 'false',
      state: state,
      redirect_uri: redirectUri
    });

    const redirectUrl = `${authUrl}?${params}`;
    console.log('Redirect URL prepared');

    return Response.json({ success: true, redirect_url: redirectUrl });

  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});