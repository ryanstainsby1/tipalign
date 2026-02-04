import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, AlertCircle, Copy, RefreshCw, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SquareSettings() {
  const queryClient = useQueryClient();

  const { data: currentOrg } = useQuery({
    queryKey: ['currentOrganization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCurrentOrganization', {});
      return response.data.success ? response.data.organization : null;
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['squareConnection', currentOrg?.id],
    queryFn: () => base44.entities.SquareConnection.filter({
      organization_id: currentOrg?.id
    }),
    enabled: !!currentOrg?.id,
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['syncLogs', currentOrg?.id],
    queryFn: () => base44.entities.SyncLogs.filter(
      { organization_id: currentOrg?.id },
      '-timestamp',
      10
    ),
    enabled: !!currentOrg?.id,
  });

  const connection = connections.find(c => c.connection_status === 'connected');
  const webhookUrl = `${window.location.origin}/functions/squareWebhook`;

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('squareOAuthStart', {});
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success && data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('squareDisconnect', {
        connection_id: connection.id,
        preserve_data: true
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squareConnection'] });
      toast.success('Square disconnected successfully');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('syncSquareData', {
        connection_id: connection.id,
        entity_types: ['payments', 'team_members', 'timecards', 'locations']
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['syncLogs'] });
      toast.success(`Synced ${data.records_synced} records`);
    },
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const scopes = [
    { name: 'PAYMENTS_READ', description: 'Read payment transactions and tips' },
    { name: 'EMPLOYEES_READ', description: 'Access team member information' },
    { name: 'TIMECARDS_READ', description: 'Read shift and timecard data' },
    { name: 'ORDERS_READ', description: 'Access order details' },
    { name: 'MERCHANT_PROFILE_READ', description: 'Read business location info' }
  ];

  const webhookEvents = [
    'payment.completed',
    'labor.timecard.created',
    'labor.timecard.updated',
    'team_member.created',
    'team_member.updated'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Square Settings</h1>

        {/* Connection Status */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            {connection ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                  <div>
                    <Badge className="bg-emerald-500 mb-2">Connected</Badge>
                    <p className="text-sm text-slate-600">
                      {connection.merchant_business_name}
                    </p>
                    {connection.last_sync_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        Last sync: {format(new Date(connection.last_sync_at), 'PPp')}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="text-rose-600 border-rose-300 hover:bg-rose-50"
                >
                  Disconnect Square
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                  <div>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 mb-2">
                      Not Connected
                    </Badge>
                    <p className="text-sm text-slate-600">
                      Connect your Square account to sync sales and tips
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Connect with Square
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Webhook URL</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm">
                  {webhookUrl}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Add this URL to your Square Developer Dashboard webhook settings
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Subscribed Events</p>
              <div className="flex flex-wrap gap-2">
                {webhookEvents.map(event => (
                  <Badge key={event} variant="outline" className="bg-blue-50 text-blue-700">
                    {event}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Required Scopes */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle>Required OAuth Scopes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scopes.map(scope => (
                <div key={scope.name} className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">{scope.name}</Badge>
                  <p className="text-sm text-slate-600">{scope.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Manual Sync */}
        {connection && (
          <Card className="border-0 shadow-lg mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Manual Sync</CardTitle>
                <Button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  variant="outline"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  Full Sync
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="capitalize">{log.sync_type}</TableCell>
                      <TableCell>
                        <Badge className={
                          log.status === 'success' ? 'bg-emerald-500' :
                          log.status === 'error' ? 'bg-rose-500' :
                          'bg-amber-500'
                        }>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.records_synced}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(log.timestamp), 'PPp')}
                      </TableCell>
                      <TableCell className="text-sm text-rose-600">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}