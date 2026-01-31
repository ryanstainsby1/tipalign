import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { employee_id, invite_method = 'link' } = body;

    console.log('=== Wallet Invite Service ===');

    if (!employee_id) {
      return Response.json({ success: false, error: 'employee_id is required' }, { status: 400 });
    }

    const employees = await base44.asServiceRole.entities.Employee.filter({ id: employee_id });
    if (employees.length === 0) {
      return Response.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const employee = employees[0];
    const orgId = employee.organization_id;

    let serialNumber = employee.wallet_serial_number;
    if (!serialNumber) {
      serialNumber = crypto.randomUUID();
      await base44.asServiceRole.entities.Employee.update(employee_id, {
        wallet_serial_number: serialNumber,
        wallet_status: 'invited',
        wallet_last_updated: new Date().toISOString()
      });
    }

    const downloadUrl = 'https://tiply.co.uk/functions/generatePkpass?employee_id=' + employee_id;
    const webUrl = 'https://tiply.app/wallet/' + employee_id + '/' + serialNumber;

    try {
      await base44.asServiceRole.entities.WalletInvite.create({
        organization_id: orgId,
        employee_id: employee_id,
        invite_type: invite_method,
        recipient: invite_method === 'email' ? employee.email : employee.phone,
        status: 'sent',
        sent_at: new Date().toISOString()
      });
    } catch (e) {}

    return Response.json({
      success: true,
      method: invite_method,
      download_url: downloadUrl,
      web_url: webUrl,
      serial_number: serialNumber,
      employee_name: employee.full_name,
      employee_email: employee.email
    });

  } catch (error) {
    console.error('Invite error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});