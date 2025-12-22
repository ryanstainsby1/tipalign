import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertTriangle, Search, Filter, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default function Allocations() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['allocations'],
    queryFn: () => base44.entities.TipAllocation.list('-allocation_date', 200),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TipAllocation.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allocations'] }),
  });

  const getEmployeeName = (employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.full_name || 'Unknown';
  };

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const filteredAllocations = allocations.filter(alloc => {
    const matchesStatus = statusFilter === 'all' || alloc.status === statusFilter;
    const empName = getEmployeeName(alloc.employee_id);
    const matchesSearch = empName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    pending: allocations.filter(a => a.status === 'pending').length,
    confirmed: allocations.filter(a => a.status === 'confirmed').length,
    paid: allocations.filter(a => a.status === 'paid').length,
    disputed: allocations.filter(a => a.status === 'disputed').length,
  };

  const statusConfig = {
    pending: { icon: Clock, color: "bg-amber-50 text-amber-700 border-amber-200" },
    confirmed: { icon: CheckCircle, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    paid: { icon: CheckCircle, color: "bg-blue-50 text-blue-700 border-blue-200" },
    disputed: { icon: AlertTriangle, color: "bg-rose-50 text-rose-700 border-rose-200" }
  };

  const methodLabels = {
    individual: "Individual",
    pooled: "Pooled",
    weighted: "Weighted",
    shift_based: "Shift Based"
  };

  const handleStatusChange = (allocation, newStatus) => {
    updateMutation.mutate({
      id: allocation.id,
      data: { status: newStatus }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Allocations</h1>
            <p className="text-slate-500 mt-1">Review and manage tip distributions</p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Object.entries(statusCounts).map(([status, count]) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            return (
              <Card 
                key={status}
                className={`border-0 shadow-sm cursor-pointer transition-all ${
                  statusFilter === status ? 'ring-2 ring-indigo-500' : ''
                }`}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{count}</p>
                      <p className="text-sm text-slate-500 capitalize">{status}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-white border-slate-200">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-semibold text-slate-600">Employee</TableHead>
                  <TableHead className="font-semibold text-slate-600">Date</TableHead>
                  <TableHead className="font-semibold text-slate-600">Method</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Amount</TableHead>
                  <TableHead className="font-semibold text-slate-600">Tax Period</TableHead>
                  <TableHead className="font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      No allocations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAllocations.map(alloc => {
                    const config = statusConfig[alloc.status] || statusConfig.pending;
                    return (
                      <TableRow key={alloc.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">
                          {getEmployeeName(alloc.employee_id)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {alloc.allocation_date ? format(new Date(alloc.allocation_date), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 text-slate-700">
                            {methodLabels[alloc.allocation_method] || alloc.allocation_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(alloc.gross_amount)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {alloc.paye_period || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.color}>
                            {alloc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStatusChange(alloc, 'confirmed')}>
                                Mark Confirmed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(alloc, 'paid')}>
                                Mark Paid
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(alloc, 'disputed')}>
                                Flag Dispute
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}