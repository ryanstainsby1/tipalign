import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org_id = user.organization_id || user.id;
    const issues = [];
    
    // Check 1: Audit logging enabled (check if audit logs exist)
    const auditLogs = await base44.asServiceRole.entities.AuditLog.list('-created_date', 1);
    const audit_logging = auditLogs.length > 0;
    if (!audit_logging) {
      issues.push({
        severity: 'high',
        category: 'audit_logging',
        message: 'No audit trail detected. Enable audit logging for HMRC compliance.'
      });
    }

    // Check 2: Allocation rules configured
    const locations = await base44.asServiceRole.entities.Location.filter({ organization_id: org_id });
    const allocation_rules_set = locations.length > 0 && locations.some(l => l.current_tip_rule_set_id);
    if (!allocation_rules_set && locations.length > 0) {
      issues.push({
        severity: 'medium',
        category: 'allocation_rules',
        message: 'Allocation rules not configured for all locations.'
      });
    }

    // Check 3: Unresolved disputes
    const disputes = await base44.asServiceRole.entities.Dispute.filter({ 
      status: 'open' 
    });
    const unresolved_disputes = disputes.length;
    if (unresolved_disputes > 0) {
      issues.push({
        severity: 'medium',
        category: 'disputes',
        message: `${unresolved_disputes} unresolved dispute(s) pending review.`
      });
    }

    // Check 4: Employee records complete (have NI numbers, bank details)
    const employees = await base44.asServiceRole.entities.Employee.filter({ 
      organization_id: org_id,
      employment_status: 'active'
    });
    const incompleteEmployees = employees.filter(e => 
      !e.full_name || !e.email
    );
    const employee_records_complete = incompleteEmployees.length === 0;
    if (!employee_records_complete) {
      issues.push({
        severity: 'high',
        category: 'employee_data',
        message: `${incompleteEmployees.length} employee(s) have incomplete records (missing name/email).`
      });
    }

    // Check 5: Transactions without allocations
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      allocation_status: 'pending'
    });
    if (transactions.length > 10) {
      issues.push({
        severity: 'low',
        category: 'pending_allocations',
        message: `${transactions.length} transactions awaiting allocation.`
      });
    }

    // Check 6: HMRC identifiers present (PAYE reference, etc)
    const organization = await base44.asServiceRole.entities.Organization.filter({ id: org_id });
    const hasPayeRef = organization.length > 0 && organization[0].paye_reference;
    if (!hasPayeRef) {
      issues.push({
        severity: 'high',
        category: 'tax_identifiers',
        message: 'PAYE reference not configured. Required for HMRC compliance.'
      });
    }

    // Overall HMRC ready status
    const hmrc_ready = issues.filter(i => i.severity === 'high').length === 0;

    // Calculate compliance score
    const totalChecks = 6;
    const passedChecks = totalChecks - issues.length;
    const compliance_score = Math.round((passedChecks / totalChecks) * 100);

    return Response.json({
      success: true,
      hmrc_ready,
      compliance_score,
      checks: {
        audit_logging,
        allocation_rules_set,
        employee_records_complete,
        unresolved_disputes,
        has_paye_reference: hasPayeRef,
        pending_allocations: transactions.length
      },
      issues,
      summary: {
        total_issues: issues.length,
        high_severity: issues.filter(i => i.severity === 'high').length,
        medium_severity: issues.filter(i => i.severity === 'medium').length,
        low_severity: issues.filter(i => i.severity === 'low').length
      }
    });

  } catch (error) {
    console.error('Compliance status check error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});