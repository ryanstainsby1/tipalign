import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const PASS_TYPE_ID = Deno.env.get('APPLE_WALLET_PASS_TYPE_ID');
    const TEAM_ID = Deno.env.get('APPLE_WALLET_TEAM_ID');
    const CERT_P12_BASE64 = Deno.env.get('APPLE_WALLET_CERT_P12_BASE64');
    const CERT_PASSWORD = Deno.env.get('APPLE_WALLET_CERT_PASSWORD');
    const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const isWalletConfigured = !!(PASS_TYPE_ID && TEAM_ID && CERT_P12_BASE64 && CERT_PASSWORD);
    const isEmailConfigured = !!(SENDGRID_API_KEY || RESEND_API_KEY);

    return Response.json({
      success: true,
      wallet_configured: isWalletConfigured,
      email_configured: isEmailConfigured,
      features: {
        can_generate_passes: isWalletConfigured,
        can_send_invites: isEmailConfigured,
        can_share_links: true
      },
      missing: {
        wallet: !isWalletConfigured ? ['Apple Wallet certificates not configured'] : [],
        email: !isEmailConfigured ? ['Email service (SendGrid or Resend) not configured'] : []
      }
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});