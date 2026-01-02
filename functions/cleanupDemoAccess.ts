import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only allow admin to run this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all users
    const allUsers = await base44.asServiceRole.entities.User.list();
    
    // Get all memberships to DEMO_ORG_ID
    const demoMemberships = await base44.asServiceRole.entities.UserOrganizationMembership.filter({
      organization_id: DEMO_ORG_ID
    });

    const removed = [];
    const kept = [];

    for (const membership of demoMemberships) {
      const memberUser = allUsers.find(u => u.id === membership.user_id);
      
      if (memberUser && !memberUser.is_demo) {
        // Real user - remove from demo org
        await base44.asServiceRole.entities.UserOrganizationMembership.delete(membership.id);
        removed.push(memberUser.email);
      } else {
        kept.push(memberUser?.email || membership.user_id);
      }
    }

    return Response.json({
      success: true,
      removed_count: removed.length,
      removed_users: removed,
      demo_users_kept: kept,
      message: `Removed ${removed.length} real users from demo org`
    });

  } catch (error) {
    console.error('Cleanup demo access error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});