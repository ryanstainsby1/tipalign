import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  console.log('=== SQUARE CALLBACK INVOKED ===', req.url);
  
  const url = new URL(req.url);
  const origin = url.origin;

  try {
    const base44 = createClientFromRequest(req);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Check if neither code nor error is present
    if (!code && !error) {
      console.error('Square OAuth callback without code or error', req.url);
      return Response.redirect(`${origin}/Welcome?error=no_code_received`, 302);
    }

    if (error) return Response.redirect(`${origin}/Welcome?error=${error}`, 302);
    if (!code || !state) return Response.redirect(`${origin}/Welcome?error=missing_params`, 302);

    const stateData = JSON.parse(atob(state.replace(/-/g, '+').replace(/_/g, '/')));
    if (Date.now() - stateData.timestamp > 600000) {
      console.error('State token expired');
      return Response.redirect(`${origin}/Welcome?error=state_expired`, 302);
    }

    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET');
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'production';

    const tokenUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-12-18' },
      body: JSON.stringify({
        client_id: SQUARE_APP_ID,
        client_secret: SQUARE_APP_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${Deno.env.get('BASE_URL')}/functions/squareCallback`
      })
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      console.error('Square token exchange failed:', tokenRes.status, errorData);
      return Response.redirect(`${origin}/Welcome?error=token_exchange_failed&status=${tokenRes.status}`, 302);
    }

    const tokenData = await tokenRes.json();
    const merchantId = tokenData.merchant_id;

    const profileUrl = SQUARE_ENVIRONMENT === 'production'
      ? `https://connect.squareup.com/v2/merchants/${merchantId}`
      : `https://connect.squareupsandbox.com/v2/merchants/${merchantId}`;

    const profileRes = await fetch(profileUrl, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Square-Version': '2024-12-18' }
    });

    let merchantName = 'Square';
    if (profileRes.ok) {
      const profile = await profileRes.json();
      merchantName = profile.merchant?.business_name || merchantName;
    }

    const existing = await base44.asServiceRole.entities.SquareConnection.filter({
      organization_id: stateData.org_id,
      square_merchant_id: merchantId
    });

    let conn;
    if (existing.length > 0) {
      conn = existing[0];
      await base44.asServiceRole.entities.SquareConnection.update(conn.id, {
        square_access_token_encrypted: tokenData.access_token,
        square_refresh_token_encrypted: tokenData.refresh_token || '',
        connection_status: 'connected',
        merchant_business_name: merchantName
      });
    } else {
      conn = await base44.asServiceRole.entities.SquareConnection.create({
        organization_id: stateData.org_id,
        square_merchant_id: merchantId,
        square_access_token_encrypted: tokenData.access_token,
        square_refresh_token_encrypted: tokenData.refresh_token || '',
        merchant_business_name: merchantName,
        connection_status: 'connected'
      });
    }

    await base44.asServiceRole.entities.Organization.update(stateData.org_id, {
      square_merchant_id: merchantId
    });

    await base44.asServiceRole.entities.User.update(stateData.user_id, {
      account_status: 'active'
    });

    base44.asServiceRole.functions.invoke('squareSync', {
      connection_id: conn.id,
      triggered_by: 'initial_setup'
    }).catch(() => {});

    return Response.redirect(`${origin}/Dashboard?square_connected=1&merchant=${encodeURIComponent(merchantName)}`, 302);

  } catch (error) {
    console.error('Callback error:', error);
    return Response.redirect(`${origin}/Welcome?error=callback_failed&message=${encodeURIComponent(error.message)}`, 302);
  }
});