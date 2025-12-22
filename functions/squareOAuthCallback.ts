import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return Response.json({ 
        success: false, 
        error: `Square OAuth error: ${error}` 
      }, { status: 400 });
    }

    if (!code) {
      return Response.json({ 
        success: false, 
        error: 'Missing authorization code' 
      }, { status: 400 });
    }

    // Exchange authorization code for access token
    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET');
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox';

    if (!SQUARE_APP_ID || !SQUARE_APP_SECRET) {
      return Response.json({ 
        success: false, 
        error: 'Square credentials not configured' 
      }, { status: 500 });
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
      return Response.json({ 
        success: false, 
        error: `Token exchange failed: ${errorData.message || 'Unknown error'}` 
      }, { status: 400 });
    }

    const tokenData = await tokenResponse.json();
    
    // Get merchant info
    const baseUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const merchantResponse = await fetch(`${baseUrl}/v2/merchants/${tokenData.merchant_id}`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Square-Version': '2024-12-18'
      }
    });

    const merchantData = await merchantResponse.json();
    const merchant = merchantData.merchant;

    // Calculate token expiry (Square tokens expire after 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Check if connection already exists for this org
    const existingConnections = await base44.asServiceRole.entities.SquareConnection.filter({
      organization_id: user.organization_id || user.id
    });

    const connectionData = {
      organization_id: user.organization_id || user.id,
      square_merchant_id: tokenData.merchant_id,
      square_access_token_encrypted: tokenData.access_token, // In production, encrypt this
      square_refresh_token_encrypted: tokenData.refresh_token || '',
      token_expires_at: expiresAt.toISOString(),
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      merchant_business_name: merchant?.business_name || 'Unknown',
      merchant_country: merchant?.country || 'GB',
      connection_status: 'connected',
      last_sync_at: new Date().toISOString()
    };

    let connection;
    if (existingConnections.length > 0) {
      connection = await base44.asServiceRole.entities.SquareConnection.update(
        existingConnections[0].id,
        connectionData
      );
    } else {
      connection = await base44.asServiceRole.entities.SquareConnection.create(connectionData);
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: user.organization_id || user.id,
      event_type: 'square_connection_established',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'square_connection',
      entity_id: connection.id,
      after_snapshot: {
        merchant_id: tokenData.merchant_id,
        merchant_name: merchant?.business_name
      },
      changes_summary: 'Square account connected successfully',
      hmrc_relevant: false,
      severity: 'info'
    });

    // Trigger initial sync
    await base44.asServiceRole.functions.invoke('squareSync', {
      connection_id: connection.id
    });

    return Response.json({
      success: true,
      connection: {
        id: connection.id,
        merchant_name: connection.merchant_business_name,
        merchant_id: connection.square_merchant_id
      }
    });

  } catch (error) {
    console.error('Square OAuth callback error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});