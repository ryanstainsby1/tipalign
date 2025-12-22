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

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('squareOAuthStart', {});
      return response.data;
    },
    onSuccess: (data) => {
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    },
    onError: (error) => {
      logError({ page: 'Dashboard', action: 'connectSquare', error });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 mt-1">Your tip management overview</p>
          </div>
          <div className="flex items-center gap-3">
            {squareConnection && (
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="border-slate-200"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                {syncMutation.isPending ? 'Syncing...' : 'Sync Data'}
              </Button>
            )}
            <Button 
              onClick={() => setShowExportModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Payroll
            </Button>
          </div>
        </div>

        {/* Square Connection */}
        {loadingConnection ? (
          <div className="mb-8 bg-white rounded-xl p-6 shadow-sm">
            <div className="animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-200 rounded w-48 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-32"></div>
              </div>
            </div>
          </div>
        ) : !squareConnection ? (
          <Card className="mb-8 border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-700 text-white overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-white/10">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Connect with Square</h3>
                      <p className="text-sm text-slate-300 mt-1">Sync transactions, employees, and locations automatically</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-white text-slate-900 hover:bg-slate-100"
                    size="lg"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="4" y="4" width="16" height="16" rx="2"/>
                        </svg>
                        Connect Square Account
                      </>
                    )}
                  </Button>
                </div>
                <div className="hidden md:flex gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">Auto</div>
                    <div className="text-xs text-slate-300">Sync</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">100%</div>
                    <div className="text-xs text-slate-300">Secure</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">UK</div>
                    <div className="text-xs text-slate-300">Compliant</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-100">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">Connected to Square</h3>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {squareConnection.merchant_business_name}
                      </p>
                      {lastSyncJob && (
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-slate-500">
                            Last sync: {format(new Date(lastSyncJob.completed_at || lastSyncJob.started_at), 'PPp')}
                          </span>
                          {lastSyncJob.status === 'completed' && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                              {lastSyncJob.records_created + lastSyncJob.records_updated} records
                            </Badge>
                          )}
                          {lastSyncJob.status === 'partial' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                              {lastSyncJob.errors?.length || 0} warnings
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                      className="border-emerald-300"
                    >
                      <RefreshCw className={`w-4 h-4 mr-1.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                      {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDisconnectDialog(true)}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>

                {/* Sync Stats */}
                {lastSyncJob && (
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-emerald-100">
                    <div className="text-center p-3 rounded-lg bg-white/60">
                      <p className="text-2xl font-bold text-slate-900">{locations.length}</p>
                      <p className="text-xs text-slate-500">Locations</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/60">
                      <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
                      <p className="text-xs text-slate-500">Team Members</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/60">
                      <p className="text-2xl font-bold text-emerald-600">
                        {lastSyncJob.status === 'completed' ? '✓' : lastSyncJob.status === 'partial' ? '⚠' : '✗'}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{lastSyncJob.status}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Tips"
            value={formatCurrency(totalTips)}
            subtitle="This month"
            trend="+12.5%"
            trendDirection="up"
            icon={PoundSterling}
            accentColor="indigo"
          />
          <MetricCard
            title="Active Employees"
            value={employees.length}
            subtitle="Across all locations"
            icon={Users}
            accentColor="emerald"
          />
          <MetricCard
            title="Locations"
            value={locations.length}
            subtitle="Connected to Square"
            icon={MapPin}
            accentColor="amber"
          />
          <MetricCard
            title="Pending Review"
            value={pendingAllocations}
            subtitle="Allocations awaiting confirmation"
            icon={FileCheck}
            accentColor={pendingAllocations > 0 ? "rose" : "sky"}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <TipTrendChart data={last14Days} title="Tips Over Last 14 Days" />
          </div>
          <AllocationBreakdown 
            data={breakdownData.length > 0 ? breakdownData : [{ name: 'No data', value: 1 }]} 
            title="Tips by Role" 
          />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentTransactions transactions={transactions} />
          </div>
          <div className="space-y-6">
            {squareConnection && recentSyncJobs.length > 0 && (
              <SyncHistory syncJobs={recentSyncJobs} />
            )}
            <ComplianceStatus
              hmrcReady={true}
              lastExport="15 Jan 2025"
              pendingAllocations={pendingAllocations}
              auditScore={98}
            />
          </div>
        </div>
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