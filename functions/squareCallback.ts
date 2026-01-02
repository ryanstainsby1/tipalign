import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const origin = url.origin;
  let base44;

  try {
    base44 = createClientFromRequest(req);
    
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return Response.redirect(`${origin}/Dashboard?error=${error}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${origin}/Dashboard?error=missing_parameters`, 302);
    }

    // Decode state
    const stateString = atob(state.replace(/-/g, '+').replace(/_/g, '/'));
    const stateData = JSON.parse(stateString);

    // Validate state age (10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return Response.redirect(`${origin}/Dashboard?error=state_expired`, 302);
    }

    // Exchange code for token
    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET');
    const SQUARE_ENVIRONMENT = (Deno.env.get('SQUARE_ENVIRONMENT') || 'production').toLowerCase();

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
      console.error('Token exchange failed:', errorData);
      return Response.redirect(`${origin}/Dashboard?error=token_failed`, 302);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const merchantId = tokenData.merchant_id;

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

    let merchantName = 'Square Merchant';
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      merchantName = profileData.merchant?.business_name || merchantName;
    }

    // Store connection
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
        connection_status: 'connected',
        merchant_business_name: merchantName
      });
    } else {
      connection = await base44.asServiceRole.entities.SquareConnection.create({
        organization_id: stateData.org_id,
        square_merchant_id: merchantId,
        square_access_token_encrypted: accessToken,
        square_refresh_token_encrypted: refreshToken || '',
        merchant_business_name: merchantName,
        connection_status: 'connected'
      });
    }

    // Update organization
    await base44.asServiceRole.entities.Organization.update(stateData.org_id, {
      square_merchant_id: merchantId
    });

    // Activate user
    await base44.asServiceRole.entities.User.update(stateData.user_id, {
      account_status: 'active'
    });

    // Trigger background sync
    base44.asServiceRole.functions.invoke('squareSync', {
      connection_id: connection.id,
      triggered_by: 'initial_setup'
    }).catch(err => console.error('Background sync failed:', err));

    return Response.redirect(`${origin}/Dashboard?square_connected=1&merchant=${encodeURIComponent(merchantName)}`, 302);

  } catch (error) {
    console.error('Callback error:', error);
    if (base44) {
      await base44.asServiceRole.entities.AppError.create({
        page: 'squareCallback',
        action_name: 'oauth_callback',
        error_message: error.message,
        severity: 'error'
      }).catch(() => {});
    }
    return Response.redirect(`${origin}/Dashboard?error=callback_failed`, 302);
  }
});