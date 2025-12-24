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
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT');

    // Character-by-character inspection
    const inspectString = (str, name) => {
      if (!str) return { exists: false };
      
      const chars = [];
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const code = char.charCodeAt(0);
        chars.push({
          pos: i,
          char: char,
          code: code,
          is_space: code === 32,
          is_newline: code === 10 || code === 13,
          is_tab: code === 9,
          is_special: code < 32 || code > 126
        });
      }
      
      return {
        exists: true,
        raw_length: str.length,
        trimmed_length: str.trim().length,
        starts_with: str.substring(0, 15),
        ends_with: str.substring(str.length - 10),
        full_value: str,
        has_leading_space: str[0] === ' ' || str.charCodeAt(0) < 33,
        has_trailing_space: str[str.length - 1] === ' ' || str.charCodeAt(str.length - 1) < 33,
        first_10_chars: chars.slice(0, 10),
        last_10_chars: chars.slice(-10),
        special_chars_found: chars.filter(c => c.is_special || c.is_space || c.is_newline || c.is_tab)
      };
    };

    const appIdInspection = inspectString(SQUARE_APP_ID, 'SQUARE_APP_ID');
    const secretInspection = inspectString(SQUARE_APP_SECRET, 'SQUARE_APP_SECRET');

    // Now test with Square using the EXACT values
    const authUrl = (SQUARE_ENVIRONMENT?.toLowerCase().trim() || 'production') === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    const requestBody = {
      client_id: SQUARE_APP_ID,
      client_secret: SQUARE_APP_SECRET,
      grant_type: 'authorization_code',
      code: 'test_invalid_code_12345'
    };

    console.log('Sending to Square:', {
      url: authUrl,
      client_id_length: SQUARE_APP_ID?.length,
      client_secret_length: SQUARE_APP_SECRET?.length
    });

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2024-12-18'
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { raw: responseText };
    }

    return Response.json({
      credentials_inspection: {
        app_id: appIdInspection,
        secret: {
          ...secretInspection,
          // Don't expose full secret
          full_value: undefined,
          first_10_chars: secretInspection.first_10_chars?.map(c => ({ ...c, char: c.pos < 10 ? c.char : '*' }))
        }
      },
      square_test: {
        request_url: authUrl,
        request_body_keys: Object.keys(requestBody),
        response_status: response.status,
        response_data: responseData
      },
      diagnosis: {
        credentials_valid: response.status === 400 && (responseData.error === 'invalid_grant' || responseData.error === 'invalid_request'),
        credentials_rejected: response.status === 401,
        whitespace_issues: appIdInspection.special_chars_found?.length > 0 || secretInspection.special_chars_found?.length > 0
      }
    });

  } catch (error) {
    console.error('Inspection error:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});