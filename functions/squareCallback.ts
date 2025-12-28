import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  console.log('=== CALLBACK FUNCTION INVOKED ===');
  console.log('Request URL:', req.url);
  
  const url = new URL(req.url);
  const origin = url.origin;

  try {
    const base44 = createClientFromRequest(req);
    
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('OAuth callback received:', {
      has_code: !!code,
      has_state: !!state,
      error: error,
      error_description: errorDescription
    });

    // Handle OAuth errors
    if (error) {
      console.error('Square OAuth error:', error, errorDescription);
      const redirectUrl = `${origin}/Welcome?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`;
      return Response.redirect(redirectUrl, 302);
    }

    if (!code || !state) {
      console.error('Missing code or state');
      const redirectUrl = `${origin}/Welcome?error=missing_parameters`;
      return Response.redirect(redirectUrl, 302);
    }

    // Decode and validate state
    let stateData;
    try {
      const stateString = atob(state.replace(/-/g, '+').replace(/_/g, '/'));
      stateData = JSON.parse(stateString);
      console.log('State decoded:', {
        user_id: stateData.user_id,
        org_id: stateData.org_id,
        age_minutes: (Date.now() - stateData.timestamp) / (1000 * 60)
      });
    } catch (err) {
      console.error('Invalid state parameter:', err);
      const redirectUrl = `${origin}/Welcome?error=invalid_state`;
      return Response.redirect(redirectUrl, 302);
    }

    // Validate state timestamp (10 minute expiry)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      console.error('State expired:', { age_minutes: stateAge / (1000 * 60) });
      const redirectUrl = `${origin}/Welcome?error=state_expired`;
      return Response.redirect(redirectUrl, 302);
    }

    // Verify state exists in audit log (extra security)
    const auditEvents = await base44.asServiceRole.entities.SystemAuditEvent.filter({
      organization_id: stateData.org_id,
      event_type: 'square_connect_started',
      actor_user_id: stateData.user_id
    }, '-created_date', 5);

    const validState = auditEvents.find(e => 
      e.after_snapshot?.state_token === state &&
      new Date(e.after_snapshot?.expires_at) > new Date()
    );

    if (!validState) {
      console.error('State not found in audit log or expired');
      const redirectUrl = `${origin}/Welcome?error=invalid_state_token`;
      return Response.redirect(redirectUrl, 302);
    }

    // Exchange code for access token
    const SQUARE_APP_ID = (Deno.env.get('SQUARE_APP_ID') || '').trim();
    const SQUARE_APP_SECRET = (Deno.env.get('SQUARE_APP_SECRET') || '').trim();
    const SQUARE_ENVIRONMENT = (Deno.env.get('SQUARE_ENVIRONMENT') || 'production').toLowerCase().trim();

    if (!SQUARE_APP_ID || !SQUARE_APP_SECRET) {
      console.error('Missing Square credentials');
      const redirectUrl = `${origin}/Welcome?error=missing_configuration`;
      return Response.redirect(redirectUrl, 302);
    }

    const tokenUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    console.log('Exchanging code for token:', { 
      token_url: tokenUrl,
      environment: SQUARE_ENVIRONMENT 
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-12-18'
      },
      body: JSON.stringify({
        client_id: SQUARE_APP_ID,
        client_secret: SQUARE_APP_SECRET,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Square token exchange failed:', errorData);
      const redirectUrl = `${origin}/Welcome?error=token_exchange_failed&details=${encodeURIComponent(JSON.stringify(errorData))}`;
      return Response.redirect(redirectUrl, 302);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = tokenData.expires_at;
    const merchantId = tokenData.merchant_id;

    console.log('Token received:', {
      merchant_id: merchantId,
      has_access_token: !!accessToken,
      has_refresh_token: !!refreshToken,
      expires_at: expiresAt
    });

    // Get merchant profile
    const profileUrl = SQUARE_ENVIRONMENT === 'production'
      ? `https://connect.squareup.com/v2/merchants/${merchantId}`
      : `https://connect.squareupsandbox.com/v2/merchants/${merchantId}`;

    const profileResponse = await fetch(profileUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18'
      }
    });

    let merchantName = 'Unknown Merchant';
    let merchantCountry = 'GB';
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      merchantName = profileData.merchant?.business_name || merchantName;
      merchantCountry = profileData.merchant?.country || merchantCountry;
      console.log('Merchant profile:', { name: merchantName, country: merchantCountry });
    }

    // Store or update connection
    const existingConnections = await base44.asServiceRole.entities.SquareConnection.filter({
      organization_id: stateData.org_id,
      square_merchant_id: merchantId
    });

    let connection;
    if (existingConnections.length > 0) {
      connection = existingConnections[0];
      console.log('Updating existing connection:', connection.id);
      await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
        square_access_token_encrypted: accessToken,
        square_refresh_token_encrypted: refreshToken || '',
        token_expires_at: expiresAt || null,
        connection_status: 'connected',
        merchant_business_name: merchantName,
        merchant_country: merchantCountry,
        last_error: null,
        last_error_at: null
      });
    } else {
      console.log('Creating new connection');
      connection = await base44.asServiceRole.entities.SquareConnection.create({
        organization_id: stateData.org_id,
        square_merchant_id: merchantId,
        square_access_token_encrypted: accessToken,
        square_refresh_token_encrypted: refreshToken || '',
        token_expires_at: expiresAt || null,
        scopes: ['PAYMENTS_READ', 'MERCHANT_PROFILE_READ', 'EMPLOYEES_READ', 'TIMECARDS_READ'],
        merchant_business_name: merchantName,
        merchant_country: merchantCountry,
        connection_status: 'connected'
      });
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: stateData.org_id,
      event_type: 'square_connection_established',
      actor_type: 'user',
      actor_user_id: stateData.user_id,
      entity_type: 'square_connection',
      entity_id: connection.id,
      after_snapshot: {
        merchant_id: merchantId,
        merchant_name: merchantName,
        environment: SQUARE_ENVIRONMENT
      },
      changes_summary: `Square account connected: ${merchantName}`,
      severity: 'info'
    });

    // Trigger initial sync
    console.log('Starting initial sync...');
    let syncSuccess = false;
    let syncResults = null;
    let locationsCount = 0;
    let staffCount = 0;
    
    try {
      const syncResponse = await base44.asServiceRole.functions.invoke('squareSync', {
        connection_id: connection.id,
        triggered_by: 'initial_setup'
      });
      syncResults = syncResponse.data;
      syncSuccess = syncResults.success;

      console.log('Sync results:', syncResults);
      
      // Count synced entities
      const locations = await base44.asServiceRole.entities.Location.filter({
        organization_id: stateData.org_id
      });
      const employees = await base44.asServiceRole.entities.Employee.filter({
        organization_id: stateData.org_id
      });
      
      locationsCount = locations.length;
      staffCount = employees.length;
      
    } catch (syncError) {
      console.error('Initial sync failed:', syncError);
      await base44.asServiceRole.entities.AppError.create({
        organization_id: stateData.org_id,
        user_id: stateData.user_id,
        page: 'OAuth Callback',
        action_name: 'initial_sync',
        error_message: syncError.message,
        error_stack: syncError.stack,
        severity: 'warning',
        metadata: {
          connection_id: connection.id,
          merchant_id: merchantId
        }
      });
    }

    // Redirect to dashboard with success
    const params = new URLSearchParams({
      square_connected: '1',
      merchant: merchantName,
      sync_status: syncSuccess ? 'success' : 'partial',
      locations_synced: locationsCount.toString(),
      staff_synced: staffCount.toString()
    });
    
    const redirectUrl = `${origin}/Dashboard?${params.toString()}`;
    console.log('Redirecting to:', redirectUrl);
    
    // Return HTML with success message and auto-redirect
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Square Connected</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .container {
              text-align: center;
              color: white;
              padding: 2rem;
            }
            .icon {
              font-size: 4rem;
              margin-bottom: 1rem;
              animation: bounce 1s ease-in-out infinite;
            }
            h1 { font-size: 2rem; margin: 0 0 0.5rem 0; }
            p { font-size: 1.1rem; opacity: 0.9; }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✓</div>
            <h1>Square Connected Successfully!</h1>
            <p>Syncing your data... Redirecting to dashboard...</p>
          </div>
          <script>
            setTimeout(() => {
              window.location.href = ${JSON.stringify(redirectUrl)};
            }, 1500);
          </script>
        </body>
      </html>
    `, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Square OAuth callback error:', error);
    await base44.asServiceRole.entities.AppError.create({
      page: 'OAuth Callback',
      action_name: 'square_oauth_callback',
      error_message: error.message,
      error_stack: error.stack,
      severity: 'error'
    });
    const redirectUrl = `${origin}/Welcome?error=unexpected_error`;
    return Response.redirect(redirectUrl, 302);
  }
});