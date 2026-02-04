import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Filter, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import EmployeeTable from '@/components/employees/EmployeeTable';
import EmployeeTipHistory from '@/components/employee/EmployeeTipHistory';
import WalletPassSection from '@/components/employees/WalletPassSection';
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from '@/components/common/formatMoney';

export default function Employees() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [viewingWallet, setViewingWallet] = useState(null);
  const [editForm, setEditForm] = useState({});

  const queryClient = useQueryClient();

  const { data: currentOrg } = useQuery({
    queryKey: ['currentOrganization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCurrentOrganization', {});
      return response.data.success ? response.data.organization : null;
    },
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', currentOrg?.id],
    queryFn: () => base44.entities.Employee.filter({
      organization_id: currentOrg?.id
    }),
    enabled: !!currentOrg?.id,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['allocations', viewingHistory?.id],
    queryFn: () => base44.entities.TipAllocation.filter({ employee_id: viewingHistory?.id }),
    enabled: !!viewingHistory,
  });

  const { data: walletPasses = [] } = useQuery({
    queryKey: ['walletPasses', viewingWallet?.id],
    queryFn: () => base44.entities.EmployeeWalletPass.filter({ 
      employee_id: viewingWallet?.id,
      pass_status: 'active'
    }),
    enabled: !!viewingWallet,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setEditingEmployee(null);
    },
  });

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
    const notRemovedFromSquare = !emp.removed_from_square_at;
    return matchesSearch && matchesRole && notRemovedFromSquare;
  });

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setEditForm({
      role: employee.role,
      role_weight: employee.role_weight,
      payroll_id: employee.payroll_id
    });
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      id: editingEmployee.id,
      data: editForm
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Employees</h1>
            <p className="text-slate-500 mt-1">Manage team members and allocations</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="border-slate-200"
              onClick={async () => {
                try {
                  const response = await base44.functions.invoke('exportEmployeesCSV', {
                    organization_id: currentOrg?.id
                  });
                  if (response.data.csv_data) {
                    const blob = new Blob([response.data.csv_data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                  }
                } catch (error) {
                  console.error('Export failed:', error);
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-slate-200"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 bg-white border-slate-200">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="server">Server</SelectItem>
              <SelectItem value="bartender">Bartender</SelectItem>
              <SelectItem value="host">Host</SelectItem>
              <SelectItem value="kitchen">Kitchen</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="runner">Runner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <EmployeeTable 
            employees={filteredEmployees}
            onEdit={handleEdit}
            onViewHistory={(emp) => setViewingHistory(emp)}
            onViewWallet={(emp) => setViewingWallet(emp)}
          />
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="server">Server</SelectItem>
                    <SelectItem value="bartender">Bartender</SelectItem>
                    <SelectItem value="host">Host</SelectItem>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="runner">Runner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tip Weight Multiplier</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="2"
                  value={editForm.role_weight}
                  onChange={(e) => setEditForm(f => ({ ...f, role_weight: parseFloat(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Payroll ID</Label>
                <Input
                  value={editForm.payroll_id || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, payroll_id: e.target.value }))}
                  placeholder="External payroll reference"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingEmployee(null)}>Cancel</Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* History Dialog */}
        <Dialog open={!!viewingHistory} onOpenChange={() => setViewingHistory(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <EmployeeTipHistory 
              allocations={allocations}
              employeeName={viewingHistory?.full_name}
            />
          </DialogContent>
        </Dialog>

        {/* Wallet Pass Dialog */}
        <Dialog open={!!viewingWallet} onOpenChange={() => setViewingWallet(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {viewingWallet && (
              <WalletPassSection 
                employee={viewingWallet}
                walletPass={walletPasses[0] || null}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['walletPasses'] })}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}