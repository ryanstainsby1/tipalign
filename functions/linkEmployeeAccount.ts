import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, organization_id, employee_id } = await req.json();

    // If specific org and employee provided (from multi-match selection)
    if (organization_id && employee_id) {
      const employee = await base44.asServiceRole.entities.Employee.filter({ id: employee_id });
      
      if (!employee[0]) {
        return Response.json({ error: 'Employee not found' }, { status: 404 });
      }

      // Check if membership already exists
      const existingMembership = await base44.asServiceRole.entities.UserOrganizationMembership.filter({
        user_id: user.id,
        organization_id: organization_id
      });

      if (existingMembership.length === 0) {
        await base44.asServiceRole.entities.UserOrganizationMembership.create({
          user_id: user.id,
          organization_id: organization_id,
          membership_role: 'employee',
          status: 'active'
        });
      }

      // Check if link already exists
      const existingLink = await base44.asServiceRole.entities.SquareTeamMemberLink.filter({
        user_id: user.id,
        organization_id: organization_id
      });

      if (existingLink.length === 0) {
        await base44.asServiceRole.entities.SquareTeamMemberLink.create({
          user_id: user.id,
          organization_id: organization_id,
          square_team_member_id: employee[0].square_team_member_id,
          link_status: 'linked'
        });
      }

      // Activate user account with employee role
      await base44.asServiceRole.entities.User.update(user.id, {
        role_type: 'employee',
        account_status: 'active'
      });

      return Response.json({ success: true, linked: true });
    }

    // Otherwise search for employee by email
    const searchEmail = email?.toLowerCase() || user.email.toLowerCase();
    
    // Find all employees with matching email (not removed from Square)
    const employees = await base44.asServiceRole.entities.Employee.filter({
      email: searchEmail
    });

    const activeEmployees = employees.filter(emp => !emp.removed_from_square_at);

    if (activeEmployees.length === 0) {
      return Response.json({ 
        error: "We couldn't find a Square team profile for this email. Ask your employer to add you to their Square Team and run a sync.",
        success: false
      }, { status: 404 });
    }

    if (activeEmployees.length === 1) {
      // Single match - auto-link
      const emp = activeEmployees[0];

      // Check if membership already exists
      const existingMembership = await base44.asServiceRole.entities.UserOrganizationMembership.filter({
        user_id: user.id,
        organization_id: emp.organization_id
      });

      if (existingMembership.length === 0) {
        await base44.asServiceRole.entities.UserOrganizationMembership.create({
          user_id: user.id,
          organization_id: emp.organization_id,
          membership_role: 'employee',
          status: 'active'
        });
      }

      // Check if link already exists
      const existingLink = await base44.asServiceRole.entities.SquareTeamMemberLink.filter({
        user_id: user.id,
        organization_id: emp.organization_id
      });

      if (existingLink.length === 0) {
        await base44.asServiceRole.entities.SquareTeamMemberLink.create({
          user_id: user.id,
          organization_id: emp.organization_id,
          square_team_member_id: emp.square_team_member_id,
          link_status: 'linked'
        });
      }

      // Activate user account with employee role
      await base44.asServiceRole.entities.User.update(user.id, {
        role_type: 'employee',
        account_status: 'active'
      });

      return Response.json({ success: true, linked: true });
    }

    // Multiple matches - return list for user to choose
    const matchesWithOrgInfo = await Promise.all(
      activeEmployees.map(async (emp) => {
        const org = await base44.asServiceRole.entities.Organization.filter({ 
          id: emp.organization_id 
        });
        const locations = emp.locations?.length > 0 
          ? await base44.asServiceRole.entities.Location.filter({ id: emp.locations[0] })
          : [];

        return {
          employee_id: emp.id,
          employee_name: emp.full_name,
          organization_id: emp.organization_id,
          organization_name: org[0]?.name || 'Unknown Organization',
          location_name: locations[0]?.name
        };
      })
    );

    return Response.json({ 
      success: true,
      linked: false,
      matches: matchesWithOrgInfo
    });

  } catch (error) {
    console.error('Link employee account error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});