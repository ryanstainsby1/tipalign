import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PoundSterling, Users, Trophy, RefreshCw, Zap, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function EmployerDashboard() {
  const [viewMode, setViewMode] = useState('daily');
  const [sortBy, setSortBy] = useState('sales');
  const [sortDesc, setSortDesc] = useState(true);
  const queryClient = useQueryClient();

  const { data: currentOrg } = useQuery({
    queryKey: ['currentOrganization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCurrentOrganization', {});
      return response.data.success ? response.data.organization : null;
    },
  });

  const organizationId = currentOrg?.id;

  // Real-time transactions
  const [liveTransactions, setLiveTransactions] = useState([]);

  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['transactions', organizationId],
    queryFn: () => base44.entities.Transaction.filter({ organization_id: organizationId }),
    enabled: !!organizationId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', organizationId],
    queryFn: () => base44.entities.Employee.filter({ 
      organization_id: organizationId,
      is_active: true 
    }),
    enabled: !!organizationId,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', organizationId],
    queryFn: () => base44.entities.Shift.filter({ organization_id: organizationId }),
    enabled: !!organizationId,
  });

  const { data: bonusAllocations = [] } = useQuery({
    queryKey: ['bonusAllocations', organizationId],
    queryFn: () => base44.entities.BonusAllocations.filter({ organization_id: organizationId }),
    enabled: !!organizationId,
  });

  const { data: lastSync } = useQuery({
    queryKey: ['lastSync', organizationId],
    queryFn: async () => {
      const logs = await base44.entities.SyncLogs.filter(
        { organization_id: organizationId },
        '-timestamp',
        1
      );
      return logs[0] || null;
    },
    enabled: !!organizationId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!organizationId) return;

    const unsubscribe = base44.entities.Transaction.subscribe((event) => {
      if (event.type === 'create' && event.data.organization_id === organizationId) {
        setLiveTransactions(prev => [{
          ...event.data,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 5));
        
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        
        const amount = (event.data.amount || event.data.total_amount || 0) / 100;
        toast.success(`New sale: £${amount.toFixed(2)}`, {
          duration: 3000,
          className: 'bg-emerald-500 text-white'
        });
      }
    });

    return () => unsubscribe();
  }, [organizationId, queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const connections = await base44.entities.SquareConnection.filter({
        organization_id: organizationId,
        connection_status: 'connected'
      });
      if (connections.length === 0) throw new Error('No Square connection');
      
      const response = await base44.functions.invoke('syncSquareData', {
        connection_id: connections[0].id,
        entity_types: ['payments', 'team_members', 'timecards', 'locations']
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries();
      toast.success(`Synced ${data.records_synced} records successfully`);
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });

  const calculateBonusesMutation = useMutation({
    mutationFn: () => base44.functions.invoke('calculateBonuses', {
      organization_id: organizationId,
      period: 'daily'
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bonusAllocations'] });
      const count = data.data.bonuses_calculated || 0;
      toast.success(`${count} bonuses calculated`);
    },
    onError: (error) => {
      toast.error(`Bonus calculation failed: ${error.message}`);
    }
  });

  // Calculate today's metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.transaction_date || tx.timestamp);
    return txDate >= today && txDate < tomorrow;
  });

  const totalSalesToday = todayTransactions.reduce((sum, tx) => 
    sum + (tx.amount || tx.total_amount || 0), 0);
  const totalTipsToday = todayTransactions.reduce((sum, tx) => 
    sum + (tx.tip_amount || 0), 0);

  const activeEmployeeIds = new Set();
  const now = new Date();
  shifts.forEach(shift => {
    if (shift.status === 'open') {
      const startTime = new Date(shift.start_at);
      if (startTime <= now && (!shift.end_at || new Date(shift.end_at) > now)) {
        activeEmployeeIds.add(shift.employee_id);
      }
    }
  });

  const pendingBonusTotal = bonusAllocations
    .filter(b => b.status === 'pending')
    .reduce((sum, b) => sum + (b.bonus_amount || 0), 0);

  // Hourly sales data
  const hourlySales = Array(24).fill(0);
  todayTransactions.forEach(tx => {
    const hour = new Date(tx.transaction_date || tx.timestamp).getHours();
    hourlySales[hour] += (tx.amount || tx.total_amount || 0) / 100;
  });

  const chartData = hourlySales.map((sales, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    sales: sales
  })).filter(d => d.sales > 0 || (hour >= 6 && hour <= 23));

  // Employee leaderboard
  const leaderboard = employees.map(emp => {
    const empTransactions = todayTransactions.filter(tx => tx.employee_id === emp.id);
    const sales = empTransactions.reduce((sum, tx) => sum + (tx.amount || tx.total_amount || 0), 0);
    const tips = empTransactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);
    const empBonuses = bonusAllocations.filter(b => b.employee_id === emp.id);
    const bonuses = empBonuses.reduce((sum, b) => sum + (b.bonus_amount || 0), 0);
    const hasAchievedBonus = empBonuses.some(b => b.status === 'approved' || b.status === 'paid');

    return {
      id: emp.id,
      name: emp.full_name,
      sales,
      tips,
      bonuses,
      hasAchievedBonus
    };
  }).sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return sortDesc ? bVal - aVal : aVal - bVal;
  }).slice(0, 20);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const formatMoney = (pence) => `£${(pence / 100).toFixed(2)}`;

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center">
        <p className="text-lg text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
              Business Dashboard
            </h1>
            <p className="text-slate-600 text-lg">Real-time sales, tips, and performance</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
            <Button
              onClick={() => calculateBonusesMutation.mutate()}
              disabled={calculateBonusesMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Zap className="w-4 h-4 mr-2" />
              Calculate Bonuses
            </Button>
          </div>
        </div>

        {/* Sync Status Alert */}
        {lastSync?.status === 'error' && (
          <Card className="mb-6 border-rose-200 bg-rose-50">
            <CardContent className="py-4">
              <p className="text-rose-900 font-semibold">Last sync failed: {lastSync.error_message}</p>
              <p className="text-rose-700 text-sm mt-1">
                {format(new Date(lastSync.timestamp), 'PPp')}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <PoundSterling className="w-6 h-6" />
                <p className="text-emerald-100 text-sm">Total Sales Today</p>
              </div>
              <p className="text-4xl font-bold">{formatMoney(totalSalesToday)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <PoundSterling className="w-6 h-6 text-blue-600" />
                <p className="text-slate-500 text-sm">Total Tips Today</p>
              </div>
              <p className="text-4xl font-bold text-blue-600">{formatMoney(totalTipsToday)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-indigo-600" />
                <p className="text-slate-500 text-sm">Active Employees</p>
              </div>
              <p className="text-4xl font-bold text-indigo-600">{activeEmployeeIds.size}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <Trophy className="w-6 h-6 text-purple-600" />
                <p className="text-slate-500 text-sm">Pending Bonuses</p>
              </div>
              <p className="text-4xl font-bold text-purple-600">{formatMoney(pendingBonusTotal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart */}
        <Card className="border-0 shadow-lg mb-10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Hourly Sales</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'daily' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('daily')}
                >
                  Daily
                </Button>
                <Button
                  variant={viewMode === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('weekly')}
                >
                  Weekly
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  formatter={(value) => [`£${value.toFixed(2)}`, 'Sales']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Employee Leaderboard */}
        <Card className="border-0 shadow-lg mb-10">
          <CardHeader>
            <CardTitle>Employee Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('sales')}>
                    Sales Total {sortBy === 'sales' && (sortDesc ? '↓' : '↑')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('tips')}>
                    Tips Total {sortBy === 'tips' && (sortDesc ? '↓' : '↑')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('bonuses')}>
                    Bonuses {sortBy === 'bonuses' && (sortDesc ? '↓' : '↑')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((emp, index) => (
                  <TableRow 
                    key={emp.id}
                    className={emp.hasAchievedBonus ? 'bg-emerald-50' : ''}
                  >
                    <TableCell className="font-bold text-slate-600">#{index + 1}</TableCell>
                    <TableCell className="font-semibold">{emp.name}</TableCell>
                    <TableCell>{formatMoney(emp.sales)}</TableCell>
                    <TableCell>{formatMoney(emp.tips)}</TableCell>
                    <TableCell className="text-purple-600 font-semibold">{formatMoney(emp.bonuses)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        {liveTransactions.length > 0 && (
          <div className="fixed bottom-6 right-6 w-80">
            <Card className="border-0 shadow-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Live Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {liveTransactions.map((tx, i) => (
                  <div key={i} className="text-sm p-2 bg-slate-50 rounded-lg">
                    <p className="font-semibold text-slate-900">
                      {formatMoney(tx.amount || tx.total_amount || 0)}
                    </p>
                    <p className="text-xs text-slate-500">Just now</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}