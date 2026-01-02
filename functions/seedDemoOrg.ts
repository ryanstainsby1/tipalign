import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_EMAIL = 'demo@tiply.app';
const DEMO_USER_EMAILS = ['demo@tiply.app', 'demo.employer@tiply.app', 'demo.employee@tiply.app'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only allow admin to run this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if demo org exists
    const existingOrgs = await base44.asServiceRole.entities.Organization.filter({
      id: DEMO_ORG_ID
    });

    if (existingOrgs.length === 0) {
      // Create demo organization
      await base44.asServiceRole.entities.Organization.create({
        id: DEMO_ORG_ID,
        name: 'Tiply Demo',
        owner_user_id: user.id,
        square_merchant_id: null,
        status: 'active'
      });
      console.log('Demo org created');
    }

    // Reassign all existing unassigned data to demo org
    const updates = [];

    // Update Locations without org
    const locations = await base44.asServiceRole.entities.Location.list();
    for (const loc of locations) {
      if (!loc.organization_id) {
        updates.push(
          base44.asServiceRole.entities.Location.update(loc.id, {
            organization_id: DEMO_ORG_ID
          })
        );
      }
    }

    // Update Employees without org
    const employees = await base44.asServiceRole.entities.Employee.list();
    for (const emp of employees) {
      if (!emp.organization_id) {
        updates.push(
          base44.asServiceRole.entities.Employee.update(emp.id, {
            organization_id: DEMO_ORG_ID
          })
        );
      }
    }

    // Update SquareConnections without org
    const connections = await base44.asServiceRole.entities.SquareConnection.list();
    for (const conn of connections) {
      if (!conn.organization_id) {
        updates.push(
          base44.asServiceRole.entities.SquareConnection.update(conn.id, {
            organization_id: DEMO_ORG_ID
          })
        );
      }
    }

    await Promise.all(updates);

    // Mark demo users with is_demo flag
    const allUsers = await base44.asServiceRole.entities.User.list();
    const demoUsers = allUsers.filter(u => DEMO_USER_EMAILS.includes(u.email.toLowerCase()));
    
    for (const demoUser of demoUsers) {
      await base44.asServiceRole.entities.User.update(demoUser.id, {
        is_demo: true,
        account_status: 'active'
      });
    }

    // Ensure demo users have membership
    for (const demoUser of demoUsers) {
      const memberships = await base44.asServiceRole.entities.UserOrganizationMembership.filter({
        user_id: demoUser.id,
        organization_id: DEMO_ORG_ID
      });

      if (memberships.length === 0) {
        await base44.asServiceRole.entities.UserOrganizationMembership.create({
          user_id: demoUser.id,
          organization_id: DEMO_ORG_ID,
          membership_role: demoUser.email === 'demo.employee@tiply.app' ? 'employee' : 'owner',
          status: 'active'
        });
      }
    }

    return Response.json({
      success: true,
      demo_org_id: DEMO_ORG_ID,
      updated_records: updates.length,
      demo_users_marked: demoUsers.length,
      message: 'Demo org seeded successfully'
    });

  } catch (error) {
    console.error('Seed demo org error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});