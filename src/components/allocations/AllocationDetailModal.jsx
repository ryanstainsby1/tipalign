import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Edit,
  Users,
  Calculator,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';

export default function AllocationDetailModal({ 
  allocation, 
  open, 
  onClose,
  onConfirm,
  onDispute,
  onOverride,
  onExport
}) {
  if (!allocation) return null;

  const formatCurrency = (value) => {
    return `£${(value / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Mock transactions for this allocation
  const transactions = [
    { id: 'TXN001', amount: 500, time: '14:23', method: 'Card' },
    { id: 'TXN002', amount: 750, time: '15:45', method: 'Card' },
    { id: 'TXN003', amount: 250, time: '16:12', method: 'Card' },
  ];

  const totalFromTransactions = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            Allocation Details
          </DialogTitle>
          <DialogDescription>
            Review allocation breakdown and take action
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Header Info */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Employee</p>
                <p className="font-semibold text-slate-900">{allocation.employee_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Shift Date</p>
                <p className="font-semibold text-slate-900">
                  {format(new Date(allocation.allocation_date), 'PPP')}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Amount</p>
                <p className="font-bold text-2xl text-indigo-600">
                  {formatCurrency(allocation.gross_amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Breakdown */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-slate-600" />
                Transaction Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-sm font-semibold text-slate-700 pb-3">Transaction ID</th>
                      <th className="text-left text-sm font-semibold text-slate-700 pb-3">Amount</th>
                      <th className="text-left text-sm font-semibold text-slate-700 pb-3">Time</th>
                      <th className="text-left text-sm font-semibold text-slate-700 pb-3">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => (
                      <tr key={txn.id} className="border-b border-slate-100">
                        <td className="py-3 text-sm text-slate-900">{txn.id}</td>
                        <td className="py-3 text-sm font-semibold text-slate-900">
                          {formatCurrency(txn.amount)}
                        </td>
                        <td className="py-3 text-sm text-slate-600">{txn.time}</td>
                        <td className="py-3 text-sm text-slate-600">{txn.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Allocation Method */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-600" />
                Allocation Method
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="bg-indigo-100 text-indigo-700 border-0">
                    {allocation.allocation_method || 'Pooled'}
                  </Badge>
                  <p className="text-sm text-slate-600">
                    {allocation.allocation_method === 'pooled' 
                      ? 'Tips divided equally among all staff working this shift'
                      : 'Individual allocation based on transaction processor'
                    }
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-900 font-medium mb-1">Calculation:</p>
                  <p className="text-sm text-slate-600">
                    {transactions.length} tips = {formatCurrency(totalFromTransactions)} total ÷ 3 staff = {formatCurrency(totalFromTransactions / 3)} each
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-900 font-medium mb-2">Team members in this allocation:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Sarah Johnson</Badge>
                    <Badge variant="outline">Mike Chen</Badge>
                    <Badge variant="outline">{allocation.employee_name}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                Audit Trail
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Created:</span>
                  <span className="text-slate-900 font-medium">
                    {format(new Date(allocation.created_date), 'PPp')} by System
                  </span>
                </div>
                {allocation.updated_date && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Last modified:</span>
                    <span className="text-slate-900 font-medium">
                      {format(new Date(allocation.updated_date), 'PPp')}
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <Button variant="link" className="text-indigo-600 p-0 h-auto">
                    View full audit log for this allocation →
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
            {allocation.status === 'pending' && (
              <Button 
                onClick={() => onConfirm(allocation)}
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm Allocation
              </Button>
            )}
            <Button 
              variant="destructive"
              onClick={() => onDispute(allocation)}
              className="flex-1"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Dispute
            </Button>
            <Button 
              variant="outline"
              onClick={() => onOverride(allocation)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Override Amount
            </Button>
            <Button 
              variant="outline"
              onClick={() => onExport(allocation)}
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}