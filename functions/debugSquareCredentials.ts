import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID');
    const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET');
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT')?.toLowerCase() || 'production';
    const BASE_URL = Deno.env.get('BASE_URL');

    // Detailed diagnostics
    const diagnostics = {
      credentials_loaded: {
        app_id_exists: !!SQUARE_APP_ID,
        app_id_length: SQUARE_APP_ID?.length || 0,
        app_id_full: SQUARE_APP_ID || 'NOT SET',
        app_secret_exists: !!SQUARE_APP_SECRET,
        app_secret_length: SQUARE_APP_SECRET?.length || 0,
        app_secret_first_10: SQUARE_APP_SECRET?.substring(0, 10) || 'NOT SET',
        app_secret_last_4: SQUARE_APP_SECRET?.substring(SQUARE_APP_SECRET?.length - 4) || 'NOT SET',
        environment: SQUARE_ENVIRONMENT,
        base_url: BASE_URL
      },
      validation: {
        app_id_format: SQUARE_APP_ID?.startsWith('sq0idp-') ? 'production' : SQUARE_APP_ID?.startsWith('sandbox-') ? 'sandbox' : 'invalid',
        app_id_too_short: SQUARE_APP_ID?.length < 35,
        expected_app_id_length: '35-45 characters',
        secret_starts_with: SQUARE_APP_SECRET?.substring(0, 10) || 'NOT SET',
        secret_has_spaces: SQUARE_APP_SECRET?.includes(' ') || false,
        secret_has_newlines: SQUARE_APP_SECRET?.includes('\n') || false,
      }
    };

    if (!SQUARE_APP_ID || !SQUARE_APP_SECRET) {
      return Response.json({
        success: false,
        message: '❌ Missing credentials',
        diagnostics,
        action: 'Set both SQUARE_APP_ID and SQUARE_APP_SECRET in Base44 secrets'
      });
    }

    // Square App IDs can vary in length, so let's just test them

    // Test with Square API
    const authUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    console.log('Testing credentials:', {
      environment: SQUARE_ENVIRONMENT,
      auth_url: authUrl,
      app_id_length: SQUARE_APP_ID.length,
      secret_length: SQUARE_APP_SECRET.length
    });

    const testResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-12-18'
      },
      body: JSON.stringify({
        client_id: SQUARE_APP_ID,
        client_secret: SQUARE_APP_SECRET,
        grant_type: 'authorization_code',
        code: 'intentionally_invalid_test_code_12345'
      })
    });

    const responseText = await testResponse.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw_text: responseText };
    }

    console.log('Square test response:', {
      status: testResponse.status,
      data: responseData
    });

    // Analyze response
    if (testResponse.status === 400 && responseData.error === 'invalid_grant') {
      // This is GOOD - means credentials are recognized
      return Response.json({
        success: true,
        message: '✅ Credentials ARE VALID!',
        details: [
          'Square recognized your Application ID and Secret',
          'The 401 error you saw earlier should now be resolved',
          'You can now try connecting Square from the Dashboard'
        ],
        diagnostics,
        square_response: responseData
      });
    } else if (testResponse.status === 401) {
      // Credentials rejected - The secret is definitely wrong
      return Response.json({
        success: false,
        message: '❌ Square rejected your Application Secret',
        details: [
          'HTTP 401 Unauthorized from Square',
          '',
          '⚠️ THE PROBLEM:',
          'The secret stored in Base44 does NOT match the secret in Square Dashboard',
          '',
          '✅ EXACT STEPS TO FIX:',
          '1. In Square Dashboard (where you are now), scroll to "Application secret"',
          '2. Click the blue "Replace" button',
          '3. A NEW secret will appear - COPY IT IMMEDIATELY',
          '4. Go to Base44 → Settings → Secrets → SQUARE_APP_SECRET',
          '5. Paste the NEW secret (all ~50 characters)',
          '6. Click "Update Secret"',
          '7. Wait 20 seconds for Base44 to redeploy',
          '8. Come back here and click "Run Full Diagnostic" again',
          '',
          '📋 CURRENT STATE:',
          `App ID in Base44: ${SQUARE_APP_ID}`,
          `Secret in Base44: ${SQUARE_APP_SECRET.substring(0, 10)}...${SQUARE_APP_SECRET.substring(SQUARE_APP_SECRET.length - 4)} (${SQUARE_APP_SECRET.length} chars)`,
          '',
          '🔍 This secret is being REJECTED by Square',
          'You must generate and copy a NEW secret from Square Dashboard'
        ],
        diagnostics,
        square_response: responseData,
        action_required: 'REPLACE_SECRET_IN_SQUARE_DASHBOARD'
      });
    } else if (testResponse.status === 400 && responseData.error === 'invalid_request') {
      return Response.json({
        success: true,
        message: '✅ Credentials are valid',
        details: [
          'Square recognized your credentials',
          'You should be able to connect now'
        ],
        diagnostics,
        square_response: responseData
      });
    } else {
      return Response.json({
        success: false,
        message: '⚠️ Unexpected response',
        details: [
          `HTTP ${testResponse.status}`,
          `Error: ${responseData.error || 'none'}`,
          `Description: ${responseData.error_description || 'none'}`
        ],
        diagnostics,
        square_response: responseData,
        raw_response: responseText
      });
    }

  } catch (error) {
    console.error('Debug error:', error);
    return Response.json({ 
      success: false,
      message: 'Diagnostic failed: ' + error.message,
      error: error.stack
    }, { status: 500 });
  }
});