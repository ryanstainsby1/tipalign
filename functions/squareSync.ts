import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connection_id, triggered_by = 'manual' } = await req.json();

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

    // Check for concurrent sync jobs
    const runningSyncJobs = await base44.asServiceRole.entities.SyncJob.filter({
      organization_id: connection.organization_id,
      square_connection_id: connection.id,
      status: 'running'
    });

    if (runningSyncJobs.length > 0) {
      return Response.json({ 
        error: 'A sync is already in progress. Please wait for it to complete.',
        sync_job_id: runningSyncJobs[0].id
      }, { status: 409 });
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
    const syncJob = await base44.asServiceRole.entities.SyncJob.create({
      organization_id: connection.organization_id,
      square_connection_id: connection.id,
      sync_type: triggered_by === 'initial_setup' ? 'full' : 'incremental',
      entities_synced: ['locations', 'team_members', 'shifts', 'payments'],
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: triggered_by
    });

    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    const errors = [];
    const entityCounts = {
      locations: { created: 0, updated: 0 },
      team_members: { created: 0, updated: 0 },
      shifts: { created: 0, updated: 0 },
      payments: { created: 0, updated: 0 }
    };

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
              entityCounts.locations.updated++;
            } else {
              await base44.asServiceRole.entities.Location.create(locationData);
              recordsCreated++;
              entityCounts.locations.created++;
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
              entityCounts.team_members.updated++;
            } else {
              await base44.asServiceRole.entities.Employee.create(employeeData);
              recordsCreated++;
              entityCounts.team_members.created++;
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

      // Sync Shifts (last 7 days)
      const allLocations = await base44.asServiceRole.entities.Location.filter({
        organization_id: connection.organization_id,
        active: true
      });

      for (const location of allLocations) {
        try {
          const startAt = new Date();
          startAt.setDate(startAt.getDate() - 7);
          
          const shiftsResponse = await fetch(`${baseUrl}/v2/labor/shifts/search`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              query: {
                filter: {
                  location_ids: [location.square_location_id],
                  start: { start_at: startAt.toISOString() }
                }
              }
            })
          });

          if (shiftsResponse.ok) {
            const shiftsData = await shiftsResponse.json();
            
            for (const shift of shiftsData.shifts || []) {
              try {
                const existingShifts = await base44.asServiceRole.entities.Shift.filter({
                  organization_id: connection.organization_id,
                  square_shift_id: shift.id
                });

                const employee = await base44.asServiceRole.entities.Employee.filter({
                  organization_id: connection.organization_id,
                  square_team_member_id: shift.team_member_id
                });

                const shiftData = {
                  organization_id: connection.organization_id,
                  square_shift_id: shift.id,
                  square_team_member_id: shift.team_member_id,
                  employee_id: employee[0]?.id,
                  location_id: location.id,
                  square_location_id: location.square_location_id,
                  start_at: shift.start_at,
                  end_at: shift.end_at,
                  break_duration_seconds: shift.breaks?.reduce((sum, b) => sum + (b.duration_seconds || 0), 0) || 0,
                  hours_worked: shift.end_at 
                    ? (new Date(shift.end_at) - new Date(shift.start_at)) / (1000 * 60 * 60)
                    : 0,
                  status: shift.end_at ? 'closed' : 'open'
                };

                if (existingShifts.length > 0) {
                  await base44.asServiceRole.entities.Shift.update(existingShifts[0].id, shiftData);
                  recordsUpdated++;
                  entityCounts.shifts.updated++;
                } else {
                  await base44.asServiceRole.entities.Shift.create(shiftData);
                  recordsCreated++;
                  entityCounts.shifts.created++;
                }
              } catch (error) {
                errors.push({
                  entity_type: 'shift',
                  square_id: shift.id,
                  error_message: error.message
                });
              }
            }
          }
        } catch (error) {
          errors.push({
            entity_type: 'shifts',
            location_id: location.id,
            error_message: error.message
          });
        }
      }

      // Sync Payments (last 7 days with tips)
      for (const location of allLocations) {
        try {
          const beginTime = new Date();
          beginTime.setDate(beginTime.getDate() - 7);

          const paymentsResponse = await fetch(
            `${baseUrl}/v2/payments?location_id=${location.square_location_id}&begin_time=${beginTime.toISOString()}&sort_order=ASC`,
            { headers }
          );

          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            
            for (const payment of paymentsData.payments || []) {
              try {
                // Skip if no tip
                if (!payment.tip_money?.amount || payment.tip_money.amount === 0) {
                  recordsSkipped++;
                  continue;
                }

                const existingPayments = await base44.asServiceRole.entities.Payment.filter({
                  organization_id: connection.organization_id,
                  square_payment_id: payment.id
                });

                const employee = payment.team_member_id ? await base44.asServiceRole.entities.Employee.filter({
                  organization_id: connection.organization_id,
                  square_team_member_id: payment.team_member_id
                }) : [];

                const paymentData = {
                  organization_id: connection.organization_id,
                  square_payment_id: payment.id,
                  square_order_id: payment.order_id,
                  square_location_id: location.square_location_id,
                  location_id: location.id,
                  square_device_id: payment.device_details?.device_id,
                  square_team_member_id: payment.team_member_id,
                  employee_id: employee[0]?.id,
                  payment_date: payment.created_at,
                  total_amount: payment.total_money?.amount || 0,
                  tip_amount: payment.tip_money?.amount || 0,
                  currency: payment.total_money?.currency || 'GBP',
                  payment_source_type: payment.source_type,
                  card_brand: payment.card_details?.card?.card_brand,
                  last_4: payment.card_details?.card?.last_4,
                  processing_fee: payment.processing_fee?.[0]?.amount_money?.amount || 0,
                  status: payment.status === 'COMPLETED' ? 'completed' : payment.status === 'CANCELED' ? 'cancelled' : 'completed'
                };

                if (existingPayments.length > 0) {
                  await base44.asServiceRole.entities.Payment.update(existingPayments[0].id, paymentData);
                  recordsUpdated++;
                  entityCounts.payments.updated++;
                } else {
                  await base44.asServiceRole.entities.Payment.create(paymentData);
                  recordsCreated++;
                  entityCounts.payments.created++;
                }
              } catch (error) {
                errors.push({
                  entity_type: 'payment',
                  square_id: payment.id,
                  error_message: error.message
                });
              }
            }
          }
        } catch (error) {
          errors.push({
            entity_type: 'payments',
            location_id: location.id,
            error_message: error.message
          });
        }
      }

      // Update sync job
      await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
        completed_at: new Date().toISOString(),
        status: errors.length > 0 ? 'partial' : 'completed',
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        records_skipped: recordsSkipped,
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
        records_skipped: recordsSkipped,
        errors_count: errors.length,
        entity_counts: entityCounts,
        warnings: errors.length > 0 ? errors.slice(0, 5).map(e => e.error_message) : []
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