import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Lock, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AdjustmentModal from '@/components/allocation/AdjustmentModal';

export default function AllocationDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const batchId = urlParams.get('id');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const queryClient = useQueryClient();

  const { data: batch, isLoading: loadingBatch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const batches = await base44.entities.TipAllocationBatch.filter({ id: batchId });
      return batches[0];
    },
    enabled: !!batchId
  });

  const { data: lines = [] } = useQuery({
    queryKey: ['allocationLines', batchId],
    queryFn: () => base44.entities.TipAllocationLine.filter({ allocation_batch_id: batchId }),
    enabled: !!batchId
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ['adjustments', batchId],
    queryFn: () => base44.entities.Adjustment.filter({ allocation_batch_id: batchId }),
    enabled: !!batchId
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const isLocked = batch?.status === 'finalised' || batch?.status === 'exported';

  if (loadingBatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-900">Batch not found</p>
          <Link to={createPageUrl('Ledger')}>
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Ledger
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to={createPageUrl('Ledger')}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Ledger
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Allocation Batch</h1>
              <p className="text-slate-500 mt-1">
                {format(new Date(batch.batch_date), 'dd MMMM yyyy')}
              </p>
            </div>
            <Badge 
              variant="outline" 
              className={
                batch.status === 'exported' ? 'bg-emerald-100 text-emerald-700 text-lg py-2 px-4' :
                batch.status === 'finalised' ? 'bg-indigo-100 text-indigo-700 text-lg py-2 px-4' :
                'bg-slate-100 text-slate-700 text-lg py-2 px-4'
              }
            >
              {batch.status === 'exported' && <Lock className="w-4 h-4 mr-2" />}
              {batch.status === 'finalised' && <CheckCircle className="w-4 h-4 mr-2" />}
              {batch.status}
            </Badge>
          </div>
        </div>

        {isLocked && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <Shield className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-900">
              <strong>Immutable Record:</strong> This batch is locked. Only adjustments with approvals can modify allocations.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500">Total Tips</p>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(batch.total_tips_allocated)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500">Employees</p>
              <p className="text-3xl font-bold text-indigo-600">{batch.employee_count}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500">Payments</p>
              <p className="text-3xl font-bold text-slate-900">{batch.payment_count}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500">Adjustments</p>
              <p className="text-3xl font-bold text-amber-600">{adjustments.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Allocation Lines */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Allocations</CardTitle>
                <CardDescription>Individual tip distributions to employees</CardDescription>
              </div>
              {isLocked && (
                <Button
                  onClick={() => setShowAdjustmentModal(true)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Adjustment
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Explanation</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Hash</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => {
                  const employee = employees.find(e => e.id === line.employee_id);
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{employee?.full_name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {line.allocation_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-md">
                        {line.calculation_metadata?.explanation}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(line.gross_amount)}
                      </TableCell>
                      <TableCell>
                        {line.audit_hash ? (
                          <code className="text-xs text-slate-500">{line.audit_hash.slice(0, 8)}...</code>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {isLocked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedLine(line);
                              setShowAdjustmentModal(true);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Adjust
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Adjustments */}
        {adjustments.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Adjustments</CardTitle>
              <CardDescription>Post-allocation corrections and dispute resolutions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map(adj => {
                    const employee = employees.find(e => e.id === adj.employee_id);
                    return (
                      <TableRow key={adj.id}>
                        <TableCell>{format(new Date(adj.created_date), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="font-medium">{employee?.full_name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {adj.adjustment_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${adj.adjustment_amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {adj.adjustment_amount > 0 ? '+' : ''}{formatCurrency(adj.adjustment_amount)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-xs truncate">{adj.reason}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              adj.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                              adj.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                              'bg-amber-50 text-amber-700'
                            }
                          >
                            {adj.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{adj.approved_by_email || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AdjustmentModal
        open={showAdjustmentModal}
        onClose={() => {
          setShowAdjustmentModal(false);
          setSelectedLine(null);
        }}
        allocationLine={selectedLine}
        batchId={batchId}
      />
    </div>
  );
}