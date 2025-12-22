import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  Lock, 
  CheckCircle, 
  Clock, 
  Download,
  Eye,
  Search,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Ledger() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['allocationBatches'],
    queryFn: () => base44.entities.TipAllocationBatch.list('-batch_date', 100),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const finaliseMutation = useMutation({
    mutationFn: async ({ batch_id, action }) => {
      const response = await base44.functions.invoke('finaliseBatch', { batch_id, action });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocationBatches'] });
    }
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: Clock },
    pending_approval: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
    finalised: { label: 'Finalised', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
    exported: { label: 'Exported', color: 'bg-emerald-100 text-emerald-700', icon: Lock }
  };

  const filteredBatches = batches.filter(batch => {
    const location = locations.find(l => l.id === batch.location_id);
    const matchesSearch = !searchQuery || 
      location?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    draft: batches.filter(b => b.status === 'draft').length,
    finalised: batches.filter(b => b.status === 'finalised').length,
    exported: batches.filter(b => b.status === 'exported').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tip Allocation Ledger</h1>
          <p className="text-slate-500 mt-1">Immutable record of all tip allocations</p>
        </div>

        {/* Status Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Batches</p>
                  <p className="text-3xl font-bold text-slate-900">{batches.length}</p>
                </div>
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Draft</p>
                  <p className="text-3xl font-bold text-slate-600">{statusCounts.draft}</p>
                </div>
                <Clock className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Finalised</p>
                  <p className="text-3xl font-bold text-indigo-600">{statusCounts.finalised}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-indigo-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Exported</p>
                  <p className="text-3xl font-bold text-emerald-600">{statusCounts.exported}</p>
                </div>
                <Lock className="w-8 h-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by location or batch ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'draft', 'finalised', 'exported'].map(status => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className={statusFilter === status ? 'bg-indigo-600' : ''}
                  >
                    {status === 'all' ? 'All' : statusConfig[status]?.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Batches Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Allocation Batches</CardTitle>
            <CardDescription>Historical record of tip distributions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No allocation batches found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Total Tips</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map(batch => {
                    const location = locations.find(l => l.id === batch.location_id);
                    const config = statusConfig[batch.status] || statusConfig.draft;
                    const Icon = config.icon;

                    return (
                      <TableRow key={batch.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">
                          {format(new Date(batch.batch_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>{location?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {format(new Date(batch.allocation_period_start), 'dd MMM')} - {format(new Date(batch.allocation_period_end), 'dd MMM')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(batch.total_tips_allocated)}
                        </TableCell>
                        <TableCell className="text-right">{batch.employee_count}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.color}>
                            <Icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(createPageUrl('AllocationDetail') + `?id=${batch.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {batch.status === 'draft' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => finaliseMutation.mutate({ batch_id: batch.id, action: 'finalise' })}
                                disabled={finaliseMutation.isPending}
                              >
                                Finalise
                              </Button>
                            )}
                            {batch.status === 'finalised' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => finaliseMutation.mutate({ batch_id: batch.id, action: 'export' })}
                                disabled={finaliseMutation.isPending}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Export
                              </Button>
                            )}
                            {batch.status === 'exported' && (
                              <Lock className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}