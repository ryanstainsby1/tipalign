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
    const SQUARE_ENVIRONMENT = Deno.env.get('SQUARE_ENVIRONMENT')?.toLowerCase() || 'production';

    const issues = [];
    let valid = true;

    // Check if App ID exists
    if (!SQUARE_APP_ID) {
      return Response.json({
        valid: false,
        message: '❌ SQUARE_APP_ID is not set',
        details: ['Go to Settings and add SQUARE_APP_ID secret']
      });
    }

    // Validate App ID format based on environment
    if (SQUARE_ENVIRONMENT === 'production') {
      if (!SQUARE_APP_ID.startsWith('sq0idp-')) {
        valid = false;
        issues.push('Your Application ID should start with "sq0idp-" for production');
        issues.push(`Current ID starts with: "${SQUARE_APP_ID.substring(0, 10)}..."`);
        issues.push('This looks like a SANDBOX ID being used in PRODUCTION mode');
      }
    } else if (SQUARE_ENVIRONMENT === 'sandbox') {
      if (!SQUARE_APP_ID.startsWith('sandbox-')) {
        valid = false;
        issues.push('Your Application ID should start with "sandbox-" for sandbox');
        issues.push(`Current ID starts with: "${SQUARE_APP_ID.substring(0, 10)}..."`);
        issues.push('This looks like a PRODUCTION ID being used in SANDBOX mode');
      }
    }

    // Check environment value
    if (SQUARE_ENVIRONMENT !== 'production' && SQUARE_ENVIRONMENT !== 'sandbox') {
      valid = false;
      issues.push(`SQUARE_ENVIRONMENT is set to "${SQUARE_ENVIRONMENT}"`);
      issues.push('It should be either "production" or "sandbox" (lowercase)');
    }

    if (valid) {
      return Response.json({
        valid: true,
        message: '✅ Configuration looks correct!',
        details: [
          `Environment: ${SQUARE_ENVIRONMENT}`,
          `Application ID format: Valid for ${SQUARE_ENVIRONMENT}`,
          `App ID prefix: ${SQUARE_APP_ID.substring(0, 15)}...`
        ]
      });
    } else {
      return Response.json({
        valid: false,
        message: '❌ Configuration Error: App ID doesn\'t match environment',
        details: issues
      });
    }

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ 
      valid: false,
      message: 'Validation failed: ' + error.message
    }, { status: 500 });
  }
});