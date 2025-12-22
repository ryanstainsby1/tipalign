import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function SmokeTest() {
  const [testResults, setTestResults] = useState({});
  const [runningTests, setRunningTests] = useState(new Set());
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['squareConnections'],
    queryFn: () => base44.entities.SquareConnection.list(),
  });

  const { data: syncJobs = [] } = useQuery({
    queryKey: ['recentSyncJobs'],
    queryFn: () => base44.entities.SyncJob.list('-started_at', 10),
  });

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['recentWebhooks'],
    queryFn: () => base44.entities.WebhookLog.list('-received_at', 10),
  });

  const updateTestResult = (testId, result) => {
    setTestResults(prev => ({
      ...prev,
      [testId]: {
        ...result,
        timestamp: new Date().toISOString()
      }
    }));
    setRunningTests(prev => {
      const next = new Set(prev);
      next.delete(testId);
      return next;
    });
  };

  const runTest = async (testId, testFn) => {
    setRunningTests(prev => new Set(prev).add(testId));
    try {
      const result = await testFn();
      updateTestResult(testId, { status: 'pass', ...result });
      toast.success(`✓ ${testId} passed`);
    } catch (error) {
      updateTestResult(testId, { 
        status: 'fail', 
        error: error.message,
        stack: error.stack
      });
      toast.error(`✗ ${testId} failed`);
    }
  };

  // Test 1: Square Connection Validation
  const testSquareConnection = async () => {
    const activeConnection = connections.find(c => c.connection_status === 'connected');
    if (!activeConnection) {
      throw new Error('No active Square connection found. Please connect Square first.');
    }
    
    return {
      details: `Connection active for ${activeConnection.merchant_business_name}`,
      connectionId: activeConnection.id,
      merchantId: activeConnection.square_merchant_id
    };
  };

  // Test 2: Bootstrap Sync (Locations & Staff)
  const testBootstrapSync = async () => {
    const activeConnection = connections.find(c => c.connection_status === 'connected');
    if (!activeConnection) {
      throw new Error('No active connection');
    }

    const beforeLocations = await base44.entities.Location.list();
    const beforeEmployees = await base44.entities.Employee.list();

    const response = await base44.functions.invoke('squareSync', {
      connection_id: activeConnection.id,
      triggered_by: 'smoke_test'
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Sync failed');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    await queryClient.invalidateQueries({ queryKey: ['recentSyncJobs'] });

    const afterLocations = await base44.entities.Location.list();
    const afterEmployees = await base44.entities.Employee.list();

    return {
      details: `Locations: ${beforeLocations.length}→${afterLocations.length}, Staff: ${beforeEmployees.length}→${afterEmployees.length}`,
      syncJobId: response.data.sync_job_id,
      created: response.data.records_created,
      updated: response.data.records_updated
    };
  };

  // Test 3: Manual Sync Now
  const testManualSync = async () => {
    const activeConnection = connections.find(c => c.connection_status === 'connected');
    if (!activeConnection) {
      throw new Error('No active connection');
    }

    const beforeJobs = await base44.entities.SyncJob.list('-started_at', 1);
    
    const response = await base44.functions.invoke('squareSync', {
      connection_id: activeConnection.id,
      triggered_by: 'manual'
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'Manual sync failed');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    const afterJobs = await base44.entities.SyncJob.list('-started_at', 1);

    return {
      details: `Sync job ${response.data.sync_job_id} created`,
      syncJobId: response.data.sync_job_id,
      recordsProcessed: response.data.records_created + response.data.records_updated
    };
  };

  // Test 4: CRUD - Create Employee
  const testCreateEmployee = async () => {
    const testEmployee = {
      organization_id: user.organization_id || user.id,
      square_team_member_id: `TEST_${Date.now()}`,
      full_name: 'Test Employee',
      email: `test.${Date.now()}@example.com`,
      role: 'server',
      employment_status: 'active'
    };

    const created = await base44.entities.Employee.create(testEmployee);

    // Clean up
    await base44.entities.Employee.delete(created.id);

    return {
      details: 'Employee created and deleted successfully',
      employeeId: created.id
    };
  };

  // Test 5: CRUD - Create Location
  const testCreateLocation = async () => {
    const testLocation = {
      organization_id: user.organization_id || user.id,
      square_location_id: `TEST_LOC_${Date.now()}`,
      name: 'Test Location',
      active: true
    };

    const created = await base44.entities.Location.create(testLocation);

    // Clean up
    await base44.entities.Location.delete(created.id);

    return {
      details: 'Location created and deleted successfully',
      locationId: created.id
    };
  };

  // Test 6: Webhook Processing
  const testWebhookProcessing = async () => {
    const recentWebhooks = await base44.entities.WebhookLog.list('-received_at', 10);
    
    if (recentWebhooks.length === 0) {
      return {
        details: 'No webhooks received yet (not an error)',
        warning: true
      };
    }

    const processedCount = recentWebhooks.filter(w => w.processed).length;
    const failedCount = recentWebhooks.filter(w => !w.processed && w.processing_error).length;

    return {
      details: `${processedCount} processed, ${failedCount} failed out of ${recentWebhooks.length} total`,
      processedCount,
      failedCount
    };
  };

  // Test 7: Sync Job Status
  const testSyncJobStatus = async () => {
    const jobs = await base44.entities.SyncJob.list('-started_at', 5);
    
    if (jobs.length === 0) {
      throw new Error('No sync jobs found');
    }

    const completedCount = jobs.filter(j => j.status === 'completed').length;
    const failedCount = jobs.filter(j => j.status === 'failed').length;
    const runningCount = jobs.filter(j => j.status === 'running').length;

    return {
      details: `${completedCount} completed, ${failedCount} failed, ${runningCount} running`,
      totalJobs: jobs.length,
      latestJobId: jobs[0].id
    };
  };

  // Test 8: Error Logging
  const testErrorLogging = async () => {
    try {
      await base44.entities.AppError.create({
        organization_id: user.organization_id || user.id,
        user_email: user.email,
        page: 'SmokeTest',
        action_name: 'test_error_logging',
        error_message: 'This is a test error',
        severity: 'info'
      });

      return {
        details: 'Error logging system functional'
      };
    } catch (error) {
      throw new Error('Failed to create error log: ' + error.message);
    }
  };

  const tests = [
    {
      id: 'square_connection',
      name: 'Square Connection Active',
      description: 'Validates that Square connection is established and active',
      fn: testSquareConnection,
      category: 'Integration'
    },
    {
      id: 'bootstrap_sync',
      name: 'Bootstrap Sync',
      description: 'Tests locations and staff synchronization from Square',
      fn: testBootstrapSync,
      category: 'Integration'
    },
    {
      id: 'manual_sync',
      name: 'Manual Sync Now',
      description: 'Validates manual sync trigger and job creation',
      fn: testManualSync,
      category: 'Integration'
    },
    {
      id: 'webhook_processing',
      name: 'Webhook Processing',
      description: 'Checks webhook delivery and processing status',
      fn: testWebhookProcessing,
      category: 'Integration'
    },
    {
      id: 'create_employee',
      name: 'Create Employee (CRUD)',
      description: 'Tests employee creation and deletion',
      fn: testCreateEmployee,
      category: 'CRUD'
    },
    {
      id: 'create_location',
      name: 'Create Location (CRUD)',
      description: 'Tests location creation and deletion',
      fn: testCreateLocation,
      category: 'CRUD'
    },
    {
      id: 'sync_job_status',
      name: 'Sync Job Status',
      description: 'Validates sync job tracking and status',
      fn: testSyncJobStatus,
      category: 'Monitoring'
    },
    {
      id: 'error_logging',
      name: 'Error Logging',
      description: 'Tests error logging functionality',
      fn: testErrorLogging,
      category: 'Monitoring'
    }
  ];

  const runAllTests = async () => {
    for (const test of tests) {
      await runTest(test.id, test.fn);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return <Badge variant="outline">Not Run</Badge>;
    if (status === 'pass') return <Badge className="bg-emerald-100 text-emerald-700">Pass</Badge>;
    if (status === 'fail') return <Badge className="bg-rose-100 text-rose-700">Fail</Badge>;
    return <Badge>Unknown</Badge>;
  };

  const categorizedTests = tests.reduce((acc, test) => {
    if (!acc[test.category]) acc[test.category] = [];
    acc[test.category].push(test);
    return acc;
  }, {});

  const totalTests = tests.length;
  const passedTests = Object.values(testResults).filter(r => r.status === 'pass').length;
  const failedTests = Object.values(testResults).filter(r => r.status === 'fail').length;
  const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Smoke Tests</h1>
          <p className="text-slate-500 mt-1">End-to-end validation of critical system flows</p>
        </div>

        {/* Overall Status */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Tests</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalTests}</p>
                </div>
                <PlayCircle className="w-8 h-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-500">Passed</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{passedTests}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-rose-500">Failed</p>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{failedTests}</p>
                </div>
                <XCircle className="w-8 h-8 text-rose-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Success Rate</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{successRate}%</p>
                </div>
                <RefreshCw className="w-8 h-8 text-indigo-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Run All Button */}
        <div className="mb-6">
          <Button
            onClick={runAllTests}
            disabled={runningTests.size > 0}
            className="bg-indigo-600 hover:bg-indigo-700"
            size="lg"
          >
            {runningTests.size > 0 ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5 mr-2" />
                Run All Tests
              </>
            )}
          </Button>
        </div>

        {/* Test Categories */}
        {Object.entries(categorizedTests).map(([category, categoryTests]) => (
          <Card key={category} className="border-0 shadow-sm mb-6">
            <CardHeader>
              <CardTitle>{category} Tests</CardTitle>
              <CardDescription>
                {categoryTests.filter(t => testResults[t.id]?.status === 'pass').length} / {categoryTests.length} passed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryTests.map(test => {
                  const result = testResults[test.id];
                  const isRunning = runningTests.has(test.id);

                  return (
                    <div key={test.id} className="p-4 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          {getStatusIcon(result?.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-slate-900">{test.name}</h4>
                              {getStatusBadge(result?.status)}
                              {result?.warning && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Warning
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">{test.description}</p>
                            
                            {result && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs text-slate-500">
                                  Ran {format(new Date(result.timestamp), 'PPpp')}
                                </p>
                                {result.details && (
                                  <p className="text-sm text-slate-700">
                                    <strong>Details:</strong> {result.details}
                                  </p>
                                )}
                                {result.error && (
                                  <Alert className="border-rose-200 bg-rose-50">
                                    <AlertDescription className="text-rose-900 text-sm">
                                      <strong>Error:</strong> {result.error}
                                    </AlertDescription>
                                  </Alert>
                                )}
                                {(result.syncJobId || result.connectionId) && (
                                  <div className="flex gap-2 text-xs">
                                    {result.syncJobId && (
                                      <Badge variant="outline" className="gap-1">
                                        Sync Job: {result.syncJobId.substring(0, 8)}
                                      </Badge>
                                    )}
                                    {result.connectionId && (
                                      <Badge variant="outline" className="gap-1">
                                        Connection: {result.connectionId.substring(0, 8)}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runTest(test.id, test.fn)}
                          disabled={isRunning}
                        >
                          {isRunning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <PlayCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Quick Links */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>System Logs & Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-3">
              <Button variant="outline" className="justify-start" asChild>
                <a href="/SystemStatus" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  System Status
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/Reconciliation" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Reconciliation
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/ButtonWiringChecklist" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Button Wiring Checklist
                </a>
              </Button>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-slate-50 text-sm text-slate-600">
              <strong>Note:</strong> These tests validate critical system flows. Failed tests indicate issues that need immediate attention.
              Check System Status and recent sync jobs for more details.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}