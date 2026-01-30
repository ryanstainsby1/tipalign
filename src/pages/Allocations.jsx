import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Search, Calendar as CalendarIcon, InfoIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AllocationCard from '@/components/allocations/AllocationCard';
import AllocationDetailModal from '@/components/allocations/AllocationDetailModal';

export default function Allocations() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: currentOrg } = useQuery({
    queryKey: ['currentOrganization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCurrentOrganization', {});
      return response.data.success ? response.data.organization : null;
    },
  });

  const organizationId = currentOrg?.id;

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['allocations', organizationId],
    queryFn: () => base44.entities.TipAllocation.filter({ organization_id: organizationId }),
    enabled: !!organizationId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', organizationId],
    queryFn: () => base44.entities.Employee.filter({ 
      organization_id: organizationId,
      employment_status: 'active' 
    }),
    enabled: !!organizationId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', organizationId],
    queryFn: () => base44.entities.Location.filter({ 
      organization_id: organizationId,
      active: true 
    }),
    enabled: !!organizationId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TipAllocation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      toast.success('Allocation updated successfully');
    },
  });

  const getEmployeeName = (employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.full_name || 'Unknown Employee';
  };

  // Enrich allocations with employee names
  const enrichedAllocations = allocations.map(alloc => ({
    ...alloc,
    employee_name: getEmployeeName(alloc.employee_id),
    transaction_count: 3 // Mock data
  }));

  const filteredAllocations = enrichedAllocations.filter(alloc => {
    const matchesStatus = statusFilter === 'all' || alloc.status === statusFilter;
    const matchesSearch = alloc.employee_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = locationFilter === 'all' || alloc.location_id === locationFilter;
    return matchesStatus && matchesSearch && matchesLocation;
  });

  const pendingAllocations = filteredAllocations.filter(a => a.status === 'pending');
  const confirmedAllocations = filteredAllocations.filter(a => a.status === 'confirmed');
  const disputedAllocations = filteredAllocations.filter(a => a.status === 'disputed');

  const handleReview = (allocation) => {
    setSelectedAllocation(allocation);
    setDetailModalOpen(true);
  };

  const handleConfirm = (allocation) => {
    updateMutation.mutate({
      id: allocation.id,
      data: { 
        status: 'confirmed',
        confirmed_by: 'Admin User',
        updated_date: new Date().toISOString()
      }
    });
    setDetailModalOpen(false);
  };

  const handleDispute = (allocation) => {
    updateMutation.mutate({
      id: allocation.id,
      data: { 
        status: 'disputed',
        dispute_reason: 'Amount discrepancy - needs review',
        disputed_by: allocation.employee_name
      }
    });
    setDetailModalOpen(false);
  };

  const handleOverride = (allocation) => {
    toast.info('Override feature coming soon');
  };

  const handleExport = async (allocation) => {
    toast.success('Exporting allocation as PDF...');
  };

  const handleExportAll = async () => {
    try {
      const csv = [
        'Employee,Date,Amount,Method,Status',
        ...filteredAllocations.map(a => 
          `${a.employee_name},${format(new Date(a.allocation_date), 'yyyy-MM-dd')},${(a.gross_amount / 100).toFixed(2)},${a.allocation_method},${a.status}`
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `allocations-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Allocations exported successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
                Tip Allocations
              </h1>
              <p className="text-slate-600 text-lg">View, review, and manage all tip allocations</p>
            </div>
            <Button onClick={handleExportAll} className="bg-indigo-600 hover:bg-indigo-700">
              <Download className="w-4 h-4 mr-2" />
              Export Allocations
            </Button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'PP')} - {format(dateRange.to, 'PP')}
                      </>
                    ) : (
                      format(dateRange.from, 'PP')
                    )
                  ) : (
                    'Date Range'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                />
              </PopoverContent>
            </Popover>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending Review</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Allocation Pipeline - Kanban View */}
        {filteredAllocations.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="max-w-lg mx-auto">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <InfoIcon className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">No allocations yet</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Tips will appear here once they're captured via Square and processed by Tiply.
              </p>
              
              <div className="bg-blue-50 rounded-xl p-6 text-left border border-blue-200">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <InfoIcon className="w-5 h-5 text-blue-600" />
                  How allocations work:
                </h4>
                <ol className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">1</span>
                    <span>Tip is captured on Square terminal</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">2</span>
                    <span>Tiply matches tip to employee(s) based on shift data</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">3</span>
                    <span>Allocation shown here for review</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">4</span>
                    <span>You confirm or dispute</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">5</span>
                    <span>Data exported to payroll</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Pending Review */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Pending Review</h3>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {pendingAllocations.length}
                  </span>
                </div>
                <p className="text-sm text-slate-600">Awaiting confirmation</p>
              </div>
              <div className="space-y-4">
                {pendingAllocations.map(alloc => (
                  <AllocationCard 
                    key={alloc.id} 
                    allocation={alloc} 
                    onReview={handleReview}
                    statusType="pending"
                  />
                ))}
                {pendingAllocations.length === 0 && (
                  <p className="text-center text-slate-500 py-8 text-sm">No pending allocations</p>
                )}
              </div>
            </div>

            {/* Column 2: Confirmed */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Confirmed</h3>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                    {confirmedAllocations.length}
                  </span>
                </div>
                <p className="text-sm text-slate-600">Ready for payroll</p>
              </div>
              <div className="space-y-4">
                {confirmedAllocations.map(alloc => (
                  <AllocationCard 
                    key={alloc.id} 
                    allocation={alloc} 
                    onReview={handleReview}
                    statusType="confirmed"
                  />
                ))}
                {confirmedAllocations.length === 0 && (
                  <p className="text-center text-slate-500 py-8 text-sm">No confirmed allocations</p>
                )}
              </div>
            </div>

            {/* Column 3: Disputed */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Disputed</h3>
                  <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-semibold">
                    {disputedAllocations.length}
                  </span>
                </div>
                <p className="text-sm text-slate-600">Awaiting resolution</p>
              </div>
              <div className="space-y-4">
                {disputedAllocations.map(alloc => (
                  <AllocationCard 
                    key={alloc.id} 
                    allocation={alloc} 
                    onReview={handleReview}
                    statusType="disputed"
                  />
                ))}
                {disputedAllocations.length === 0 && (
                  <p className="text-center text-slate-500 py-8 text-sm">No disputed allocations</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Allocation Detail Modal */}
      <AllocationDetailModal
        allocation={selectedAllocation}
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onConfirm={handleConfirm}
        onDispute={handleDispute}
        onOverride={handleOverride}
        onExport={handleExport}
      />
    </div>
  );
}