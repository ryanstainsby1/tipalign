import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's organization
    const memberships = await base44.asServiceRole.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      status: 'active'
    });

    if (memberships.length === 0) {
      return Response.json({ error: 'No organization found' }, { status: 400 });
    }

    const orgId = memberships[0].organization_id;

    // Get Square connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      organization_id: orgId,
      connection_status: 'connected'
    });

    if (connections.length === 0) {
      return Response.json({ error: 'No Square connection found' }, { status: 404 });
    }

    const connection = connections[0];
    const accessToken = connection.square_access_token_encrypted;

    // Check token status and scopes
    const response = await fetch("https://connect.squareup.com/oauth2/token/status", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-12-18"
      }
    });

    if (!response.ok) {
      return Response.json({ 
        error: 'Failed to check token status',
        status: response.status 
      }, { status: 500 });
    }

    const data = await response.json();

    return Response.json({
      success: true,
      scopes: data.scopes || [],
      merchant_id: data.merchant_id,
      expires_at: data.expires_at,
      has_payments_read: (data.scopes || []).includes('PAYMENTS_READ')
    });

  } catch (error) {
    console.error('Token scope check error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});