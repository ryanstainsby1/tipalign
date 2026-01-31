import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  console.log('=== Wallet Web Service ===', method, path);

  const base44 = createClientFromRequest(req);
  const authHeader = req.headers.get('Authorization');
  const authToken = authHeader?.replace('ApplePass ', '') || '';

  if (method === 'GET' && path.match(/\/v1\/passes\/[^/]+\/[^/]+$/)) {
    const parts = path.split('/');
    const serialNumber = parts[parts.length - 1];

    try {
      const passes = await base44.asServiceRole.entities.WalletPass.filter({ serial_number: serialNumber });
      if (passes.length === 0) return new Response('Pass not found', { status: 404 });

      const pass = passes[0];
      if (pass.auth_token !== authToken) return new Response('Unauthorized', { status: 401 });

      await base44.asServiceRole.entities.WalletPass.update(pass.id, { last_accessed: new Date().toISOString() });

      return Response.json({ serialNumber: serialNumber, lastUpdated: pass.last_updated });
    } catch (error) {
      return new Response('Server error', { status: 500 });
    }
  }

  if (method === 'POST' && path.includes('/registrations/')) {
    const parts = path.split('/');
    const serialNumber = parts[parts.length - 1];
    const passTypeId = parts[parts.length - 2];
    const deviceId = parts[parts.length - 4];

    try {
      const bodyText = await req.text();
      const bodyData = bodyText ? JSON.parse(bodyText) : {};
      const pushToken = bodyData.pushToken || '';

      const passes = await base44.asServiceRole.entities.WalletPass.filter({ serial_number: serialNumber });
      if (passes.length === 0) return new Response('Pass not found', { status: 404 });
      if (passes[0].auth_token !== authToken) return new Response('Unauthorized', { status: 401 });

      try {
        const existingRegs = await base44.asServiceRole.entities.WalletDeviceRegistration.filter({
          device_id: deviceId,
          serial_number: serialNumber
        });

        if (existingRegs.length > 0) {
          await base44.asServiceRole.entities.WalletDeviceRegistration.update(existingRegs[0].id, {
            push_token: pushToken,
            updated_at: new Date().toISOString()
          });
          return new Response('', { status: 200 });
        } else {
          await base44.asServiceRole.entities.WalletDeviceRegistration.create({
            device_id: deviceId,
            serial_number: serialNumber,
            pass_type_id: passTypeId,
            push_token: pushToken,
            pass_id: passes[0].id,
            employee_id: passes[0].employee_id,
            organization_id: passes[0].organization_id,
            created_at: new Date().toISOString()
          });
          return new Response('', { status: 201 });
        }
      } catch (err) {
        return new Response('', { status: 201 });
      }
    } catch (error) {
      return new Response('Server error', { status: 500 });
    }
  }

  if (method === 'DELETE' && path.includes('/registrations/')) {
    const parts = path.split('/');
    const serialNumber = parts[parts.length - 1];
    const deviceId = parts[parts.length - 4];

    try {
      const regs = await base44.asServiceRole.entities.WalletDeviceRegistration.filter({
        device_id: deviceId,
        serial_number: serialNumber
      });
      for (const reg of regs) {
        await base44.asServiceRole.entities.WalletDeviceRegistration.delete(reg.id);
      }
      return new Response('', { status: 200 });
    } catch (error) {
      return new Response('', { status: 200 });
    }
  }

  if (method === 'GET' && path.includes('/registrations/') && !path.match(/\/[^/]+$/)) {
    const parts = path.split('/');
    const passTypeId = parts[parts.length - 1];
    const deviceId = parts[parts.length - 3];

    try {
      const regs = await base44.asServiceRole.entities.WalletDeviceRegistration.filter({
        device_id: deviceId,
        pass_type_id: passTypeId
      });

      const serialNumbers = [];
      for (const reg of regs) {
        serialNumbers.push(reg.serial_number);
      }

      if (serialNumbers.length === 0) {
        return new Response('', { status: 204 });
      }

      return Response.json({ serialNumbers: serialNumbers, lastUpdated: new Date().toISOString() });
    } catch (error) {
      return Response.json({ serialNumbers: [] });
    }
  }

  if (method === 'POST' && path.endsWith('/log')) {
    return new Response('', { status: 200 });
  }

  return new Response('Not found', { status: 404 });
});