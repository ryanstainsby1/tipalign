import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw,
  Database,
  Webhook,
  Activity,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function SystemStatus() {
  const { data: connections = [] } = useQuery({
    queryKey: ['squareConnections'],
    queryFn: () => base44.entities.SquareConnection.list(),
  });

  const { data: syncJobs = [] } = useQuery({
    queryKey: ['recentSyncJobs'],
    queryFn: () => base44.entities.SyncJob.list('-started_at', 20),
  });

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['recentWebhooks'],
    queryFn: () => base44.entities.WebhookLog.list('-received_at', 50),
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['recentAuditEvents'],
    queryFn: () => base44.entities.SystemAuditEvent.filter({ severity: 'warning' }),
  });

  // Calculate system health metrics
  const activeConnection = connections.find(c => c.connection_status === 'connected');
  const lastSync = syncJobs[0];
  const last24hWebhooks = webhookLogs.filter(w => {
    const receivedAt = new Date(w.received_at);
    const now = new Date();
    return (now - receivedAt) < (24 * 60 * 60 * 1000);
  });

  const webhookSuccessRate = last24hWebhooks.length > 0
    ? (last24hWebhooks.filter(w => w.processed).length / last24hWebhooks.length) * 100
    : 100;

  const recentErrors = syncJobs.filter(j => j.status === 'failed').slice(0, 5);
  const failedWebhooks = webhookLogs.filter(w => !w.processed && w.processing_error).slice(0, 10);

  const systemHealthy = activeConnection && 
                        webhookSuccessRate > 95 && 
                        recentErrors.length < 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Status</h1>
          <p className="text-slate-500 mt-1">Monitor Square integration health and performance</p>
        </div>

        {/* Overall Health */}
        <Alert className={`mb-6 ${systemHealthy ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {systemHealthy ? (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          )}
          <AlertDescription className={systemHealthy ? 'text-emerald-900' : 'text-amber-900'}>
            <strong>System Status: {systemHealthy ? 'Healthy' : 'Needs Attention'}</strong>
            {!systemHealthy && ' - Check details below for issues requiring attention.'}
          </AlertDescription>
        </Alert>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Connection</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {activeConnection ? 'Active' : 'Inactive'}
                  </p>
                </div>
                {activeConnection ? (
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-rose-500" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Last Sync</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {lastSync ? formatDistanceToNow(new Date(lastSync.started_at), { addSuffix: true }) : 'Never'}
                  </p>
                </div>
                <RefreshCw className="w-8 h-8 text-indigo-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Webhook Success</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{webhookSuccessRate.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500 mt-1">Last 24h</p>
                </div>
                <Webhook className={`w-8 h-8 ${webhookSuccessRate > 95 ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Error Rate</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{recentErrors.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Recent failures</p>
                </div>
                <Activity className={`w-8 h-8 ${recentErrors.length < 3 ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connection Details */}
        {activeConnection && (
          <Card className="border-0 shadow-sm mb-6">
            <CardHeader>
              <CardTitle>Square Connection Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Merchant ID</p>
                  <p className="font-medium text-slate-900">{activeConnection.square_merchant_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Business Name</p>
                  <p className="font-medium text-slate-900">{activeConnection.merchant_business_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last Sync</p>
                  <p className="font-medium text-slate-900">
                    {activeConnection.last_sync_at 
                      ? format(new Date(activeConnection.last_sync_at), 'PPpp')
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Token Expires</p>
                  <p className="font-medium text-slate-900">
                    {activeConnection.token_expires_at 
                      ? format(new Date(activeConnection.token_expires_at), 'PPpp')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Sync Jobs */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle>Recent Sync Jobs</CardTitle>
            <CardDescription>Last 20 synchronization attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entities</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncJobs.map(job => {
                  const duration = job.completed_at 
                    ? Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000)
                    : null;
                  
                  return (
                    <TableRow key={job.id}>
                      <TableCell>{format(new Date(job.started_at), 'PPp')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{job.sync_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{job.entities_synced?.join(', ')}</TableCell>
                      <TableCell className="text-right">{job.records_created}</TableCell>
                      <TableCell className="text-right">{job.records_updated}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                            job.status === 'failed' ? 'bg-rose-50 text-rose-700' :
                            job.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{duration ? `${duration}s` : '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Webhook Health */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle>Webhook Health (Last 24h)</CardTitle>
            <CardDescription>Recent webhook deliveries from Square</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-slate-50">
                <p className="text-sm text-slate-500">Total Received</p>
                <p className="text-2xl font-bold text-slate-900">{last24hWebhooks.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50">
                <p className="text-sm text-emerald-700">Processed</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {last24hWebhooks.filter(w => w.processed).length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-rose-50">
                <p className="text-sm text-rose-700">Failed</p>
                <p className="text-2xl font-bold text-rose-900">
                  {last24hWebhooks.filter(w => !w.processed && w.processing_error).length}
                </p>
              </div>
            </div>

            {failedWebhooks.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Recent Failures</h4>
                <div className="space-y-2">
                  {failedWebhooks.map(webhook => (
                    <div key={webhook.id} className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="bg-rose-100 text-rose-700">{webhook.event_type}</Badge>
                          <p className="text-xs text-rose-900 mt-1">{webhook.processing_error}</p>
                        </div>
                        <p className="text-xs text-rose-700">{formatDistanceToNow(new Date(webhook.received_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Log */}
        {recentErrors.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Recent Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentErrors.map(job => (
                  <div key={job.id} className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="outline" className="bg-amber-100 text-amber-700">
                        {job.sync_type} - {job.entities_synced?.join(', ')}
                      </Badge>
                      <p className="text-xs text-amber-700">
                        {format(new Date(job.started_at), 'PPp')}
                      </p>
                    </div>
                    {job.errors && job.errors.length > 0 && (
                      <div className="text-xs text-amber-900 space-y-1">
                        {job.errors.slice(0, 3).map((err, idx) => (
                          <p key={idx}>• {err.error_message}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}