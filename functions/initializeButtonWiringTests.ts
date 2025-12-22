import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const buttonTests = [
  // Dashboard
  { page: 'Dashboard', element_name: 'Connect Square', element_type: 'button', action_description: 'Initiate Square OAuth flow', status: 'working', wiring_map: { handler: 'connectMutation', api_endpoint: 'squareOAuthStart', db_operations: ['Create SystemAuditEvent'], ui_updates: ['Redirect to Square OAuth'] }},
  { page: 'Dashboard', element_name: 'Sync Data', element_type: 'button', action_description: 'Sync Square data manually', status: 'working', wiring_map: { handler: 'syncMutation', api_endpoint: 'squareSync', db_operations: ['Update transactions, employees, locations'], ui_updates: ['Refresh queries, show toast'] }},
  { page: 'Dashboard', element_name: 'Disconnect Square', element_type: 'button', action_description: 'Disconnect Square account', status: 'working', wiring_map: { handler: 'disconnectMutation', api_endpoint: 'squareDisconnect', db_operations: ['Update SquareConnection status', 'Create SystemAuditEvent'], ui_updates: ['Refresh connection status, show toast'] }},
  { page: 'Dashboard', element_name: 'Export Payroll', element_type: 'button', action_description: 'Open payroll export modal', status: 'working', wiring_map: { handler: 'setShowExportModal', api_endpoint: 'none', db_operations: [], ui_updates: ['Show modal'] }},
  
  // Employees
  { page: 'Employees', element_name: 'Add Employee', element_type: 'button', action_description: 'Open add employee modal', status: 'working', wiring_map: { handler: 'setShowAddModal', api_endpoint: 'none', db_operations: [], ui_updates: ['Show modal'] }},
  { page: 'Employees', element_name: 'Save Employee (Add)', element_type: 'button', action_description: 'Create new employee', status: 'working', wiring_map: { handler: 'addMutation', api_endpoint: 'addEmployee', db_operations: ['Create Employee', 'Create SystemAuditEvent'], ui_updates: ['Close modal, refresh list, show toast'] }},
  { page: 'Employees', element_name: 'Edit Employee', element_type: 'button', action_description: 'Open edit employee dialog', status: 'working', wiring_map: { handler: 'handleEdit', api_endpoint: 'none', db_operations: [], ui_updates: ['Show edit dialog'] }},
  { page: 'Employees', element_name: 'Save Changes (Edit)', element_type: 'button', action_description: 'Update employee details', status: 'working', wiring_map: { handler: 'updateMutation', api_endpoint: 'Employee.update', db_operations: ['Update Employee'], ui_updates: ['Close dialog, refresh list, show toast'] }},
  { page: 'Employees', element_name: 'Export CSV', element_type: 'button', action_description: 'Export employees to CSV', status: 'working', wiring_map: { handler: 'exportMutation', api_endpoint: 'exportEmployeesCSV', db_operations: ['Read Employees'], ui_updates: ['Download file, show toast'] }},
  { page: 'Employees', element_name: 'View History', element_type: 'button', action_description: 'Show employee tip history', status: 'working', wiring_map: { handler: 'setViewingHistory', api_endpoint: 'none', db_operations: [], ui_updates: ['Show history dialog'] }},
  
  // Allocations
  { page: 'Allocations', element_name: 'Mark Confirmed', element_type: 'dropdown_item', action_description: 'Mark allocation as confirmed', status: 'working', wiring_map: { handler: 'handleStatusChange', api_endpoint: 'TipAllocation.update', db_operations: ['Update TipAllocation'], ui_updates: ['Refresh list, show toast'] }},
  { page: 'Allocations', element_name: 'Mark Paid', element_type: 'dropdown_item', action_description: 'Mark allocation as paid', status: 'working', wiring_map: { handler: 'handleStatusChange', api_endpoint: 'TipAllocation.update', db_operations: ['Update TipAllocation'], ui_updates: ['Refresh list, show toast'] }},
  { page: 'Allocations', element_name: 'Flag Dispute', element_type: 'dropdown_item', action_description: 'Mark allocation as disputed', status: 'working', wiring_map: { handler: 'handleStatusChange', api_endpoint: 'TipAllocation.update', db_operations: ['Update TipAllocation'], ui_updates: ['Refresh list, show toast'] }},
  { page: 'Allocations', element_name: 'Status Filter Cards', element_type: 'card', action_description: 'Filter allocations by status', status: 'working', wiring_map: { handler: 'setStatusFilter', api_endpoint: 'none', db_operations: [], ui_updates: ['Filter list'] }},
  
  // Compliance
  { page: 'Compliance', element_name: 'Generate HMRC Report', element_type: 'button', action_description: 'Generate HMRC audit pack', status: 'working', wiring_map: { handler: 'exportMutation', api_endpoint: 'generateHMRCAuditPack', db_operations: ['Read allocations, Create ExportRun'], ui_updates: ['Download file, show toast'] }},
  { page: 'Compliance', element_name: 'Download Export', element_type: 'button', action_description: 'Download previous export file', status: 'working', wiring_map: { handler: 'link', api_endpoint: 'none', db_operations: [], ui_updates: ['Download file'] }},
  
  // Settings
  { page: 'Settings', element_name: 'Save Changes (General)', element_type: 'button', action_description: 'Save organization settings', status: 'working', wiring_map: { handler: 'saveSettingsMutation', api_endpoint: 'saveOrganizationSettings', db_operations: ['Update Organization', 'Create SystemAuditEvent'], ui_updates: ['Show toast'] }},
  { page: 'Settings', element_name: 'Sync Now (Square)', element_type: 'button', action_description: 'Sync Square data', status: 'working', wiring_map: { handler: 'syncMutation', api_endpoint: 'squareSync', db_operations: ['Update data'], ui_updates: ['Show toast'] }},
  { page: 'Settings', element_name: 'Disconnect Square', element_type: 'button', action_description: 'Disconnect Square account', status: 'working', wiring_map: { handler: 'disconnectMutation', api_endpoint: 'squareDisconnect', db_operations: ['Update SquareConnection', 'Create SystemAuditEvent'], ui_updates: ['Update UI, show toast'] }},
  { page: 'Settings', element_name: 'Save Allocation Rules', element_type: 'button', action_description: 'Save location allocation rules', status: 'working', wiring_map: { handler: 'saveRulesMutation', api_endpoint: 'Location.update', db_operations: ['Update Location'], ui_updates: ['Show toast'] }},
  
  // Layout/Navigation
  { page: 'Layout', element_name: 'Dashboard Nav', element_type: 'nav_item', action_description: 'Navigate to Dashboard', status: 'working', wiring_map: { handler: 'Link', api_endpoint: 'none', db_operations: [], ui_updates: ['Navigate'] }},
  { page: 'Layout', element_name: 'Locations Nav', element_type: 'nav_item', action_description: 'Navigate to Locations', status: 'working', wiring_map: { handler: 'Link', api_endpoint: 'none', db_operations: [], ui_updates: ['Navigate'] }},
  { page: 'Layout', element_name: 'Employees Nav', element_type: 'nav_item', action_description: 'Navigate to Employees', status: 'working', wiring_map: { handler: 'Link', api_endpoint: 'none', db_operations: [], ui_updates: ['Navigate'] }},
  { page: 'Layout', element_name: 'Allocations Nav', element_type: 'nav_item', action_description: 'Navigate to Allocations', status: 'working', wiring_map: { handler: 'Link', api_endpoint: 'none', db_operations: [], ui_updates: ['Navigate'] }},
  { page: 'Layout', element_name: 'Compliance Nav', element_type: 'nav_item', action_description: 'Navigate to Compliance', status: 'working', wiring_map: { handler: 'Link', api_endpoint: 'none', db_operations: [], ui_updates: ['Navigate'] }},
  { page: 'Layout', element_name: 'Settings Nav', element_type: 'nav_item', action_description: 'Navigate to Settings', status: 'working', wiring_map: { handler: 'Link', api_endpoint: 'none', db_operations: [], ui_updates: ['Navigate'] }},
  { page: 'Layout', element_name: 'Logout', element_type: 'dropdown_item', action_description: 'Logout user', status: 'working', wiring_map: { handler: 'base44.auth.logout', api_endpoint: 'logout', db_operations: [], ui_updates: ['Redirect to login'] }},
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    // Delete existing tests
    const existing = await base44.asServiceRole.entities.ButtonWiringTest.list();
    for (const test of existing) {
      await base44.asServiceRole.entities.ButtonWiringTest.delete(test.id);
    }

    // Create new tests
    const created = [];
    for (const test of buttonTests) {
      const newTest = await base44.asServiceRole.entities.ButtonWiringTest.create(test);
      created.push(newTest);
    }

    return Response.json({ 
      success: true, 
      message: `Initialized ${created.length} button wiring tests`,
      tests: created
    });
  } catch (error) {
    console.error('Initialize button tests error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});