import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { PoundSterling, Users, MapPin, FileCheck, Download, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, subDays, startOfMonth } from 'date-fns';

import MetricCard from '@/components/dashboard/MetricCard';
import TipTrendChart from '@/components/dashboard/TipTrendChart';
import AllocationBreakdown from '@/components/dashboard/AllocationBreakdown';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import ComplianceStatus from '@/components/dashboard/ComplianceStatus';
import SquareConnectButton from '@/components/common/SquareConnectButton';
import PayrollExportModal from '@/components/exports/PayrollExportModal';

export default function Dashboard() {
  const [isSquareConnected, setIsSquareConnected] = useState(true); // Demo mode
  const [showExportModal, setShowExportModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-transaction_date', 100),
  });

  const { data: employees = [], isLoading: loadingEmp } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ employment_status: 'active' }),
  });

  const { data: locations = [], isLoading: loadingLoc } = useQuery({
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

  // Calculate metrics
  const totalTips = transactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
  const pendingAllocations = allocations.filter(a => a.status === 'pending').length;
  
  // Trend data for chart
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTips = transactions
      .filter(tx => format(new Date(tx.transaction_date), 'yyyy-MM-dd') === dateStr)
      .reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
    return { date: format(date, 'dd MMM'), amount: dayTips };
  });

  // Allocation breakdown by role
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

  const handleSync = async () => {
    setIsSyncing(true);
    // Simulate sync - in production this would call Square API
    await new Promise(r => setTimeout(r, 2000));
    setIsSyncing(false);
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
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={isSyncing}
              className="border-slate-200"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Data'}
            </Button>
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
        <div className="mb-8">
          <SquareConnectButton
            isConnected={isSquareConnected}
            merchantName="Demo Restaurant Group"
            lastSync="2 minutes ago"
            onConnect={() => setIsSquareConnected(true)}
            onSync={handleSync}
            isSyncing={isSyncing}
          />
        </div>

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
          <ComplianceStatus
            hmrcReady={true}
            lastExport="15 Jan 2025"
            pendingAllocations={pendingAllocations}
            auditScore={98}
          />
        </div>
      </div>

      <PayrollExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        locations={locations}
        onExport={(data) => {
          console.log('Export:', data);
          setShowExportModal(false);
        }}
      />
    </div>
  );
}