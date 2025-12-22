import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Square OAuth error:', error, errorDescription);
      const redirectUrl = `${url.origin}/Dashboard?square_error=${encodeURIComponent(errorDescription || error)}`;
      return Response.redirect(redirectUrl, 302);
    }

    if (!code || !state) {
      const redirectUrl = `${url.origin}/Dashboard?square_error=missing_code_or_state`;
      return Response.redirect(redirectUrl, 302);
    }

    // Decode and validate state
    let stateData;
    try {
      const stateString = Buffer.from(state, 'base64url').toString('utf-8');
      stateData = JSON.parse(stateString);
    } catch (err) {
      console.error('Invalid state parameter:', err);
      const redirectUrl = `${url.origin}/Dashboard?square_error=invalid_state`;
      return Response.redirect(redirectUrl, 302);
    }

    // Validate state timestamp (10 minute expiry)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      const redirectUrl = `${url.origin}/Dashboard?square_error=state_expired`;
      return Response.redirect(redirectUrl, 302);
    }

    // Exchange code for access token
    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET');
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox';

    if (!SQUARE_APP_ID || !SQUARE_APP_SECRET) {
      const redirectUrl = `${url.origin}/Dashboard?square_error=missing_credentials`;
      return Response.redirect(redirectUrl, 302);
    }

    const tokenUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

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
      const redirectUrl = `${url.origin}/Dashboard?square_error=token_exchange_failed`;
      return Response.redirect(redirectUrl, 302);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = tokenData.expires_at;
    const merchantId = tokenData.merchant_id;

    // Get merchant profile
    const profileUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/v2/merchants'
      : 'https://connect.squareupsandbox.com/v2/merchants';

    const profileResponse = await fetch(`${profileUrl}/${merchantId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Square-Version': '2024-12-18'
      }
    });

    let merchantName = 'Unknown';
    let merchantCountry = 'GB';
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      merchantName = profileData.merchant?.business_name || merchantName;
      merchantCountry = profileData.merchant?.country || merchantCountry;
    }

    // Store or update connection
    const existingConnections = await base44.asServiceRole.entities.SquareConnection.filter({
      organization_id: stateData.org_id,
      square_merchant_id: merchantId
    });

    let connection;
    if (existingConnections.length > 0) {
      connection = existingConnections[0];
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
        merchant_name: merchantName
      },
      changes_summary: `Square account connected: ${merchantName}`,
      severity: 'info'
    });

    // Trigger initial sync in background
    try {
      await base44.asServiceRole.functions.invoke('squareSyncEngine', {
        connection_id: connection.id,
        entity_types: ['locations', 'team_members'],
        triggered_by: 'initial_setup'
      });
    } catch (syncError) {
      console.error('Initial sync failed:', syncError);
      // Don't fail the connection if sync fails
    }

    // Redirect back to dashboard
    const redirectUrl = `${url.origin}/Dashboard?square_connected=1&merchant=${encodeURIComponent(merchantName)}`;
    return Response.redirect(redirectUrl, 302);

  } catch (error) {
    console.error('Square OAuth callback error:', error);
    const url = new URL(req.url);
    const redirectUrl = `${url.origin}/Dashboard?square_error=unexpected_error`;
    return Response.redirect(redirectUrl, 302);
  }
});