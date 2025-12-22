import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PoundSterling, 
  Calendar, 
  Clock,
  Eye,
  CheckCircle,
  Lock,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import EmployeeTipHistory from '@/components/employee/EmployeeTipHistory';
import TipCalculationExplainer from '@/components/employee/TipCalculationExplainer';
import RaiseDisputeModal from '@/components/employee/RaiseDisputeModal';

export default function EmployeePortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  // Get current user and their employee record
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.filter({ user_id: user?.id }),
    enabled: !!user,
  });

  const currentEmployee = employees[0];

  const { data: allocationLines = [] } = useQuery({
    queryKey: ['my-allocation-lines', currentEmployee?.id],
    queryFn: () => base44.entities.TipAllocationLine.filter({ employee_id: currentEmployee?.id }),
    enabled: !!currentEmployee,
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ['my-adjustments', currentEmployee?.id],
    queryFn: () => base44.entities.Adjustment.filter({ employee_id: currentEmployee?.id }),
    enabled: !!currentEmployee,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['allocation-batches'],
    queryFn: () => base44.entities.TipAllocationBatch.list(),
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Calculate stats
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

  const currentWeekTips = allocationLines
    .filter(a => {
      const date = new Date(a.allocation_date);
      return date >= currentWeekStart && date <= currentWeekEnd;
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const currentMonthTips = allocationLines
    .filter(a => {
      const date = new Date(a.allocation_date);
      return date >= currentMonthStart && date <= currentMonthEnd;
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  // Get batch statuses for allocations
  const pendingTips = allocationLines
    .filter(line => {
      const batch = batches.find(b => b.id === line.allocation_batch_id);
      return batch?.status === 'draft' || batch?.status === 'pending_approval';
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const finalisedTips = allocationLines
    .filter(line => {
      const batch = batches.find(b => b.id === line.allocation_batch_id);
      return batch?.status === 'finalised';
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const exportedTips = allocationLines
    .filter(line => {
      const batch = batches.find(b => b.id === line.allocation_batch_id);
      return batch?.status === 'exported';
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  // Chart data - last 30 days
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTips = allocationLines
      .filter(a => format(new Date(a.allocation_date), 'yyyy-MM-dd') === dateStr)
      .reduce((sum, a) => sum + (a.gross_amount || 0), 0);
    return { date: format(date, 'dd MMM'), amount: dayTips };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          <p className="text-sm text-indigo-600 font-semibold">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!currentEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, {currentEmployee.full_name?.split(' ')[0]}
          </h1>
          <p className="text-slate-500 mt-1">Here's your tip earnings summary</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm">This Week</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(currentWeekTips)}</p>
                </div>
                <Calendar className="w-8 h-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">This Month</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(currentMonthTips)}</p>
                </div>
                <PoundSterling className="w-8 h-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-500 text-sm flex items-center gap-1">
                    Pending
                    <HelpCircle className="w-3 h-3" />
                  </p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(pendingTips)}</p>
                  <p className="text-xs text-slate-500 mt-1">Not yet finalised</p>
                </div>
                <Clock className="w-8 h-8 text-amber-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-500 text-sm">Finalised</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(finalisedTips)}</p>
                  <p className="text-xs text-slate-500 mt-1">Confirmed</p>
                </div>
                <CheckCircle className="w-8 h-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-500 text-sm">Exported</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(exportedTips)}</p>
                  <p className="text-xs text-slate-500 mt-1">In payroll</p>
                </div>
                <Lock className="w-8 h-8 text-emerald-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">My Tips</TabsTrigger>
            <TabsTrigger value="how">How It Works</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Your Earnings - Last 30 Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(value) => `£${value / 100}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#6366f1" 
                        strokeWidth={2}
                        fill="url(#colorAmount)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Adjustments */}
            {adjustments.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    Recent Adjustments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {adjustments.slice(0, 5).map(adj => (
                      <div key={adj.id} className="flex items-start justify-between p-3 rounded-lg bg-slate-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="capitalize">
                              {adj.adjustment_type.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {format(new Date(adj.created_date), 'dd MMM yyyy')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">{adj.reason}</p>
                        </div>
                        <p className={`text-lg font-semibold ${adj.adjustment_amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {adj.adjustment_amount > 0 ? '+' : ''}{formatCurrency(adj.adjustment_amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Have a question */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Have a question about your tips?</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      If you believe there's an error in your tip allocation, you can raise a dispute for review.
                    </p>
                    <Button onClick={() => setShowDisputeModal(true)} variant="outline" className="bg-white">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Raise a Dispute
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <EmployeeTipHistory 
              allocationLines={allocationLines}
              adjustments={adjustments}
              batches={batches}
              employeeName={currentEmployee?.full_name}
            />
          </TabsContent>

          <TabsContent value="how">
            <TipCalculationExplainer 
              employee={currentEmployee}
              recentAllocations={allocationLines.slice(0, 5)}
              batches={batches}
            />
          </TabsContent>
        </Tabs>
      </div>

      <RaiseDisputeModal
        open={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        employee={currentEmployee}
        allocationLines={allocationLines}
        batches={batches}
      />
      </div>
    </div>
  );
}