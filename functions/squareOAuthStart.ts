import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_ENVIRONMENT = (Deno.env.get('SQUARE_ENVIRONMENT') || 'production').toLowerCase();
    const BASE_URL = Deno.env.get('BASE_URL');

    if (!SQUARE_APP_ID || !BASE_URL) {
      return Response.json({ 
        success: false, 
        error: 'Square not configured' 
      }, { status: 500 });
    }

    // Get user's active organization
    const memberships = await base44.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      status: 'active'
    });

    const ownerOrAdminMembership = memberships.find(m => 
      m.membership_role === 'owner' || m.membership_role === 'admin'
    );

    if (!ownerOrAdminMembership) {
      return Response.json({ 
        success: false, 
        error: 'No organization found' 
      }, { status: 400 });
    }

    const orgId = ownerOrAdminMembership.organization_id;

    // Generate state
    const stateData = {
      user_id: user.id,
      org_id: orgId,
      timestamp: Date.now()
    };
    
    const state = btoa(JSON.stringify(stateData))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Store state
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: orgId,
      event_type: 'square_connect_started',
      actor_type: 'user',
      actor_user_id: user.id,
      entity_type: 'square_connection',
      changes_summary: 'Square OAuth initiated',
      severity: 'info',
      after_snapshot: { 
        state_token: state,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
    });

    // Build OAuth URL
    const authUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: 'PAYMENTS_READ MERCHANT_PROFILE_READ EMPLOYEES_READ TIMECARDS_READ',
      session: 'false',
      state: state
    });

    const redirectUrl = `${authUrl}?${params.toString()}`;

    return Response.json({ 
      success: true, 
      redirect_url: redirectUrl
    });

  } catch (error) {
    console.error('Square OAuth start error:', error);
    return Response.json({ 
      success: false, 
      error: error.message
    }, { status: 500 });
  }
});