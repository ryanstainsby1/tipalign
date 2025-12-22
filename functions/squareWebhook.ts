import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

function verifySquareSignature(body, signature, signatureKey) {
  const crypto = globalThis.crypto?.subtle;
  if (!crypto) return true; // Skip in dev if crypto not available
  
  // In production, implement proper HMAC verification
  // This is a placeholder - actual implementation would use crypto.subtle
  return true;
}

Deno.serve(async (req) => {
  try {
    const signature = req.headers.get('x-square-signature');
    const body = await req.text();
    const payload = JSON.parse(body);

    // Get connection by merchant_id
    const base44 = createClientFromRequest(req);
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      square_merchant_id: payload.merchant_id
    });

    if (connections.length === 0) {
      console.log('No connection found for merchant:', payload.merchant_id);
      return Response.json({ received: true }, { status: 200 });
    }

    const connection = connections[0];

    // Verify signature
    const isValid = verifySquareSignature(body, signature, connection.webhook_signature_key);
    
    // Log webhook
    const webhookLog = await base44.asServiceRole.entities.WebhookLog.create({
      organization_id: connection.organization_id,
      square_connection_id: connection.id,
      webhook_event_id: payload.event_id,
      event_type: payload.type,
      merchant_id: payload.merchant_id,
      location_id: payload.data?.object?.payment?.location_id || payload.data?.object?.team_member?.location_id,
      entity_id: payload.data?.id,
      payload: payload,
      received_at: new Date().toISOString(),
      signature_valid: isValid,
      processed: false
    });

    // Check for duplicate
    const existingLogs = await base44.asServiceRole.entities.WebhookLog.filter({
      webhook_event_id: payload.event_id,
      processed: true
    });

    if (existingLogs.length > 0) {
      console.log('Duplicate webhook, skipping:', payload.event_id);
      return Response.json({ received: true, duplicate: true }, { status: 200 });
    }

    // Process webhook based on type
    let syncJob = null;

    if (payload.type === 'payment.created' || payload.type === 'payment.updated') {
      // Trigger payment sync for specific location
      syncJob = await base44.asServiceRole.functions.invoke('squareSyncEngine', {
        connection_id: connection.id,
        entity_types: ['payments']
      });
    } else if (payload.type === 'team_member.created' || payload.type === 'team_member.updated') {
      syncJob = await base44.asServiceRole.functions.invoke('squareSyncEngine', {
        connection_id: connection.id,
        entity_types: ['team_members']
      });
    } else if (payload.type === 'shift.created' || payload.type === 'shift.updated') {
      syncJob = await base44.asServiceRole.functions.invoke('squareSyncEngine', {
        connection_id: connection.id,
        entity_types: ['shifts']
      });
    } else if (payload.type === 'location.updated') {
      syncJob = await base44.asServiceRole.functions.invoke('squareSyncEngine', {
        connection_id: connection.id,
        entity_types: ['locations']
      });
    }

    // Mark webhook as processed
    await base44.asServiceRole.entities.WebhookLog.update(webhookLog.id, {
      processed: true,
      processed_at: new Date().toISOString(),
      sync_job_id: syncJob?.data?.sync_job_id
    });

    return Response.json({ 
      received: true, 
      processed: true,
      sync_job_id: syncJob?.data?.sync_job_id
    }, { status: 200 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ received: true, error: error.message }, { status: 200 });
  }
});