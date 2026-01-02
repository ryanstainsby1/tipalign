import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { format, startOfMonth, endOfMonth, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import DisputeModal from '@/components/employee/DisputeModal';
import TipTrendChart from '@/components/employee/TipTrendChart';

export default function EmployeePortal() {
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const queryClient = useQueryClient();

  // Get current user and their employee record
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: employees = [], isLoading: loadingEmployee } = useQuery({
    queryKey: ['employees', user?.id],
    queryFn: () => base44.entities.Employee.filter({ user_id: user?.id }),
    enabled: !!user,
  });

  // Try to find employee by email if not linked
  const { data: employeesByEmail = [] } = useQuery({
    queryKey: ['employeesByEmail', user?.email],
    queryFn: () => base44.entities.Employee.filter({ email: user?.email }),
    enabled: !!user && employees.length === 0,
  });

  const linkEmployeeMutation = useMutation({
    mutationFn: ({ employeeId, userId }) => 
      base44.entities.Employee.update(employeeId, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  // Auto-link employee record if found by email
  useEffect(() => {
    if (user && employees.length === 0 && employeesByEmail.length > 0 && !linkEmployeeMutation.isPending) {
      const matchingEmployee = employeesByEmail[0];
      linkEmployeeMutation.mutate({ 
        employeeId: matchingEmployee.id, 
        userId: user.id 
      });
    }
  }, [user, employees, employeesByEmail, linkEmployeeMutation]);

  const currentEmployee = employees.length > 0 ? employees[0] : null;

  const { data: allocations = [] } = useQuery({
    queryKey: ['my-allocations', currentEmployee?.id],
    queryFn: () => base44.entities.TipAllocation.filter({ employee_id: currentEmployee?.id }),
    enabled: !!currentEmployee,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Calculate stats
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

  const currentMonthTips = allocations
    .filter(a => {
      const date = new Date(a.allocation_date);
      return date >= currentMonthStart && date <= currentMonthEnd;
    })
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const pendingTips = allocations
    .filter(a => a.status === 'pending')
    .reduce((sum, a) => sum + (a.gross_amount || 0), 0);

  const avgTipsPerShift = allocations.length > 0 
    ? allocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0) / allocations.length 
    : 0;

  const lastPaidAllocation = allocations
    .filter(a => a.status === 'paid')
    .sort((a, b) => new Date(b.allocation_date) - new Date(a.allocation_date))[0];

  // Chart data - last 12 weeks
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(now, 11 - i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subWeeks(now, 11 - i), { weekStartsOn: 1 });
    const weekLabel = format(weekStart, 'MMM d');
    
    const weekTips = allocations
      .filter(a => {
        const date = new Date(a.allocation_date);
        return date >= weekStart && date <= weekEnd;
      })
      .reduce((sum, a) => sum + (a.gross_amount || 0), 0);
    
    return { week: weekLabel, amount: weekTips / 100 };
  });

  const recentAllocations = allocations
    .sort((a, b) => new Date(b.allocation_date) - new Date(a.allocation_date))
    .slice(0, 10);

  const getLocationName = (locationId) => {
    const loc = locations.find(l => l.id === locationId);
    return loc?.name || 'Unknown';
  };

  const handleRaiseIssue = (allocation) => {
    setSelectedAllocation(allocation);
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async (disputeData) => {
    try {
      await base44.entities.Dispute.create({
        organization_id: currentEmployee.organization_id,
        allocation_line_id: disputeData.allocation_id,
        employee_id: currentEmployee.id,
        raised_by_email: user.email,
        dispute_category: disputeData.reason,
        description: disputeData.details || 'Issue reported by employee',
        status: 'open'
      });
      toast.success('Issue submitted successfully. Your manager will review it.');
    } catch (error) {
      toast.error('Failed to submit issue');
    }
  };

  const handleExport = () => {
    try {
      const csv = [
        'Date,Location,Amount,Status',
        ...allocations.map(a => 
          `${format(new Date(a.allocation_date), 'yyyy-MM-dd')},${getLocationName(a.location_id)},${(a.gross_amount / 100).toFixed(2)},${a.status}`
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-tips-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Tips exported successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (loadingEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!currentEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Employee Record Not Found</h2>
            <p className="text-slate-600 mb-4">
              {linkEmployeeMutation.isPending 
                ? 'Linking your account...' 
                : 'No employee record found with your email address. Please ensure your manager has added you in Square and synced employee data to Tiply.'}
            </p>
            {linkEmployeeMutation.isPending && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
                Your Tips
              </h1>
              <p className="text-slate-600 text-lg">Track tips earned and pending payroll</p>
            </div>
            <Button onClick={handleExport} className="bg-indigo-600 hover:bg-indigo-700">
              <Download className="w-4 h-4 mr-2" />
              Export My Tips
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardContent className="p-6">
              <p className="text-emerald-100 text-sm mb-2">Total Tips This Month</p>
              <p className="text-3xl font-bold">{formatCurrency(currentMonthTips)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-slate-500 text-sm mb-2">Tips Pending Payroll</p>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(pendingTips)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-slate-500 text-sm mb-2">Average Tips Per Shift</p>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(avgTipsPerShift)}</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <p className="text-slate-500 text-sm mb-2">Last Paid Tip</p>
              <p className="text-lg font-bold text-slate-900">
                {lastPaidAllocation 
                  ? format(new Date(lastPaidAllocation.allocation_date), 'MMM d, yyyy')
                  : 'No data'
                }
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Allocations */}
        <Card className="border-0 shadow-lg mb-10">
          <CardHeader>
            <CardTitle>Recent Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAllocations.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No allocations yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Shift Location</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAllocations.map((alloc) => (
                      <TableRow key={alloc.id}>
                        <TableCell>
                          {format(new Date(alloc.allocation_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>{getLocationName(alloc.location_id)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(alloc.gross_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              alloc.status === 'pending' ? 'bg-blue-100 text-blue-700 border-0' :
                              alloc.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700 border-0' :
                              alloc.status === 'paid' ? 'bg-purple-100 text-purple-700 border-0' :
                              'bg-slate-100 text-slate-700 border-0'
                            }
                          >
                            {alloc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRaiseIssue(alloc)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            This seems wrong
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tip Trend Chart */}
        <TipTrendChart data={chartData} />
      </div>

      <DisputeModal
        allocation={selectedAllocation}
        open={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        onSubmit={handleSubmitDispute}
      />
    </div>
  );
}