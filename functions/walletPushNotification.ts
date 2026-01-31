import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { employee_id, organization_id } = body;

    console.log('=== Wallet Push Notification ===');

    let passesToUpdate = [];

    if (employee_id) {
      passesToUpdate = await base44.asServiceRole.entities.WalletPass.filter({ employee_id: employee_id });
    } else if (organization_id) {
      passesToUpdate = await base44.asServiceRole.entities.WalletPass.filter({ organization_id: organization_id });
    } else {
      return Response.json({ success: false, error: 'employee_id or organization_id required' }, { status: 400 });
    }

    if (passesToUpdate.length === 0) {
      return Response.json({ success: true, message: 'No passes found', passes_updated: 0 });
    }

    let updated = 0;
    for (const pass of passesToUpdate) {
      try {
        await base44.asServiceRole.entities.WalletPass.update(pass.id, {
          last_updated: new Date().toISOString()
        });
        updated++;
      } catch (err) {}
    }

    return Response.json({
      success: true,
      passes_updated: updated
    });

  } catch (error) {
    console.error('Push notification error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});