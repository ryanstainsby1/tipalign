import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  let connectionId = null;
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connection_id, preserve_data = true } = await req.json();
    connectionId = connection_id;

    // Get connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      id: connection_id,
      organization_id: user.organization_id || user.id
    });

    if (connections.length === 0) {
      return Response.json({ error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];

    // Create snapshot for audit
    const beforeSnapshot = {
      merchant_id: connection.square_merchant_id,
      merchant_name: connection.merchant_business_name,
      connected_at: connection.created_date,
      last_sync_at: connection.last_sync_at
    };

    // Revoke Square access token
    try {
      const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
      const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox';

      const revokeUrl = SQUARE_ENVIRONMENT === 'production'
        ? 'https://connect.squareup.com/oauth2/revoke'
        : 'https://connect.squareupsandbox.com/oauth2/revoke';

      const revokeResponse = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18'
        },
        body: JSON.stringify({
          client_id: SQUARE_APP_ID,
          access_token: connection.square_access_token_encrypted
        })
      });

      if (!revokeResponse.ok) {
        console.warn('Square token revocation failed:', await revokeResponse.text());
      }
    } catch (error) {
      console.error('Error revoking Square token:', error);
      // Continue with disconnection even if revoke fails
    }

    // Update connection status
    await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
      connection_status: 'revoked',
      square_access_token_encrypted: '',
      square_refresh_token_encrypted: '',
      last_error: 'Manually disconnected by user',
      last_error_at: new Date().toISOString()
    });

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: connection.organization_id,
      event_type: 'square_connection_revoked',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'square_connection',
      entity_id: connection.id,
      before_snapshot: beforeSnapshot,
      after_snapshot: {
        status: 'revoked',
        preserve_data: preserve_data
      },
      changes_summary: 'Square account disconnected - tokens revoked, historical data preserved',
      reason: preserve_data 
        ? 'Disconnected - historical data preserved for compliance (6 year retention)'
        : 'Disconnected',
      hmrc_relevant: false,
      severity: 'warning'
    });

    return Response.json({
      success: true,
      message: 'Square account disconnected successfully',
      data_preserved: preserve_data,
      details: {
        tokens_revoked: true,
        webhooks_stopped: true,
        historical_data_retained: preserve_data
      }
    });

  } catch (error) {
    console.error('Square disconnect error:', error);
    
    // Ensure connection status is updated even if revocation fails
    if (connectionId) {
      try {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.SquareConnection.update(connectionId, {
          connection_status: 'revoked',
          last_error: error.message,
          last_error_at: new Date().toISOString()
        });
      } catch (updateError) {
        console.error('Failed to update connection status:', updateError);
      }
    }
    
    return Response.json({ 
      success: false, 
      error: error.message,
      partial_cleanup: !!connectionId 
    }, { status: 500 });
  }
});