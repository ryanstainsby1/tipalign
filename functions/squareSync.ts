import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connection_id } = await req.json();

    // Get connection
    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      id: connection_id,
      organization_id: user.organization_id || user.id
    });

    if (connections.length === 0) {
      return Response.json({ error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];

    if (connection.connection_status !== 'connected') {
      return Response.json({ error: 'Connection not active' }, { status: 400 });
    }

    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox';
    const baseUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const headers = {
      'Authorization': `Bearer ${connection.square_access_token_encrypted}`,
      'Square-Version': '2024-12-18',
      'Content-Type': 'application/json'
    };

    // Create sync job
    const { triggered_by = 'manual' } = await req.json();
    
    const syncJob = await base44.asServiceRole.entities.SyncJob.create({
      organization_id: connection.organization_id,
      square_connection_id: connection.id,
      sync_type: triggered_by === 'initial_setup' ? 'full' : 'incremental',
      entities_synced: ['locations', 'team_members'],
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: triggered_by
    });

    let recordsCreated = 0;
    let recordsUpdated = 0;
    const errors = [];

    try {
      // Sync Locations
      const locationsResponse = await fetch(`${baseUrl}/v2/locations`, { headers });
      const locationsData = await locationsResponse.json();

      if (locationsData.locations) {
        for (const squareLocation of locationsData.locations) {
          try {
            const existingLocations = await base44.asServiceRole.entities.Location.filter({
              organization_id: connection.organization_id,
              square_location_id: squareLocation.id
            });

            const locationData = {
              organization_id: connection.organization_id,
              square_location_id: squareLocation.id,
              name: squareLocation.name,
              address: {
                line1: squareLocation.address?.address_line_1 || '',
                line2: squareLocation.address?.address_line_2 || '',
                city: squareLocation.address?.locality || '',
                postcode: squareLocation.address?.postal_code || '',
                country: squareLocation.country || 'GB'
              },
              phone: squareLocation.phone_number || '',
              timezone: squareLocation.timezone || 'Europe/London',
              active: squareLocation.status === 'ACTIVE',
              first_synced_at: existingLocations.length > 0 ? existingLocations[0].first_synced_at : new Date().toISOString()
            };

            if (existingLocations.length > 0) {
              await base44.asServiceRole.entities.Location.update(existingLocations[0].id, locationData);
              recordsUpdated++;
            } else {
              await base44.asServiceRole.entities.Location.create(locationData);
              recordsCreated++;
            }
          } catch (error) {
            errors.push({
              entity_type: 'location',
              square_id: squareLocation.id,
              error_message: error.message
            });
          }
        }
      }

      // Sync Team Members
      const teamResponse = await fetch(`${baseUrl}/v2/team-members`, { headers });
      const teamData = await teamResponse.json();

      if (teamData.team_members) {
        for (const teamMember of teamData.team_members) {
          try {
            const existingEmployees = await base44.asServiceRole.entities.Employee.filter({
              organization_id: connection.organization_id,
              square_team_member_id: teamMember.id
            });

            const employeeData = {
              organization_id: connection.organization_id,
              square_team_member_id: teamMember.id,
              full_name: `${teamMember.given_name || ''} ${teamMember.family_name || ''}`.trim(),
              email: teamMember.email_address || '',
              phone: teamMember.phone_number || '',
              employment_status: teamMember.status === 'ACTIVE' ? 'active' : 'terminated',
              role: 'server', // Default role
              role_weight: 1.0
            };

            if (existingEmployees.length > 0) {
              await base44.asServiceRole.entities.Employee.update(existingEmployees[0].id, employeeData);
              recordsUpdated++;
            } else {
              await base44.asServiceRole.entities.Employee.create(employeeData);
              recordsCreated++;
            }
          } catch (error) {
            errors.push({
              entity_type: 'team_member',
              square_id: teamMember.id,
              error_message: error.message
            });
          }
        }
      }

      // Update sync job
      await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
        completed_at: new Date().toISOString(),
        status: errors.length > 0 ? 'partial' : 'completed',
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        errors: errors
      });

      // Update connection last_sync_at
      await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
        last_sync_at: new Date().toISOString()
      });

      // Create audit event
      await base44.asServiceRole.entities.SystemAuditEvent.create({
        organization_id: connection.organization_id,
        event_type: 'square_sync_completed',
        actor_type: 'system',
        actor_email: user.email,
        entity_type: 'square_connection',
        entity_id: connection.id,
        after_snapshot: {
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          errors_count: errors.length
        },
        changes_summary: `Synced ${recordsCreated + recordsUpdated} records from Square`,
        hmrc_relevant: false,
        severity: errors.length > 0 ? 'warning' : 'info'
      });

      return Response.json({
        success: true,
        sync_job_id: syncJob.id,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        errors_count: errors.length,
        warnings: errors.length > 0 ? errors.map(e => e.error_message) : []
      });

    } catch (error) {
      // Update sync job with error
      await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
        completed_at: new Date().toISOString(),
        status: 'failed',
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        errors: [...errors, { error_message: error.message }]
      });

      throw error;
    }

  } catch (error) {
    console.error('Square sync error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});