import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Square API helper
async function squareApiCall(endpoint, accessToken, method = 'GET', body = null) {
  const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox';
  const baseUrl = SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Square-Version': '2024-12-18',
      'Content-Type': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, options);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Square API error: ${errorData.errors?.[0]?.detail || 'Unknown error'}`);
  }
  return await response.json();
}

// Get or create watermark
async function getWatermark(base44, orgId, connectionId, entityType, locationId = null) {
  const watermarks = await base44.asServiceRole.entities.SyncWatermark.filter({
    organization_id: orgId,
    square_connection_id: connectionId,
    entity_type: entityType,
    location_id: locationId
  });

  if (watermarks.length > 0) {
    return watermarks[0];
  }

  return await base44.asServiceRole.entities.SyncWatermark.create({
    organization_id: orgId,
    square_connection_id: connectionId,
    entity_type: entityType,
    location_id: locationId,
    records_synced: 0
  });
}

// Update watermark
async function updateWatermark(base44, watermarkId, cursor, recordsSynced, error = null) {
  const updateData = {
    last_sync_at: new Date().toISOString(),
    records_synced: recordsSynced
  };

  if (error) {
    updateData.last_error = error;
  } else {
    updateData.last_cursor = cursor || '';
    updateData.last_successful_sync_at = new Date().toISOString();
    updateData.last_error = null;
  }

  await base44.asServiceRole.entities.SyncWatermark.update(watermarkId, updateData);
}

// Sync Locations
async function syncLocations(base44, connection, orgId) {
  const watermark = await getWatermark(base44, orgId, connection.id, 'locations');
  const data = await squareApiCall('/v2/locations', connection.square_access_token_encrypted);
  
  let created = 0, updated = 0;
  const errors = [];

  for (const sqLoc of data.locations || []) {
    try {
      const existing = await base44.asServiceRole.entities.Location.filter({
        organization_id: orgId,
        square_location_id: sqLoc.id
      });

      const locationData = {
        organization_id: orgId,
        square_location_id: sqLoc.id,
        name: sqLoc.name,
        address: {
          line1: sqLoc.address?.address_line_1 || '',
          line2: sqLoc.address?.address_line_2 || '',
          city: sqLoc.address?.locality || '',
          postcode: sqLoc.address?.postal_code || '',
          country: sqLoc.country || 'GB'
        },
        phone: sqLoc.phone_number || '',
        timezone: sqLoc.timezone || 'Europe/London',
        active: sqLoc.status === 'ACTIVE',
        first_synced_at: existing.length > 0 ? existing[0].first_synced_at : new Date().toISOString()
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Location.update(existing[0].id, locationData);
        updated++;
      } else {
        await base44.asServiceRole.entities.Location.create(locationData);
        created++;
      }
    } catch (error) {
      errors.push({ entity_type: 'location', square_id: sqLoc.id, error_message: error.message });
    }
  }

  await updateWatermark(base44, watermark.id, null, created + updated);
  return { created, updated, errors };
}

// Sync Team Members
async function syncTeamMembers(base44, connection, orgId) {
  const watermark = await getWatermark(base44, orgId, connection.id, 'team_members');
  const data = await squareApiCall('/v2/team-members?status=ACTIVE,INACTIVE', connection.square_access_token_encrypted);
  
  let created = 0, updated = 0, removed = 0;
  const errors = [];

  // Get list of Square team member IDs and emails from API
  const squareTeamMemberIds = (data.team_members || []).map(tm => tm.id);
  const squareTeamMemberEmails = (data.team_members || [])
    .map(tm => tm.email_address?.toLowerCase())
    .filter(Boolean);

  // Get all existing employees for this organization (excluding already removed)
  const existingEmployees = await base44.asServiceRole.entities.Employee.filter({
    organization_id: orgId
  });

  // Mark employees as removed if they're no longer in Square
  for (const employee of existingEmployees) {
    // Skip if already marked as removed
    if (employee.removed_from_square_at) continue;

    const shouldRemove = 
      // Has a Square ID that's not in Square anymore
      (employee.square_team_member_id && !squareTeamMemberIds.includes(employee.square_team_member_id)) ||
      // Or doesn't have a Square ID at all (manual addition) and email doesn't match anyone in Square
      (!employee.square_team_member_id && employee.email && !squareTeamMemberEmails.includes(employee.email.toLowerCase()));

    if (shouldRemove) {
      try {
        await base44.asServiceRole.entities.Employee.update(employee.id, {
          removed_from_square_at: new Date().toISOString(),
          employment_status: 'terminated'
        });
        removed++;
      } catch (error) {
        errors.push({ entity_type: 'team_member', square_id: employee.square_team_member_id || employee.email, error_message: `Failed to mark as removed: ${error.message}` });
      }
    }
  }

  // Sync/create employees from Square
  for (const tm of data.team_members || []) {
    try {
      const existing = await base44.asServiceRole.entities.Employee.filter({
        organization_id: orgId,
        square_team_member_id: tm.id
      });

      const employeeData = {
        organization_id: orgId,
        square_team_member_id: tm.id,
        full_name: `${tm.given_name || ''} ${tm.family_name || ''}`.trim(),
        email: tm.email_address || '',
        phone: tm.phone_number || '',
        employment_status: tm.status === 'ACTIVE' ? 'active' : 'terminated',
        role: existing.length > 0 ? existing[0].role : 'server',
        role_weight: existing.length > 0 ? existing[0].role_weight : 1.0,
        removed_from_square_at: null  // Clear removal flag if employee is back
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Employee.update(existing[0].id, employeeData);
        updated++;
      } else {
        await base44.asServiceRole.entities.Employee.create(employeeData);
        created++;
      }
    } catch (error) {
      errors.push({ entity_type: 'team_member', square_id: tm.id, error_message: error.message });
    }
  }

  await updateWatermark(base44, watermark.id, null, created + updated);
  return { created, updated, removed, errors };
}

// Sync Shifts for a location
async function syncShifts(base44, connection, orgId, locationId, sqLocationId) {
  const watermark = await getWatermark(base44, orgId, connection.id, 'shifts', sqLocationId);
  
  // Get shifts from last 7 days
  const startAt = new Date();
  startAt.setDate(startAt.getDate() - 7);
  
  const query = {
    filter: {
      location_ids: [sqLocationId],
      start: { start_at: startAt.toISOString() }
    }
  };

  const data = await squareApiCall('/v2/labor/shifts/search', connection.square_access_token_encrypted, 'POST', query);
  
  let created = 0, updated = 0;
  const errors = [];

  for (const shift of data.shifts || []) {
    try {
      const existing = await base44.asServiceRole.entities.Shift.filter({
        organization_id: orgId,
        square_shift_id: shift.id
      });

      const employee = await base44.asServiceRole.entities.Employee.filter({
        organization_id: orgId,
        square_team_member_id: shift.team_member_id
      });

      const shiftData = {
        organization_id: orgId,
        square_shift_id: shift.id,
        square_team_member_id: shift.team_member_id,
        employee_id: employee[0]?.id,
        location_id: locationId,
        square_location_id: sqLocationId,
        start_at: shift.start_at,
        end_at: shift.end_at,
        break_duration_seconds: shift.breaks?.reduce((sum, b) => sum + (b.duration_seconds || 0), 0) || 0,
        hours_worked: shift.end_at 
          ? (new Date(shift.end_at) - new Date(shift.start_at)) / (1000 * 60 * 60)
          : 0,
        status: shift.end_at ? 'closed' : 'open'
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Shift.update(existing[0].id, shiftData);
        updated++;
      } else {
        await base44.asServiceRole.entities.Shift.create(shiftData);
        created++;
      }
    } catch (error) {
      errors.push({ entity_type: 'shift', square_id: shift.id, error_message: error.message });
    }
  }

  await updateWatermark(base44, watermark.id, null, created + updated);
  return { created, updated, errors };
}

// Sync Payments for a location
async function syncPayments(base44, connection, orgId, locationId, sqLocationId) {
  const watermark = await getWatermark(base44, orgId, connection.id, 'payments', sqLocationId);
  
  const beginTime = watermark.last_successful_sync_at || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  })();

  const query = {
    location_ids: [sqLocationId],
    begin_time: beginTime,
    sort_order: 'ASC',
    cursor: watermark.last_cursor || undefined
  };

  const data = await squareApiCall(
    `/v2/payments?${new URLSearchParams(query).toString()}`,
    connection.square_access_token_encrypted
  );
  
  let created = 0, updated = 0;
  const errors = [];

  for (const payment of data.payments || []) {
    try {
      const existing = await base44.asServiceRole.entities.Payment.filter({
        organization_id: orgId,
        square_payment_id: payment.id
      });

      const employee = payment.team_member_id ? await base44.asServiceRole.entities.Employee.filter({
        organization_id: orgId,
        square_team_member_id: payment.team_member_id
      }) : [];

      const paymentData = {
        organization_id: orgId,
        square_payment_id: payment.id,
        square_order_id: payment.order_id,
        square_location_id: sqLocationId,
        location_id: locationId,
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

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Payment.update(existing[0].id, paymentData);
        updated++;
      } else {
        await base44.asServiceRole.entities.Payment.create(paymentData);
        created++;
      }
    } catch (error) {
      errors.push({ entity_type: 'payment', square_id: payment.id, error_message: error.message });
    }
  }

  await updateWatermark(base44, watermark.id, data.cursor, created + updated);
  return { created, updated, errors, cursor: data.cursor };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connection_id, entity_types = ['locations', 'team_members', 'shifts', 'payments'] } = await req.json();

    // Get user's organization from membership
    const memberships = await base44.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      status: 'active'
    });

    if (memberships.length === 0) {
      return Response.json({ error: 'No organization membership found' }, { status: 400 });
    }

    const orgId = memberships[0].organization_id;

    const connections = await base44.asServiceRole.entities.SquareConnection.filter({
      id: connection_id,
      organization_id: orgId
    });

    if (connections.length === 0) {
      return Response.json({ error: 'Connection not found' }, { status: 404 });
    }

    const connection = connections[0];

    // Don't sync if connection is revoked/expired
    if (connection.connection_status === 'revoked' || connection.connection_status === 'expired') {
      return Response.json({ 
        error: `Connection is ${connection.connection_status}. Please reconnect Square to sync.`,
        status: connection.connection_status
      }, { status: 403 });
    }

    const orgId = connection.organization_id;

    const syncJob = await base44.asServiceRole.entities.SyncJob.create({
      organization_id: orgId,
      square_connection_id: connection.id,
      sync_type: 'incremental',
      entities_synced: entity_types,
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: 'manual'
    });

    const results = { locations: null, team_members: null, shifts: null, payments: null };
    const allErrors = [];

    try {
      if (entity_types.includes('locations')) {
        results.locations = await syncLocations(base44, connection, orgId);
        allErrors.push(...results.locations.errors);
      }

      if (entity_types.includes('team_members')) {
        results.team_members = await syncTeamMembers(base44, connection, orgId);
        allErrors.push(...results.team_members.errors);
      }

      const locations = await base44.asServiceRole.entities.Location.filter({
        organization_id: orgId,
        active: true
      });

      if (entity_types.includes('shifts')) {
        for (const loc of locations) {
          const shiftResult = await syncShifts(base44, connection, orgId, loc.id, loc.square_location_id);
          if (!results.shifts) results.shifts = { created: 0, updated: 0, errors: [] };
          results.shifts.created += shiftResult.created;
          results.shifts.updated += shiftResult.updated;
          results.shifts.errors.push(...shiftResult.errors);
        }
        if (results.shifts) allErrors.push(...results.shifts.errors);
      }

      if (entity_types.includes('payments')) {
        for (const loc of locations) {
          const paymentResult = await syncPayments(base44, connection, orgId, loc.id, loc.square_location_id);
          if (!results.payments) results.payments = { created: 0, updated: 0, errors: [] };
          results.payments.created += paymentResult.created;
          results.payments.updated += paymentResult.updated;
          results.payments.errors.push(...paymentResult.errors);
        }
        if (results.payments) allErrors.push(...results.payments.errors);
      }

      const totalCreated = Object.values(results).reduce((sum, r) => sum + (r?.created || 0), 0);
      const totalUpdated = Object.values(results).reduce((sum, r) => sum + (r?.updated || 0), 0);

      await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
        completed_at: new Date().toISOString(),
        status: allErrors.length > 0 ? 'partial' : 'completed',
        records_created: totalCreated,
        records_updated: totalUpdated,
        errors: allErrors
      });

      await base44.asServiceRole.entities.SquareConnection.update(connection.id, {
        last_sync_at: new Date().toISOString()
      });

      await base44.asServiceRole.entities.SystemAuditEvent.create({
        organization_id: orgId,
        event_type: 'square_sync_completed',
        actor_type: 'user',
        actor_user_id: user.id,
        actor_email: user.email,
        entity_type: 'square_connection',
        entity_id: connection.id,
        after_snapshot: { results, errors_count: allErrors.length },
        changes_summary: `Synced ${totalCreated + totalUpdated} records`,
        hmrc_relevant: false,
        severity: allErrors.length > 0 ? 'warning' : 'info'
      });

      return Response.json({
        success: true,
        sync_job_id: syncJob.id,
        results,
        total_created: totalCreated,
        total_updated: totalUpdated,
        errors_count: allErrors.length
      });

    } catch (error) {
      await base44.asServiceRole.entities.SyncJob.update(syncJob.id, {
        completed_at: new Date().toISOString(),
        status: 'failed',
        errors: [...allErrors, { error_message: error.message }]
      });
      throw error;
    }

  } catch (error) {
    console.error('Sync engine error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});