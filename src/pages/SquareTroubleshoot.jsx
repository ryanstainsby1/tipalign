import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function SquareTroubleshoot() {
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['recentOAuthAttempts'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SystemAuditEvent.filter(
        {
          organization_id: user.organization_id || user.id,
          event_type: 'square_connect_started'
        },
        '-created_date',
        5
      );
    }
  });

  const { data: errors = [] } = useQuery({
    queryKey: ['recentErrors'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.AppError.filter(
        {
          organization_id: user.organization_id || user.id,
          page: 'OAuth Callback'
        },
        '-created_date',
        5
      );
    }
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('validateSquareConfig', {});
      return response.data;
    }
  });

  const testCredentialsMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('testSquareCredentials', {});
      return response.data;
    }
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('squareOAuthStart', {});
      return response.data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      setTesting(false);
    },
    onError: (error) => {
      setTestResult({ success: false, error: error.message });
      setTesting(false);
    }
  });

  const handleTest = () => {
    setTesting(true);
    testMutation.mutate();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getStatusIcon = (status) => {
    if (status === 'success') return <CheckCircle className="w-5 h-5 text-emerald-600" />;
    if (status === 'error') return <XCircle className="w-5 h-5 text-rose-600" />;
    return <AlertTriangle className="w-5 h-5 text-amber-600" />;
  };

  const getStatusBadge = (status) => {
    if (status === 'success') return <Badge className="bg-emerald-100 text-emerald-700">OK</Badge>;
    if (status === 'error') return <Badge className="bg-rose-100 text-rose-700">Error</Badge>;
    return <Badge className="bg-amber-100 text-amber-700">Warning</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Square OAuth Troubleshooter</h1>
          <p className="text-slate-500 mt-1">Diagnose and fix Square connection issues</p>
        </div>

        {/* Step 1: Validate Format */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <CardTitle>Validate Configuration Format</CardTitle>
                <CardDescription>Check if your Application ID matches the environment</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {validateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Check Format
                </>
              )}
            </Button>

            {validateMutation.data && (
              <Alert className={`mt-4 ${validateMutation.data.valid ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                {validateMutation.data.valid ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                <AlertDescription className={validateMutation.data.valid ? 'text-emerald-900' : 'text-rose-900'}>
                  {validateMutation.data.message}
                  {validateMutation.data.details && (
                    <div className="mt-2 space-y-1 text-sm">
                      {validateMutation.data.details.map((detail, i) => (
                        <div key={i}>• {detail}</div>
                      ))}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Test Credentials */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <CardTitle>Test Credentials with Square API</CardTitle>
                <CardDescription>Verify Square recognizes your Application ID and Secret</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => testCredentialsMutation.mutate()}
              disabled={testCredentialsMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {testCredentialsMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing with Square...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Test Credentials
                </>
              )}
            </Button>

            {testCredentialsMutation.data && (
              <Alert className={`mt-4 ${testCredentialsMutation.data.success ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                {testCredentialsMutation.data.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                <AlertDescription className={testCredentialsMutation.data.success ? 'text-emerald-900' : 'text-rose-900'}>
                  <p className="font-semibold">{testCredentialsMutation.data.message}</p>
                  {testCredentialsMutation.data.details && (
                    <div className="mt-2 space-y-1 text-sm">
                      {testCredentialsMutation.data.details.map((detail, i) => (
                        <div key={i}>{detail}</div>
                      ))}
                    </div>
                  )}
                  {testCredentialsMutation.data.recommendations && (
                    <div className="mt-3 p-3 bg-white rounded border border-rose-200">
                      <p className="font-medium text-sm mb-2">How to fix:</p>
                      {testCredentialsMutation.data.recommendations.map((rec, i) => (
                        <div key={i} className="text-sm">{rec}</div>
                      ))}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Test OAuth Flow */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <CardTitle>Test OAuth Flow</CardTitle>
                <CardDescription>Run a test to see if your Square settings are correct</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleTest}
              disabled={testing || testMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {testing || testMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run OAuth Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResult && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Test Results</CardTitle>
                {getStatusBadge(testResult.success ? 'success' : 'error')}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {testResult.success ? (
                <>
                  <Alert className="border-emerald-200 bg-emerald-50">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-900">
                      OAuth configuration test passed! Click the button below to complete the connection.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-700">Environment:</span>
                      <Badge>{testResult.environment}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-700">Callback URL:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-white px-2 py-1 rounded">{testResult.callback_url}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(testResult.callback_url)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => window.location.href = testResult.redirect_url}
                    className="w-full bg-slate-900 hover:bg-slate-800"
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                    </svg>
                    Continue to Square Authorization
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <Alert className="border-rose-200 bg-rose-50">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <AlertDescription className="text-rose-900">
                    <strong>Error:</strong> {testResult.error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Configuration Checklist */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Required Configuration</CardTitle>
            <CardDescription>Make sure these are set correctly in your Square Developer Dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Application ID (SQUARE_APP_ID)</p>
                  <p className="text-sm text-slate-600 mt-1">Set in Base44 secrets</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Application Secret (SQUARE_APP_SECRET)</p>
                  <p className="text-sm text-slate-600 mt-1">Set in Base44 secrets</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Base URL (BASE_URL)</p>
                  <p className="text-sm text-slate-600 mt-1">Set in Base44 secrets</p>
                  {testResult?.callback_url && (
                    <code className="text-xs bg-white px-2 py-1 rounded block mt-2">{testResult.callback_url}</code>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900">Redirect URI in Square Dashboard</p>
                  <p className="text-sm text-amber-700 mt-1">
                    MUST match exactly (including https:// and no trailing slash)
                  </p>
                  {testResult?.callback_url && (
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-white px-2 py-1 rounded flex-1">{testResult.callback_url}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(testResult.callback_url)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Common Issues */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Common Issues & Solutions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="border-l-4 border-rose-500 pl-4">
                <h4 className="font-semibold text-slate-900 mb-1">"Unknown error" from Square</h4>
                <p className="text-sm text-slate-600 mb-2">Usually means the Application ID doesn't match the environment</p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>Check SQUARE_ENVIRONMENT is set to "production" (not "Production")</li>
                  <li>Verify you're using a PRODUCTION Application ID, not sandbox</li>
                  <li>Application ID should start with "sq0idp-" for production</li>
                </ul>
              </div>

              <div className="border-l-4 border-amber-500 pl-4">
                <h4 className="font-semibold text-slate-900 mb-1">"Redirect URI mismatch"</h4>
                <p className="text-sm text-slate-600 mb-2">The redirect URI in Square Dashboard doesn't match</p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>Copy the exact callback URL from the test results above</li>
                  <li>Go to Square Developer Dashboard → Your App → OAuth</li>
                  <li>Paste it in "Redirect URL" field</li>
                  <li>Make sure there's NO trailing slash</li>
                </ul>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <h4 className="font-semibold text-slate-900 mb-1">"Invalid credentials"</h4>
                <p className="text-sm text-slate-600 mb-2">Application Secret is wrong or missing</p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>Verify SQUARE_APP_SECRET is set correctly</li>
                  <li>The secret should start with "sq0csp-" for production</li>
                  <li>Re-copy from Square Dashboard if unsure</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent OAuth Attempts */}
        {auditEvents.length > 0 && (
          <Card className="mb-6 border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Connection Attempts</CardTitle>
              <CardDescription>Last 5 OAuth initialization attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{event.actor_email}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(event.created_date).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">Started</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Errors */}
        {errors.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>OAuth callback errors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {errors.map((error) => (
                  <Alert key={error.id} className="border-rose-200 bg-rose-50">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <AlertDescription className="text-rose-900">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{error.error_message}</p>
                          <p className="text-xs text-rose-700 mt-1">
                            {new Date(error.created_date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="mt-6 border-0 shadow-sm bg-indigo-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-indigo-900 mb-3">Need Help?</h3>
            <div className="space-y-2 text-sm text-indigo-800">
              <p>1. Run the test above to verify your configuration</p>
              <p>2. Copy the callback URL and add it to Square Dashboard → OAuth → Redirect URL</p>
              <p>3. Make sure SQUARE_ENVIRONMENT matches your Application ID (production vs sandbox)</p>
              <p>4. Click "Continue to Square Authorization" once the test passes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}