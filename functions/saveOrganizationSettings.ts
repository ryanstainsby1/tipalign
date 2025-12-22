import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { settings } = await req.json();

    // Get or create organization
    const organizations = await base44.asServiceRole.entities.Organization.filter({
      id: user.organization_id || user.id
    });

    let organization;
    if (organizations.length > 0) {
      organization = organizations[0];
      await base44.asServiceRole.entities.Organization.update(organization.id, settings);
    } else {
      organization = await base44.asServiceRole.entities.Organization.create({
        ...settings,
        primary_contact_email: user.email
      });
    }

    // Create audit event
    await base44.asServiceRole.entities.SystemAuditEvent.create({
      organization_id: organization.id,
      event_type: 'organization_settings_changed',
      actor_type: 'user',
      actor_user_id: user.id,
      actor_email: user.email,
      entity_type: 'organization',
      entity_id: organization.id,
      after_snapshot: settings,
      changes_summary: 'Organization settings updated',
      severity: 'info'
    });

    return Response.json({ success: true, organization });
  } catch (error) {
    console.error('Save settings error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});