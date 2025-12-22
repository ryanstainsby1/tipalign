import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Square, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Unlink,
  ShieldCheck,
  Lock,
  Zap,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ConnectSquare() {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading: loadingConnection } = useQuery({
    queryKey: ['squareConnection'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SquareConnection.filter({
        organization_id: user.organization_id || user.id
      });
    },
  });

  const connection = connections[0];
  const isConnected = connection && connection.connection_status === 'connected';

  const handleConnect = () => {
    const SQUARE_APP_ID = 'YOUR_SQUARE_APP_ID'; // Set via environment
    const SQUARE_ENVIRONMENT = 'sandbox'; // Change to 'production' for live
    const redirectUri = `${window.location.origin}/api/square-callback`;
    
    const authUrl = SQUARE_ENVIRONMENT === 'production'
      ? `https://connect.squareup.com/oauth2/authorize`
      : `https://connect.squareupsandbox.com/oauth2/authorize`;

    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: 'PAYMENTS_READ TIMECARDS_READ TEAM_READ EMPLOYEES_READ MERCHANT_PROFILE_READ',
      session: 'false',
      state: Math.random().toString(36).substring(7)
    });

    window.location.href = `${authUrl}?${params.toString()}`;
  };

  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const response = await base44.functions.invoke('squareSync', {
        connection_id: connection.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squareConnection'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setIsSyncing(false);
    },
    onError: () => {
      setIsSyncing(false);
    }
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
      setShowDisconnectDialog(false);
    }
  });

  if (loadingConnection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading connection status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 mb-4 shadow-xl">
            <Square className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Connect with Square</h1>
          <p className="text-lg text-slate-600">
            {isConnected 
              ? 'Your Square account is connected and syncing'
              : 'Link your Square account to start managing tips'}
          </p>
        </div>

        {isConnected ? (
          <div className="space-y-6">
            {/* Connection Status Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-100">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">Connected to Square</h3>
                      <p className="text-slate-600 mt-1">{connection.merchant_business_name}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    Active
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-white/80">
                    <p className="text-sm text-slate-500 mb-1">Merchant ID</p>
                    <p className="font-mono text-sm text-slate-900">{connection.square_merchant_id}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/80">
                    <p className="text-sm text-slate-500 mb-1">Last Synced</p>
                    <p className="text-sm text-slate-900">
                      {connection.last_sync_at 
                        ? format(new Date(connection.last_sync_at), 'PPp')
                        : 'Never'}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/80">
                    <p className="text-sm text-slate-500 mb-1">Connected Since</p>
                    <p className="text-sm text-slate-900">
                      {format(new Date(connection.created_date), 'PP')}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/80">
                    <p className="text-sm text-slate-500 mb-1">Token Expires</p>
                    <p className="text-sm text-slate-900">
                      {connection.token_expires_at 
                        ? format(new Date(connection.token_expires_at), 'PP')
                        : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => syncMutation.mutate()}
                    disabled={isSyncing}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    onClick={() => setShowDisconnectDialog(true)}
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate(createPageUrl('Locations'))}
                    className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-900">Configure Locations</p>
                      <p className="text-sm text-slate-500">Set up tip allocation rules for each venue</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => navigate(createPageUrl('Employees'))}
                    className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-900">Review Team Members</p>
                      <p className="text-sm text-slate-500">Assign roles and weights for tip distribution</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => navigate(createPageUrl('Dashboard'))}
                    className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-900">View Dashboard</p>
                      <p className="text-sm text-slate-500">Start monitoring tip allocations</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Main Connect Card */}
            <Card className="border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                    Ready to connect your Square account?
                  </h2>
                  <p className="text-slate-600">
                    TipFlow integrates securely with Square to automatically sync transactions,
                    locations, and team members for seamless tip management.
                  </p>
                </div>

                <Button
                  onClick={handleConnect}
                  className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-lg font-medium"
                  size="lg"
                >
                  <Square className="w-5 h-5 mr-3" />
                  Connect with Square
                </Button>

                <p className="text-xs text-center text-slate-500 mt-4">
                  By connecting, you authorize TipFlow to access your Square data
                </p>
              </CardContent>
            </Card>

            {/* Benefits Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="p-3 rounded-xl bg-indigo-50 w-fit mb-4">
                    <Lock className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">Secure OAuth</h3>
                  <p className="text-sm text-slate-600">
                    Industry-standard OAuth 2.0 ensures your Square credentials stay private
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="p-3 rounded-xl bg-emerald-50 w-fit mb-4">
                    <RefreshCw className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">Auto-Sync</h3>
                  <p className="text-sm text-slate-600">
                    Transactions, locations, and staff sync automatically in real-time
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="p-3 rounded-xl bg-amber-50 w-fit mb-4">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">HMRC Ready</h3>
                  <p className="text-sm text-slate-600">
                    All data synced with full audit trails for UK compliance
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* What We Access */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">What TipFlow accesses from Square</CardTitle>
                <CardDescription>Read-only access to the following data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { label: 'Payment transactions with tip amounts', icon: CheckCircle },
                    { label: 'Location and venue information', icon: CheckCircle },
                    { label: 'Team member roster and roles', icon: CheckCircle },
                    { label: 'Shift and timecard data', icon: CheckCircle },
                    { label: 'Terminal and device information', icon: CheckCircle },
                    { label: 'Business profile details', icon: CheckCircle }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <item.icon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {item.label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Error State */}
            {connection && connection.connection_status === 'error' && (
              <Alert className="border-rose-200 bg-rose-50">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <AlertDescription className="text-rose-900">
                  <strong>Connection Error:</strong> {connection.last_error || 'Unable to connect to Square'}
                  <Button
                    onClick={handleConnect}
                    variant="link"
                    className="text-rose-600 p-0 h-auto ml-2"
                  >
                    Try reconnecting
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Square Account?</DialogTitle>
            <DialogDescription>
              This will revoke TipFlow's access to your Square account and stop syncing new data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <strong>Historical data will be preserved.</strong> All existing tip allocations, 
                exports, and audit logs will remain accessible for compliance purposes.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisconnectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect Square'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}