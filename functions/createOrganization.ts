import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();

    if (!name?.trim()) {
      return Response.json({ error: 'Organization name is required' }, { status: 400 });
    }

    // Check if user already owns an organization
    const existingMemberships = await base44.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      membership_role: 'owner',
      status: 'active'
    });

    if (existingMemberships.length > 0) {
      return Response.json({ 
        error: 'You already own an organization',
        organization_id: existingMemberships[0].organization_id
      }, { status: 400 });
    }

    // Create organization
    const organization = await base44.asServiceRole.entities.Organization.create({
      name: name.trim(),
      owner_user_id: user.id,
      status: 'active'
    });

    // Create membership
    await base44.asServiceRole.entities.UserOrganizationMembership.create({
      user_id: user.id,
      organization_id: organization.id,
      membership_role: 'owner',
      status: 'active'
    });

    // Keep user in pending_setup until Square is connected
    await base44.auth.updateMe({ account_status: 'pending_setup' });

    return Response.json({
      success: true,
      organization_id: organization.id,
      organization_name: organization.name
    });

  } catch (error) {
    console.error('Create organization error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});