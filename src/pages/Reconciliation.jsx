import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Users, 
  CalendarX,
  RefreshCw,
  FileText,
  TrendingDown
} from 'lucide-react';
import { format } from 'date-fns';

export default function Reconciliation() {
  const [activeTab, setActiveTab] = useState('unallocated');

  const { data: currentOrg } = useQuery({
    queryKey: ['currentOrganization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCurrentOrganization', {});
      return response.data.success ? response.data.organization : null;
    },
  });

  const { data: transactions = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['transactions', currentOrg?.id],
    queryFn: () => base44.entities.Transaction.filter({ 
      organization_id: currentOrg?.id 
    }),
    enabled: !!currentOrg?.id,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['allocations', currentOrg?.id],
    queryFn: () => base44.entities.TipAllocation.filter({ 
      organization_id: currentOrg?.id 
    }),
    enabled: !!currentOrg?.id,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list('-start_at', 500),
  });

  const { data: syncJobs = [] } = useQuery({
    queryKey: ['syncJobs'],
    queryFn: () => base44.entities.SyncJob.list('-started_at', 20),
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Analysis: Transactions with tips but no allocation
  const transactionsWithTips = transactions.filter(tx => (tx.tip_amount || 0) > 0);
  
  // Build set of allocated transaction IDs from TipAllocation records
  const allocatedTransactionIds = new Set();
  allocations.forEach(alloc => {
    if (alloc.transaction_id) {
      allocatedTransactionIds.add(alloc.transaction_id);
    }
  });
  
  const unallocatedPayments = transactionsWithTips.filter(tx => !allocatedTransactionIds.has(tx.id));
  const totalUnallocatedTips = unallocatedPayments.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);

  // Analysis: Transactions without employee assignment
  const paymentsWithoutEmployee = transactions.filter(tx => !tx.employee_id && (tx.tip_amount || 0) > 0);

  // Analysis: Shifts without any payments
  const shiftsWithPayments = new Set(transactions.filter(tx => tx.shift_id).map(tx => tx.shift_id));
  const shiftsWithoutPayments = shifts.filter(s => s.status === 'closed' && !shiftsWithPayments.has(s.id));

  // Analysis: Refunded transactions impacting allocations
  const refundedPayments = transactions.filter(tx => tx.allocation_status === 'refunded' || tx.status === 'refunded');
  const refundedWithAllocations = refundedPayments.filter(tx => allocatedTransactionIds.has(tx.id));

  // Analysis: Inactive employees with pending tips
  const inactiveEmployeesWithTips = employees.filter(e => 
    e.employment_status !== 'active' && (e.pending_tips > 0 || e.total_tips_earned_lifetime > 0)
  );

  const metrics = [
    {
      label: 'Unallocated Tips',
      value: formatCurrency(totalUnallocatedTips),
      count: unallocatedPayments.length,
      icon: DollarSign,
      color: 'amber',
      severity: unallocatedPayments.length > 0 ? 'warning' : 'ok'
    },
    {
      label: 'Payments Missing Employee',
      value: paymentsWithoutEmployee.length,
      count: paymentsWithoutEmployee.length,
      icon: Users,
      color: 'rose',
      severity: paymentsWithoutEmployee.length > 0 ? 'error' : 'ok'
    },
    {
      label: 'Shifts Without Sales',
      value: shiftsWithoutPayments.length,
      count: shiftsWithoutPayments.length,
      icon: CalendarX,
      color: 'slate',
      severity: 'info'
    },
    {
      label: 'Refunded w/ Allocations',
      value: refundedWithAllocations.length,
      count: refundedWithAllocations.length,
      icon: TrendingDown,
      color: 'red',
      severity: refundedWithAllocations.length > 0 ? 'critical' : 'ok'
    }
  ];

  const colorMap = {
    amber: 'bg-amber-50 border-amber-200',
    rose: 'bg-rose-50 border-rose-200',
    slate: 'bg-slate-50 border-slate-200',
    red: 'bg-red-50 border-red-200',
    emerald: 'bg-emerald-50 border-emerald-200'
  };

  const iconColorMap = {
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    slate: 'text-slate-600',
    red: 'text-red-600',
    emerald: 'text-emerald-600'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Data Reconciliation</h1>
            <p className="text-slate-500 mt-1">Monitor data quality and identify issues</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric, i) => (
            <Card key={i} className={`border ${colorMap[metric.color]}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <metric.icon className={`w-5 h-5 ${iconColorMap[metric.color]}`} />
                  {metric.severity === 'critical' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  {metric.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  {metric.severity === 'ok' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
                <p className="text-sm text-slate-600 mt-1">{metric.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="unallocated">Unallocated Tips</TabsTrigger>
            <TabsTrigger value="missing-data">Missing Data</TabsTrigger>
            <TabsTrigger value="refunds">Refunds</TabsTrigger>
            <TabsTrigger value="sync-history">Sync History</TabsTrigger>
          </TabsList>

          <TabsContent value="unallocated">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Payments with Unallocated Tips</CardTitle>
                <CardDescription>
                  {unallocatedPayments.length} payments totaling {formatCurrency(totalUnallocatedTips)} awaiting allocation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unallocatedPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <p className="text-slate-600">All tips have been allocated</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Tip Amount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unallocatedPayments.slice(0, 50).map(tx => (
                       <TableRow key={tx.id}>
                         <TableCell>
                           {format(new Date(tx.transaction_date || tx.timestamp), 'dd MMM yyyy HH:mm')}
                         </TableCell>
                         <TableCell>{tx.location_name || '-'}</TableCell>
                         <TableCell>
                           {tx.employee_id ? (
                             employees.find(e => e.id === tx.employee_id)?.full_name || 'Unknown'
                           ) : (
                             <Badge variant="outline" className="bg-amber-50 text-amber-700">No employee</Badge>
                           )}
                         </TableCell>
                         <TableCell className="text-right font-semibold text-amber-600">
                           {formatCurrency(tx.tip_amount || 0)}
                         </TableCell>
                         <TableCell className="text-right">
                           {formatCurrency(tx.total_amount || tx.amount || 0)}
                         </TableCell>
                       </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missing-data">
            <div className="space-y-6">
              {/* Payments without employee */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-rose-600" />
                    Payments Missing Employee Assignment
                  </CardTitle>
                  <CardDescription>{paymentsWithoutEmployee.length} payments need employee assignment</CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentsWithoutEmployee.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">All payments have employee assignments</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead className="text-right">Tip Amount</TableHead>
                          <TableHead>Square Payment ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentsWithoutEmployee.slice(0, 20).map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell>{format(new Date(tx.transaction_date || tx.timestamp), 'dd MMM yyyy HH:mm')}</TableCell>
                            <TableCell>{tx.location_name || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(tx.tip_amount || 0)}</TableCell>
                            <TableCell><code className="text-xs">{tx.square_payment_id}</code></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Shifts without payments */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarX className="w-5 h-5 text-slate-600" />
                    Closed Shifts Without Payments
                  </CardTitle>
                  <CardDescription>{shiftsWithoutPayments.length} shifts with no recorded sales</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftsWithoutPayments.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">All shifts have associated payments</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead>Hours</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shiftsWithoutPayments.slice(0, 20).map(shift => (
                          <TableRow key={shift.id}>
                            <TableCell>
                              {employees.find(e => e.id === shift.employee_id)?.full_name || 'Unknown'}
                            </TableCell>
                            <TableCell>{shift.location_id}</TableCell>
                            <TableCell>{format(new Date(shift.start_at), 'dd MMM HH:mm')}</TableCell>
                            <TableCell>{shift.end_at ? format(new Date(shift.end_at), 'HH:mm') : '-'}</TableCell>
                            <TableCell>{shift.hours_worked?.toFixed(1) || '-'}h</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="refunds">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                  Refunded Payments with Existing Allocations
                </CardTitle>
                <CardDescription>
                  {refundedWithAllocations.length} refunded payments may require adjustment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {refundedWithAllocations.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <p className="text-slate-600">No refunds impacting allocations</p>
                  </div>
                ) : (
                  <>
                    <Alert className="mb-6 border-red-200 bg-red-50">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <AlertDescription className="text-red-900">
                        <strong>Action Required:</strong> These payments were refunded after tips were allocated. 
                        Create adjustments to claw back the allocated tips.
                      </AlertDescription>
                    </Alert>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Refunded At</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead className="text-right">Tip Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {refundedWithAllocations.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell>{format(new Date(tx.transaction_date || tx.timestamp), 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                              {tx.refunded_at ? format(new Date(tx.refunded_at), 'dd MMM yyyy') : '-'}
                            </TableCell>
                            <TableCell>{tx.location_name || '-'}</TableCell>
                            <TableCell className="text-right font-semibold text-red-600">
                              -{formatCurrency(tx.tip_amount || 0)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-red-50 text-red-700">Refunded</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync-history">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Sync Jobs</CardTitle>
                <CardDescription>History of Square data synchronization</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entities</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncJobs.map(job => {
                      const duration = job.completed_at 
                        ? Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000)
                        : null;
                      
                      return (
                        <TableRow key={job.id}>
                          <TableCell>{format(new Date(job.started_at), 'dd MMM HH:mm:ss')}</TableCell>
                          <TableCell>{duration ? `${duration}s` : '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{job.sync_type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{job.entities_synced?.join(', ')}</TableCell>
                          <TableCell className="text-right">{job.records_created || 0}</TableCell>
                          <TableCell className="text-right">{job.records_updated || 0}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={
                                job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                job.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                                job.status === 'failed' ? 'bg-red-50 text-red-700' :
                                'bg-slate-50 text-slate-700'
                              }
                            >
                              {job.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}