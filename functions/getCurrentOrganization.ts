import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's active organization memberships
    const memberships = await base44.entities.UserOrganizationMembership.filter({
      user_id: user.id,
      status: 'active'
    });

    if (memberships.length === 0) {
      return Response.json({ 
        success: false,
        error: 'No organization membership found',
        needs_onboarding: true
      });
    }

    // For now, return the first membership (later can add org switcher)
    const membership = memberships[0];
    
    const org = await base44.entities.Organization.filter({ 
      id: membership.organization_id 
    });

    if (org.length === 0) {
      return Response.json({ 
        success: false,
        error: 'Organization not found'
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      organization: org[0],
      membership_role: membership.membership_role,
      all_memberships: memberships.map(m => ({
        organization_id: m.organization_id,
        role: m.membership_role
      }))
    });

  } catch (error) {
    console.error('Get current organization error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});