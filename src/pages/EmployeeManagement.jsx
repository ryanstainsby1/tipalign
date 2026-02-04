import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { formatMoney } from '@/components/common/formatMoney';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function EmployeeManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: currentOrg } = useQuery({
    queryKey: ['currentOrganization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCurrentOrganization', {});
      return response.data.success ? response.data.organization : null;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', currentOrg?.id],
    queryFn: () => base44.entities.Employee.filter({
      organization_id: currentOrg?.id
    }),
    enabled: !!currentOrg?.id,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', currentOrg?.id],
    queryFn: () => base44.entities.Location.filter({
      organization_id: currentOrg?.id
    }),
    enabled: !!currentOrg?.id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', expandedId],
    queryFn: () => base44.entities.Transaction.filter({
      employee_id: expandedId
    }),
    enabled: !!expandedId,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', expandedId],
    queryFn: () => base44.entities.Shift.filter({
      employee_id: expandedId,
      status: 'open'
    }),
    enabled: !!expandedId,
  });

  const { data: bonusAllocations = [] } = useQuery({
    queryKey: ['bonusAllocations', expandedId],
    queryFn: () => base44.entities.BonusAllocations.filter({
      employee_id: expandedId
    }),
    enabled: !!expandedId,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => 
      base44.entities.Employee.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee status updated');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const connections = await base44.entities.SquareConnection.filter({
        organization_id: currentOrg?.id,
        connection_status: 'connected'
      });
      if (connections.length === 0) throw new Error('No connection');
      
      const response = await base44.functions.invoke('syncSquareData', {
        connection_id: connections[0].id,
        entity_types: ['team_members']
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employees synced successfully');
    },
  });

  const filteredEmployees = employees.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLocationName = (locationId) => {
    const loc = locations.find(l => l.id === locationId);
    return loc?.name || 'Unknown';
  };

  const getLastTransactionDate = (empId) => {
    const empTransactions = transactions.filter(tx => tx.employee_id === empId);
    if (empTransactions.length === 0) return null;
    const sorted = empTransactions.sort((a, b) => 
      new Date(b.transaction_date || b.timestamp) - new Date(a.transaction_date || a.timestamp)
    );
    return sorted[0].transaction_date || sorted[0].timestamp;
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const currentShift = shifts.find(shift => {
    const startTime = new Date(shift.start_at);
    const now = new Date();
    return startTime <= now && (!shift.end_at || new Date(shift.end_at) > now);
  });

  const recentTransactions = transactions
    .sort((a, b) => new Date(b.transaction_date || b.timestamp) - new Date(a.transaction_date || a.timestamp))
    .slice(0, 10);

  const totalSales = transactions.reduce((sum, tx) => sum + (tx.amount || tx.total_amount || 0), 0);
  const totalTips = transactions.reduce((sum, tx) => sum + (tx.tip_amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Employee Management</h1>
            <p className="text-slate-600 mt-1">Manage team members and track performance</p>
          </div>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Employees
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </div>

        {/* Employee Table */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Last Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map(emp => {
                  const lastTxDate = getLastTransactionDate(emp.id);
                  const isExpanded = expandedId === emp.id;

                  return (
                    <React.Fragment key={emp.id}>
                      <TableRow 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => toggleExpand(emp.id)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{emp.full_name}</TableCell>
                        <TableCell className="text-sm text-slate-600">{emp.email || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600">{emp.phone || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {getLocationName(emp.primary_location_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{emp.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActiveMutation.mutate({
                                id: emp.id,
                                is_active: !emp.is_active
                              });
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              emp.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                emp.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {lastTxDate ? format(new Date(lastTxDate), 'MMM d, yyyy') : 'No data'}
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-slate-50 p-6">
                            <div className="grid grid-cols-3 gap-6">
                              {/* Stats */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Performance</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  <div>
                                    <p className="text-xs text-slate-500">Total Sales</p>
                                    <p className="text-lg font-bold">{formatMoney(totalSales)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">Total Tips</p>
                                    <p className="text-lg font-bold text-emerald-600">{formatMoney(totalTips)}</p>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Current Shift */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Current Shift</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {currentShift ? (
                                    <div>
                                      <Badge className="bg-emerald-500 mb-2">Clocked In</Badge>
                                      <p className="text-xs text-slate-600">
                                        Started: {format(new Date(currentShift.start_at), 'h:mm a')}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500">Not clocked in</p>
                                  )}
                                </CardContent>
                              </Card>

                              {/* Bonuses */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Bonuses</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {bonusAllocations.length > 0 ? (
                                    <div className="space-y-1">
                                      {bonusAllocations.slice(0, 3).map(bonus => (
                                        <div key={bonus.id} className="flex justify-between text-xs">
                                          <span className="text-slate-600">{bonus.rule_name}</span>
                                          <span className="font-semibold text-purple-600">
                                            {formatMoney(bonus.bonus_amount)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500">No bonuses yet</p>
                                  )}
                                </CardContent>
                              </Card>
                            </div>

                            {/* Recent Transactions */}
                            {recentTransactions.length > 0 && (
                              <div className="mt-6">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3">Recent Transactions</h4>
                                <div className="space-y-2">
                                  {recentTransactions.map(tx => (
                                    <div key={tx.id} className="flex justify-between items-center p-3 bg-white rounded-lg">
                                      <div>
                                        <p className="text-sm font-semibold">
                                          {formatMoney(tx.amount || tx.total_amount || 0)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {format(new Date(tx.transaction_date || tx.timestamp), 'MMM d, h:mm a')}
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm text-emerald-600 font-semibold">
                                          {formatMoney(tx.tip_amount || 0)} tip
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}