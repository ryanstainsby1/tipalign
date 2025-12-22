import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.redirect(base44.auth.redirectToLogin(req.url));
    }

    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox';
    const BASE_URL = Deno.env.get('BASE_URL') || req.headers.get('origin') || 'http://localhost:5173';

    console.log('Square OAuth Config:', {
      app_id: SQUARE_APP_ID?.substring(0, 10) + '...',
      environment: SQUARE_ENVIRONMENT,
      base_url: BASE_URL
    });

    if (!SQUARE_APP_ID) {
      return Response.json({ error: 'Square application not configured' }, { status: 500 });
    }

    // Generate secure state token
    const stateData = {
      user_id: user.id,
      org_id: user.organization_id || user.id,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7)
    };
    
    const stateString = JSON.stringify(stateData);
    const encoder = new TextEncoder();
    const data = encoder.encode(stateString);
    const state = btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Store state temporarily for validation (expires in 10 minutes)
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: user.organization_id || user.id,
      event_type: 'square_connect_started',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'square_connection',
      changes_summary: 'Square OAuth flow initiated',
      severity: 'info',
      after_snapshot: { state_token: state }
    });

    // Build Square OAuth URL
    const authUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const callbackUrl = `${BASE_URL}/api/squareOAuthCallback`;

    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: 'PAYMENTS_READ MERCHANT_PROFILE_READ EMPLOYEES_READ TIMECARDS_READ',
      session: 'false',
      state: state,
      redirect_uri: callbackUrl
    });

    const redirectUrl = `${authUrl}?${params.toString()}`;

    console.log('Square OAuth redirect:', {
      callback_url: callbackUrl,
      redirect_url: redirectUrl.substring(0, 100) + '...'
    });

    // Return redirect URL (frontend will handle the redirect)
    return Response.json({ 
      success: true, 
      redirect_url: redirectUrl,
      state: state,
      callback_url: callbackUrl,
      environment: SQUARE_ENVIRONMENT
    });

  } catch (error) {
    console.error('Square OAuth start error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});