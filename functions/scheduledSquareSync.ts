import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all active Square connections
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      connection_status: 'connected'
    });

    if (connections.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No active connections to sync' 
      });
    }

    const results = [];

    for (const connection of connections) {
      // Get organization settings
      const orgs = await base44.asServiceRole.entities.Organization.filter({
        id: connection.organization_id
      });
      
      const org = orgs[0];
      if (!org) continue;

      // Check if sync is enabled and if it's time to sync
      const settings = org.settings || {};
      const syncEnabled = settings.auto_sync_enabled !== false;
      const syncFrequency = settings.sync_frequency || 'daily';

      if (!syncEnabled) {
        results.push({
          organization_id: connection.organization_id,
          skipped: true,
          reason: 'Auto-sync disabled'
        });
        continue;
      }

      // Check last sync time to avoid over-syncing
      const lastSync = connection.last_sync_at ? new Date(connection.last_sync_at) : null;
      const now = new Date();
      
      let shouldSync = false;
      if (!lastSync) {
        shouldSync = true;
      } else {
        const hoursSinceLastSync = (now - lastSync) / (1000 * 60 * 60);
        
        switch (syncFrequency) {
          case 'every_30_min':
            shouldSync = hoursSinceLastSync >= 0.5;
            break;
          case 'hourly':
            shouldSync = hoursSinceLastSync >= 1;
            break;
          case 'every_6_hours':
            shouldSync = hoursSinceLastSync >= 6;
            break;
          case 'daily':
            shouldSync = hoursSinceLastSync >= 24;
            break;
          default:
            shouldSync = hoursSinceLastSync >= 24;
        }
      }

      if (!shouldSync) {
        results.push({
          organization_id: connection.organization_id,
          skipped: true,
          reason: 'Not due for sync yet',
          last_sync_at: connection.last_sync_at
        });
        continue;
      }

      try {
        // Trigger sync
        const syncResponse = await base44.asServiceRole.functions.invoke('squareSync', {
          connection_id: connection.id,
          triggered_by: 'scheduled'
        });

        results.push({
          organization_id: connection.organization_id,
          success: true,
          data: syncResponse.data
        });

        // Log audit event
        await base44.asServiceRole.entities.SystemAuditEvent.create({
          organization_id: connection.organization_id,
          event_type: 'square_sync_completed',
          actor_type: 'scheduled_job',
          entity_type: 'square_connection',
          entity_id: connection.id,
          changes_summary: `Scheduled sync completed (${syncFrequency})`,
          severity: 'info'
        });

      } catch (syncError) {
        results.push({
          organization_id: connection.organization_id,
          success: false,
          error: syncError.message
        });

        // Log error
        await base44.asServiceRole.entities.AppError.create({
          organization_id: connection.organization_id,
          page: 'Scheduled Sync',
          action_name: 'scheduled_square_sync',
          error_message: syncError.message,
          error_stack: syncError.stack,
          severity: 'error'
        });
      }
    }

    return Response.json({
      success: true,
      synced: results.filter(r => r.success).length,
      skipped: results.filter(r => r.skipped).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      results
    });

  } catch (error) {
    console.error('Scheduled sync error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});