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

    if (!SQUARE_APP_ID || !SQUARE_APP_SECRET) {
      return Response.json({
        success: false,
        error: 'Missing credentials',
        details: {
          has_app_id: !!SQUARE_APP_ID,
          has_app_secret: !!SQUARE_APP_SECRET
        }
      });
    }

    // Try to get an OAuth token endpoint to verify credentials exist
    const authUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    console.log('Testing credentials with Square:', {
      environment: SQUARE_ENVIRONMENT,
      auth_url: authUrl,
      app_id_prefix: SQUARE_APP_ID.substring(0, 15)
    });

    // Try to make a test request to Square's API
    // We'll use the revoke endpoint with invalid data to test if credentials are recognized
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
        code: 'test_code_that_does_not_exist'
      })
    });

    const responseText = await testResponse.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    console.log('Square response:', {
      status: testResponse.status,
      headers: Object.fromEntries(testResponse.headers.entries()),
      body: responseData
    });

    // Check HTTP status first
    if (testResponse.status === 400 && responseData.error) {
      // 400 Bad Request with an error means Square processed our request
      if (responseData.error === 'invalid_request' || responseData.error === 'invalid_grant') {
        // These errors mean Square recognized our credentials but rejected the test code
        return Response.json({
          success: true,
          message: '✅ Credentials are valid and recognized by Square',
          details: [
            'Application ID is correct',
            'Application Secret is correct',
            'Square API is accessible',
            'Your app exists in Square Dashboard'
          ],
          square_response: {
            error: responseData.error,
            error_description: responseData.error_description
          }
        });
      } else if (responseData.error === 'unauthorized' || responseData.error === 'unauthorized_client') {
        return Response.json({
          success: false,
          message: '❌ Credentials not recognized by Square',
          details: [
            'Square rejected your Application ID or Secret',
            'Possible causes:',
            '  • Wrong Application ID for this environment',
            '  • Application Secret is incorrect or expired',
            '  • Application was deleted in Square Dashboard',
            '  • Using sandbox credentials in production or vice versa'
          ],
          square_response: responseData,
          recommendations: [
            '1. Log into Square Developer Dashboard',
            '2. Go to your application',
            '3. Verify the Application ID matches exactly',
            '4. Generate a NEW Application Secret and update it'
          ]
        });
      }
    } else if (testResponse.status === 401) {
      // 401 Unauthorized - credentials are wrong
      return Response.json({
        success: false,
        message: '❌ Square rejected your credentials',
        details: [
          'HTTP 401 Unauthorized',
          'Your Application Secret is incorrect or has been revoked',
          'Action required: Generate a new secret in Square Dashboard'
        ],
        square_response: responseData,
        http_status: testResponse.status
      });
    }

    // Unexpected response
    return Response.json({
      success: false,
      message: '⚠️ Unexpected response from Square',
      details: [
        `HTTP Status: ${testResponse.status}`,
        `Error: ${responseData.error || 'none'}`,
        `Description: ${responseData.error_description || 'none'}`,
        `Raw response: ${JSON.stringify(responseData)}`
      ],
      square_response: responseData,
      http_status: testResponse.status,
      debug_info: {
        response_text: responseText.substring(0, 500),
        content_type: testResponse.headers.get('content-type')
      }
    });

  } catch (error) {
    console.error('Credential test error:', error);
    return Response.json({ 
      success: false,
      message: 'Test failed: ' + error.message,
      error: error.stack
    }, { status: 500 });
  }
});