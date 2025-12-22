import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import DisputeResolutionModal from '@/components/disputes/DisputeResolutionModal';

export default function Disputes() {
  const [activeTab, setActiveTab] = useState('open');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: () => base44.entities.Dispute.list('-raised_at', 100),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const openDisputes = disputes.filter(d => d.status === 'open' || d.status === 'under_review');
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');
  const rejectedDisputes = disputes.filter(d => d.status === 'rejected');

  const statusConfig = {
    open: { label: 'Open', color: 'bg-rose-100 text-rose-700', icon: AlertTriangle },
    under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
    resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-slate-100 text-slate-700', icon: MessageSquare }
  };

  const categoryLabels = {
    incorrect_amount: 'Incorrect Amount',
    missing_tips: 'Missing Tips',
    wrong_allocation_method: 'Wrong Method',
    shift_hours_wrong: 'Hours Incorrect',
    other: 'Other'
  };

  const handleResolve = (dispute) => {
    setSelectedDispute(dispute);
    setShowResolutionModal(true);
  };

  const renderDisputeTable = (disputesList) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Raised</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Expected Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {disputesList.map(dispute => {
          const employee = employees.find(e => e.id === dispute.employee_id);
          const config = statusConfig[dispute.status];
          const Icon = config.icon;

          return (
            <TableRow key={dispute.id}>
              <TableCell>{format(new Date(dispute.raised_at), 'dd MMM yyyy')}</TableCell>
              <TableCell className="font-medium">{employee?.full_name || 'Unknown'}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {categoryLabels[dispute.dispute_category] || dispute.dispute_category}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm text-slate-600">
                {dispute.description}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {dispute.expected_amount ? formatCurrency(dispute.expected_amount) : '-'}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={config.color}>
                  <Icon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
              </TableCell>
              <TableCell>
                {(dispute.status === 'open' || dispute.status === 'under_review') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(dispute)}
                  >
                    Resolve
                  </Button>
                )}
                {dispute.status === 'resolved' && dispute.adjustment_id && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                    Adjustment Created
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Disputes Management</h1>
          <p className="text-slate-500 mt-1">Review and resolve employee tip disputes</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Disputes</p>
                  <p className="text-3xl font-bold text-slate-900">{disputes.length}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Open</p>
                  <p className="text-3xl font-bold text-rose-600">{openDisputes.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-rose-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Resolved</p>
                  <p className="text-3xl font-bold text-emerald-600">{resolvedDisputes.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Rejected</p>
                  <p className="text-3xl font-bold text-slate-600">{rejectedDisputes.length}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="open">Open ({openDisputes.length})</TabsTrigger>
            <TabsTrigger value="resolved">Resolved ({resolvedDisputes.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejectedDisputes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Open Disputes</CardTitle>
                <CardDescription>Disputes awaiting resolution</CardDescription>
              </CardHeader>
              <CardContent>
                {openDisputes.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                    <p className="text-slate-600">No open disputes</p>
                  </div>
                ) : (
                  renderDisputeTable(openDisputes)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resolved">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Resolved Disputes</CardTitle>
                <CardDescription>Disputes that have been resolved</CardDescription>
              </CardHeader>
              <CardContent>
                {resolvedDisputes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-500">No resolved disputes</p>
                  </div>
                ) : (
                  renderDisputeTable(resolvedDisputes)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Rejected Disputes</CardTitle>
                <CardDescription>Disputes that were rejected</CardDescription>
              </CardHeader>
              <CardContent>
                {rejectedDisputes.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-slate-500">No rejected disputes</p>
                  </div>
                ) : (
                  renderDisputeTable(rejectedDisputes)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <DisputeResolutionModal
        open={showResolutionModal}
        onClose={() => {
          setShowResolutionModal(false);
          setSelectedDispute(null);
        }}
        dispute={selectedDispute}
      />
    </div>
  );
}