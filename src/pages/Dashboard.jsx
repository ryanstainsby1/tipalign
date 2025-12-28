import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PoundSterling, Users, MapPin, FileCheck, Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { logError } from '@/components/common/ErrorLogger';

import MetricCard from '@/components/dashboard/MetricCard';
import TipTrendChart from '@/components/dashboard/TipTrendChart';
import AllocationBreakdown from '@/components/dashboard/AllocationBreakdown';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import ComplianceStatus from '@/components/dashboard/ComplianceStatus';
import PayrollExportModal from '@/components/exports/PayrollExportModal';
import SyncHistory from '@/components/dashboard/SyncHistory';
import AchievementBadge from '@/components/dashboard/AchievementBadge';
import ProgressRing from '@/components/dashboard/ProgressRing';
import LiveMetric from '@/components/dashboard/LiveMetric';

export default function Dashboard() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const queryClient = useQueryClient();

  // Check URL params for Square connection status
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('square_connected') === '1') {
      const merchantName = urlParams.get('merchant');
      const syncStatus = urlParams.get('sync_status');
      const locationsSynced = urlParams.get('locations_synced') || 0;
      const staffSynced = urlParams.get('staff_synced') || 0;
      
      queryClient.invalidateQueries({ queryKey: ['squareConnection'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      
      if (syncStatus === 'success') {
        toast.success(
          `Connected to Square: ${merchantName}! Synced ${locationsSynced} locations and ${staffSynced} team members.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Connected to Square: ${merchantName}!`, { duration: 4000 });
        if (syncStatus === 'partial') {
          toast.warning('Initial sync completed with some warnings. Check System Status for details.', { duration: 4000 });
        }
      }
      
      window.history.replaceState({}, '', '/Dashboard');
    } else if (urlParams.get('square_error')) {
      const error = urlParams.get('square_error');
      toast.error(`Square connection failed: ${error.replace(/_/g, ' ')}`);
      window.history.replaceState({}, '', '/Dashboard');
    }
  }, [queryClient]);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-transaction_date', 100),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ employment_status: 'active' }),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.filter({ active: true }),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['allocations'],
    queryFn: () => base44.entities.TipAllocation.list('-allocation_date', 500),
  });

  const { data: squareConnections = [], isLoading: loadingConnection } = useQuery({
    queryKey: ['squareConnection'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SquareConnection.filter({
        organization_id: user.organization_id || user.id
      });
    },
  });

  const squareConnection = squareConnections.find(c => c.connection_status === 'connected');

  const { data: lastSyncJob } = useQuery({
    queryKey: ['lastSyncJob', squareConnection?.id],
    queryFn: async () => {
      if (!squareConnection) return null;
      const jobs = await base44.entities.SyncJob.filter(
        { square_connection_id: squareConnection.id },
        '-started_at',
        1
      );
      return jobs[0] || null;
    },
    enabled: !!squareConnection,
  });

  const { data: recentSyncJobs = [] } = useQuery({
    queryKey: ['recentSyncJobs', squareConnection?.id],
    queryFn: async () => {
      if (!squareConnection) return [];
      return await base44.entities.SyncJob.filter(
        { square_connection_id: squareConnection.id },
        '-started_at',
        5
      );
    },
    enabled: !!squareConnection,
    refetchInterval: (data) => {
      // Refetch every 3 seconds if there's a running job
      const hasRunningJob = Array.isArray(data) && data.some(job => job.status === 'running');
      return hasRunningJob ? 3000 : false;
    }
  });

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['recentWebhooks', squareConnection?.id],
    queryFn: async () => {
      if (!squareConnection) return [];
      return await base44.entities.WebhookLog.filter(
        { square_connection_id: squareConnection.id },
        '-received_at',
        10
      );
    },
    enabled: !!squareConnection,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      // Check if user is authenticated
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        base44.auth.redirectToLogin(window.location.pathname);
        throw new Error('Please log in to connect Square');
      }
      
      const response = await base44.functions.invoke('squareOAuthStart', {});
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success && data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast.error('No redirect URL received from Square');
      }
    },
    onError: (error) => {
      if (!error.message.includes('log in')) {
        logError({ page: 'Dashboard', action: 'connectSquare', error });
      }
      toast.error('Connection failed: ' + error.message);
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!squareConnection) {
        throw new Error('No Square connection found');
      }
      const response = await base44.functions.invoke('squareSync', {
        connection_id: squareConnection.id,
        triggered_by: 'manual'
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['squareConnection'] });
      queryClient.invalidateQueries({ queryKey: ['lastSyncJob'] });
      queryClient.invalidateQueries({ queryKey: ['recentSyncJobs'] });
      
      const summary = [];
      if (data.entity_counts) {
        const { locations, team_members, shifts, payments } = data.entity_counts;
        if (locations.created + locations.updated > 0) summary.push(`${locations.created + locations.updated} locations`);
        if (team_members.created + team_members.updated > 0) summary.push(`${team_members.created + team_members.updated} staff`);
        if (shifts.created + shifts.updated > 0) summary.push(`${shifts.created + shifts.updated} shifts`);
        if (payments.created + payments.updated > 0) summary.push(`${payments.created + payments.updated} payments`);
      }
      
      toast.success(
        `Sync complete! ${summary.length > 0 ? summary.join(', ') : 'All data up to date'}`,
        { duration: 5000 }
      );
    },
    onError: (error) => {
      logError({ page: 'Dashboard', action: 'syncData', error });
      if (error.message.includes('already in progress')) {
        toast.error('A sync is already running. Please wait for it to finish.');
      } else {
        toast.error('Sync failed: ' + error.message);
      }
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!squareConnection) throw new Error('No connection');
      const response = await base44.functions.invoke('squareDisconnect', {
        connection_id: squareConnection.id,
        preserve_data: true
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['squareConnection'] });
      setShowDisconnectDialog(false);
      toast.success('Square disconnected successfully');
    },
    onError: (error) => {
      logError({ page: 'Dashboard', action: 'disconnectSquare', error });
      toast.error('Disconnect failed: ' + error.message);
    }
  });

  const exportMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('generatePayrollExport', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Payroll export generated successfully');
      if (data.file_url) {
        window.open(data.file_url, '_blank');
      }
    },
    onError: (error) => {
      logError({ page: 'Dashboard', action: 'exportPayroll', error });
      toast.error('Export failed: ' + error.message);
    }
  });

  const totalTips = transactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
  const pendingAllocations = allocations.filter(a => a.status === 'pending').length;
  
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTips = transactions
      .filter(tx => format(new Date(tx.transaction_date), 'yyyy-MM-dd') === dateStr)
      .reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
    return { date: format(date, 'dd MMM'), amount: dayTips };
  });

  const roleBreakdown = allocations.reduce((acc, alloc) => {
    const employee = employees.find(e => e.id === alloc.employee_id);
    const role = employee?.role || 'other';
    acc[role] = (acc[role] || 0) + (alloc.gross_amount || 0);
    return acc;
  }, {});
  
  const breakdownData = Object.entries(roleBreakdown).map(([name, value]) => ({ name, value }));

  const formatCurrency = (value) => {
    return `£${(value / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Calculate setup progress
  const setupSteps = [
    { complete: !!squareConnection, weight: 30 },
    { complete: locations.length > 0, weight: 25 },
    { complete: employees.length > 0, weight: 25 },
    { complete: transactions.length > 0, weight: 20 }
  ];
  const setupProgress = setupSteps.reduce((acc, step) => acc + (step.complete ? step.weight : 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">Dashboard</h1>
              <p className="text-slate-600">Your tip management command center</p>
            </div>
            <div className="flex items-center gap-3">
              {squareConnection && (
                <Button
                  variant="outline"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="border-slate-300 hover:border-slate-400 shadow-sm"
                  size="lg"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMutation.isPending ? 'Syncing...' : 'Sync Data'}
                </Button>
              )}
              <Button 
                onClick={() => setShowExportModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 shadow-lg"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Payroll
              </Button>
            </div>
          </div>
          
          {/* Achievements */}
          {setupProgress < 100 && (
            <div className="flex items-center justify-center gap-8 p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
              <ProgressRing progress={setupProgress} size={90} strokeWidth={7} />
              <div className="flex items-center gap-4">
                <AchievementBadge type="first_sync" unlocked={!!squareConnection} />
                <AchievementBadge type="team_ready" unlocked={employees.length >= 3} />
                <AchievementBadge type="allocation_master" unlocked={allocations.length >= 10} />
                <AchievementBadge type="compliance_pro" unlocked={transactions.length >= 20} />
              </div>
            </div>
          )}
        </div>

        {/* Connection Status Alert */}
        {React.useEffect(() => {
          const urlParams = new URLSearchParams(window.location.search);
          const error = urlParams.get('error');
          const errorDescription = urlParams.get('error_description');

          if (error) {
            toast.error(`Connection failed: ${errorDescription || error.replace(/_/g, ' ')}`);
            window.history.replaceState({}, '', '/Dashboard');
          }
        }, [])}

        {/* Square Connection */}
        {loadingConnection ? (
          <div className="mb-10 bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
            <div className="animate-pulse flex items-center gap-6">
              <div className="w-16 h-16 bg-slate-200 rounded-2xl"></div>
              <div className="flex-1">
                <div className="h-5 bg-slate-200 rounded w-56 mb-3"></div>
                <div className="h-4 bg-slate-200 rounded w-40"></div>
              </div>
            </div>
          </div>
        ) : !squareConnection ? (
          <Card className="mb-10 border-0 shadow-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
            <CardContent className="p-10">
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-6 flex-1">
                  <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Connect with Square</h3>
                    <p className="text-slate-300">Sync transactions, employees, and locations automatically</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="hidden lg:flex gap-8">
                    <div className="text-center px-4">
                      <div className="text-3xl font-bold mb-1">Auto</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Sync</div>
                    </div>
                    <div className="text-center px-4">
                      <div className="text-3xl font-bold mb-1">100%</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Secure</div>
                    </div>
                    <div className="text-center px-4">
                      <div className="text-3xl font-bold mb-1">UK</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">Compliant</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-white text-slate-900 hover:bg-slate-50 shadow-xl"
                    size="lg"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="4" y="4" width="16" height="16" rx="2"/>
                        </svg>
                        Connect Square
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-10 border-0 shadow-lg bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-5">
                  <div className="p-4 rounded-2xl bg-emerald-100 shadow-sm">
                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-slate-900">Connected to Square</h3>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 px-3 py-1">Active</Badge>
                    </div>
                    <p className="text-slate-700 font-medium">
                      {squareConnection.merchant_business_name}
                    </p>
                    {lastSyncJob && (
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-slate-500">
                          Last sync: {format(new Date(lastSyncJob.completed_at || lastSyncJob.started_at), 'PPp')}
                        </span>
                        {lastSyncJob.status === 'completed' && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                            {lastSyncJob.records_created + lastSyncJob.records_updated} records
                          </Badge>
                        )}
                        {lastSyncJob.status === 'partial' && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                            {lastSyncJob.errors?.length || 0} warnings
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="border-slate-300 hover:border-slate-400 shadow-sm"
                    size="lg"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDisconnectDialog(true)}
                    className="text-rose-600 border-rose-300 hover:bg-rose-50 shadow-sm"
                    size="lg"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Sync Stats */}
              {lastSyncJob && (
                <div className="grid grid-cols-4 gap-4 pt-6 border-t border-slate-200">
                  <div className="text-center p-4 rounded-xl bg-white shadow-sm">
                    <p className="text-3xl font-bold text-slate-900 mb-1">{locations.length}</p>
                    <p className="text-sm text-slate-500 font-medium">Locations</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white shadow-sm">
                    <p className="text-3xl font-bold text-slate-900 mb-1">{employees.length}</p>
                    <p className="text-sm text-slate-500 font-medium">Team Members</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white shadow-sm">
                    <p className="text-3xl font-bold text-indigo-600 mb-1">{webhookLogs.length}</p>
                    <p className="text-sm text-slate-500 font-medium">Webhooks 24h</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white shadow-sm">
                    <p className="text-3xl font-bold text-emerald-600 mb-1">
                      {lastSyncJob.status === 'completed' ? '✓' : lastSyncJob.status === 'partial' ? '⚠' : '✗'}
                    </p>
                    <p className="text-sm text-slate-500 font-medium capitalize">{lastSyncJob.status}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State - No Data */}
        {!squareConnection && transactions.length === 0 && employees.length === 0 && (
          <Card className="mb-10 border-0 shadow-lg">
            <CardContent className="py-20 text-center">
              <div className="max-w-lg mx-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">Connect Square to Get Started</h3>
                <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                  Link your Square account to automatically import locations, staff, and transactions.
                </p>
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 shadow-lg"
                  size="lg"
                >
                  {connectMutation.isPending ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                      </svg>
                      Connect with Square
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <LiveMetric
            title="Total Tips This Month"
            value={formatCurrency(totalTips)}
            change="+12.5%"
            isPositive={true}
            icon={PoundSterling}
            color="indigo"
          />
          <LiveMetric
            title="Active Team Members"
            value={employees.length}
            change={employees.length > 0 ? `+${Math.min(3, employees.length)}` : null}
            isPositive={true}
            icon={Users}
            color="emerald"
          />
          <LiveMetric
            title="Connected Locations"
            value={locations.length}
            icon={MapPin}
            color="amber"
          />
          <LiveMetric
            title="Pending Allocations"
            value={pendingAllocations}
            change={pendingAllocations > 0 ? `${pendingAllocations} waiting` : 'All clear'}
            isPositive={pendingAllocations === 0}
            icon={FileCheck}
            color={pendingAllocations > 0 ? "rose" : "sky"}
          />
        </div>

        {/* Charts Row */}
        {(transactions.length > 0 || allocations.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <TipTrendChart data={last14Days} title="Tips Over Last 14 Days" />
            </div>
            <AllocationBreakdown 
              data={breakdownData.length > 0 ? breakdownData : [{ name: 'No data', value: 1 }]} 
              title="Tips by Role" 
            />
          </div>
        )}

        {/* Bottom Row */}
        {(transactions.length > 0 || squareConnection) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RecentTransactions transactions={transactions} />
            </div>
            <div className="space-y-6">
              {squareConnection && recentSyncJobs.length > 0 && (
                <SyncHistory syncJobs={recentSyncJobs} />
              )}
              <ComplianceStatus
                hmrcReady={transactions.length > 0}
                lastExport={transactions.length > 0 ? "Not yet exported" : "No data"}
                pendingAllocations={pendingAllocations}
                auditScore={transactions.length > 0 ? 98 : 0}
              />
            </div>
          </div>
        )}
      </div>

      <PayrollExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        locations={locations}
        onExport={(data) => {
          exportMutation.mutate(data);
          setShowExportModal(false);
        }}
      />

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Square Account?</DialogTitle>
            <DialogDescription>
              This will permanently revoke TipFlow's access to your Square account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-900">
                <strong>What will happen:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Square access tokens will be revoked</li>
                  <li>• Automatic syncing will stop</li>
                  <li>• Webhooks will no longer be processed</li>
                  <li>• You won't receive new transactions from Square</li>
                </ul>
              </AlertDescription>
            </Alert>
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-900">
                <strong>Historical data is safe:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• All existing payments and transactions preserved</li>
                  <li>• Employee records and tip allocations remain intact</li>
                  <li>• Payroll exports and compliance reports still accessible</li>
                  <li>• Full audit trail maintained for HMRC (6+ years)</li>
                </ul>
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
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Yes, Disconnect Square'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}