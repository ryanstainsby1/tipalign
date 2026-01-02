import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    console.log('Request received, attempting authentication...');
    
    let user;
    try {
      user = await base44.auth.me();
      console.log('User authenticated:', { id: user.id, email: user.email });
    } catch (authError) {
      console.error('Authentication failed:', authError);
      return Response.json({ 
        success: false, 
        error: 'Authentication required. Please log in.',
        details: authError.message
      }, { status: 401 });
    }

    if (!user) {
      return Response.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const SQUARE_APP_ID = (Deno.env.get('SQUARE_APP_ID') || '').trim();
    const SQUARE_ENVIRONMENT = (Deno.env.get('SQUARE_ENVIRONMENT') || 'production').toLowerCase().trim();
    const BASE_URL = (Deno.env.get('BASE_URL') || '').trim();

    console.log('Square OAuth Start:', {
      app_id: SQUARE_APP_ID ? `${SQUARE_APP_ID.substring(0, 15)}...` : 'missing',
      environment: SQUARE_ENVIRONMENT,
      base_url: BASE_URL
    });

    if (!SQUARE_APP_ID) {
      return Response.json({ 
        success: false, 
        error: 'Square application not configured. Please set SQUARE_APP_ID.' 
      }, { status: 500 });
    }

    if (!BASE_URL) {
      return Response.json({ 
        success: false, 
        error: 'BASE_URL not configured. Please set BASE_URL in environment variables.' 
      }, { status: 500 });
    }

    // Generate secure state token
    const stateData = {
      user_id: user.id,
      org_id: user.organization_id || user.id,
      timestamp: Date.now(),
      nonce: crypto.randomUUID()
    };
    
    const stateString = JSON.stringify(stateData);
    const encoder = new TextEncoder();
    const data = encoder.encode(stateString);
    const state = btoa(String.fromCharCode(...data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Store state for validation (expires in 10 minutes)
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: stateData.org_id,
      event_type: 'square_connect_started',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'square_connection',
      changes_summary: 'Square OAuth flow initiated',
      severity: 'info',
      after_snapshot: { 
        state_token: state,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
    });

    // Build Square OAuth URL
    const authUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/authorize'
      : 'https://connect.squareupsandbox.com/oauth2/authorize';

    const callbackUrl = `${BASE_URL}/functions/squareCallback`;

    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: 'PAYMENTS_READ MERCHANT_PROFILE_READ EMPLOYEES_READ TIMECARDS_READ',
      session: 'false',
      state: state
    });

    const redirectUrl = `${authUrl}?${params.toString()}`;

    console.log('OAuth redirect prepared:', {
      callback_url: callbackUrl,
      environment: SQUARE_ENVIRONMENT,
      state_length: state.length,
      org_id: stateData.org_id
    });

    return Response.json({ 
      success: true, 
      redirect_url: redirectUrl,
      state: state,
      callback_url: callbackUrl,
      environment: SQUARE_ENVIRONMENT
    });

  } catch (error) {
    console.error('Square OAuth start error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause
    });
    return Response.json({ 
      success: false, 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});