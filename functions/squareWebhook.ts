import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { createHmac } from 'node:crypto';

function verifySquareSignature(body, signature, signatureKey) {
  if (!signatureKey || !signature) return false;
  
  const hmac = createHmac('sha256', signatureKey);
  hmac.update(body);
  const computedSignature = hmac.digest('base64');
  
  return computedSignature === signature;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  let webhookLogId = null;
  
  try {
    const signature = req.headers.get('x-square-signature');
    const body = await req.text();
    const payload = JSON.parse(body);
    const eventId = payload.event_id;

    // Early idempotency check - prevent duplicate processing
    const base44 = createClientFromRequest(req);
    const existingLogs = await base44.asServiceRole.entities.WebhookLog.filter({
      webhook_event_id: eventId
    });

    if (existingLogs.length > 0 && existingLogs[0].processed) {
      console.log('Duplicate webhook (already processed):', eventId);
      return Response.json({ 
        received: true, 
        duplicate: true,
        event_id: eventId 
      }, { status: 200 });
    }

    // Get connection by merchant_id
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      square_merchant_id: payload.merchant_id
    });

    if (connections.length === 0) {
      console.error('No connection found for merchant:', payload.merchant_id);
      return Response.json({ error: 'No connection found' }, { status: 404 });
    }

    const connection = connections[0];

    // Check if connection is active - don't process webhooks for disconnected accounts
    if (connection.connection_status === 'revoked' || connection.connection_status === 'expired') {
      console.log('Webhook ignored - connection is', connection.connection_status);
      await base44.asServiceRole.entities.WebhookLog.create({
        organization_id: connection.organization_id,
        square_connection_id: connection.id,
        webhook_event_id: eventId,
        event_type: payload.type,
        merchant_id: payload.merchant_id,
        payload: payload,
        received_at: new Date().toISOString(),
        signature_valid: false,
        processed: false,
        processing_error: `Connection ${connection.connection_status} - not processing webhooks`
      });
      return Response.json({ 
        received: true, 
        processed: false,
        reason: `Connection ${connection.connection_status}` 
      }, { status: 200 });
    }

    // Verify signature
    const isValid = verifySquareSignature(body, signature, connection.webhook_signature_key);
    
    if (!isValid) {
      console.error('Invalid webhook signature for event:', eventId);
      await base44.asServiceRole.entities.WebhookLog.create({
        organization_id: connection.organization_id,
        square_connection_id: connection.id,
        webhook_event_id: eventId,
        event_type: payload.type,
        merchant_id: payload.merchant_id,
        payload: payload,
        received_at: new Date().toISOString(),
        signature_valid: false,
        processed: false,
        processing_error: 'Invalid signature'
      });
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Log webhook
    const webhookLog = existingLogs.length > 0 ? existingLogs[0] : await base44.asServiceRole.entities.WebhookLog.create({
      organization_id: connection.organization_id,
      square_connection_id: connection.id,
      webhook_event_id: eventId,
      event_type: payload.type,
      merchant_id: payload.merchant_id,
      location_id: payload.data?.object?.payment?.location_id || payload.data?.object?.team_member?.location_id,
      entity_id: payload.data?.id,
      payload: payload,
      received_at: new Date().toISOString(),
      signature_valid: isValid,
      processed: false
    });

    webhookLogId = webhookLog.id;

    // Process webhook based on type with retry logic
    let syncJobId = null;
    const entitiesToSync = [];
    
    if (payload.type.includes('payment.')) {
      entitiesToSync.push('payments');
    } else if (payload.type.includes('team_member.')) {
      entitiesToSync.push('team_members');
    } else if (payload.type.includes('shift.')) {
      entitiesToSync.push('shifts');
    } else if (payload.type.includes('location.')) {
      entitiesToSync.push('locations');
    }

    if (entitiesToSync.length > 0) {
      // Retry logic
      let retryCount = 0;
      const maxRetries = 3;
      let syncError = null;
      
      while (retryCount < maxRetries) {
        try {
          const syncResponse = await base44.asServiceRole.functions.invoke('squareSyncEngine', {
            connection_id: connection.id,
            entity_types: entitiesToSync,
            triggered_by: 'webhook',
            webhook_event_id: eventId
          });
          syncJobId = syncResponse.data?.sync_job_id;
          break;
        } catch (err) {
          syncError = err;
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
      if (syncError && retryCount === maxRetries) {
        throw new Error(`Sync failed after ${maxRetries} retries: ${syncError.message}`);
      }
    }

    const processingTime = Date.now() - startTime;

    // Mark webhook as processed
    await base44.asServiceRole.entities.WebhookLog.update(webhookLog.id, {
      processed: true,
      processed_at: new Date().toISOString(),
      sync_job_id: syncJobId
    });

    console.log(`Webhook processed successfully in ${processingTime}ms:`, eventId);

    return Response.json({ 
      received: true, 
      processed: true,
      event_id: eventId,
      processing_time_ms: processingTime,
      sync_job_id: syncJobId
    }, { status: 200 });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    const processingTime = Date.now() - startTime;
    
    // Update webhook log with error
    if (webhookLogId) {
      try {
        await base44.asServiceRole.entities.WebhookLog.update(webhookLogId, {
          processed: false,
          processing_error: error.message
        });
      } catch (updateError) {
        console.error('Failed to update webhook log:', updateError);
      }
    }
    
    return Response.json({ 
      received: false, 
      error: 'Internal processing error',
      processing_time_ms: processingTime
    }, { status: 500 });
  }
});