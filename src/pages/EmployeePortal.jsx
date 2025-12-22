import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PoundSterling, 
  TrendingUp, 
  Calendar, 
  Clock,
  Download,
  Eye,
  CheckCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import EmployeeTipHistory from '@/components/employee/EmployeeTipHistory';

export default function EmployeePortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  // In production, this would be the logged-in employee
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const currentEmployee = employees[0]; // Demo: use first employee

  const { data: allocations = [] } = useQuery({
    queryKey: ['my-allocations', currentEmployee?.id],
    queryFn: () => base44.entities.TipAllocation.filter({ employee_id: currentEmployee?.id }),
    enabled: !!currentEmployee,
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Calculate stats
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const currentMonthTips = allocations
    .filter(a => {
      const date = new Date(a.allocation_date);
      return date >= currentMonthStart && date <= currentMonthEnd;
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const lastMonthTips = allocations
    .filter(a => {
      const date = new Date(a.allocation_date);
      return date >= lastMonthStart && date <= lastMonthEnd;
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const pendingTips = allocations
    .filter(a => a.status === 'pending')
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const confirmedTips = allocations
    .filter(a => a.status === 'confirmed')
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  // Chart data - last 30 days
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTips = allocations
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm">This Month</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(currentMonthTips)}</p>
                </div>
                <PoundSterling className="w-8 h-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Last Month</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(lastMonthTips)}</p>
                </div>
                <Calendar className="w-8 h-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(pendingTips)}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Confirmed</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(confirmedTips)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Tip History</TabsTrigger>
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

            {/* How Tips Are Calculated */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  How Your Tips Are Calculated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">Your Role</Badge>
                      <span className="font-medium text-slate-900 capitalize">{currentEmployee.role}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Your role determines your share in pooled tip allocations.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">Weight Multiplier</Badge>
                      <span className="font-medium text-slate-900">{currentEmployee.role_weight}x</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      When tips are pooled, this multiplier affects your share relative to others.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-emerald-900">Transparent & Auditable</p>
                        <p className="text-sm text-emerald-700 mt-1">
                          Every tip allocation is recorded with a timestamp and calculation method. You can view the full breakdown in your tip history.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <EmployeeTipHistory 
              allocations={allocations}
              employeeName={currentEmployee.full_name}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}