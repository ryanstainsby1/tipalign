import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function RaiseDisputeModal({ open, onClose, employee, allocationLines = [], batches = [] }) {
  const [selectedAllocationId, setSelectedAllocationId] = useState('');
  const [category, setCategory] = useState('incorrect_amount');
  const [description, setDescription] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const queryClient = useQueryClient();

  const createDisputeMutation = useMutation({
    mutationFn: async () => {
      const allocation = allocationLines.find(a => a.id === selectedAllocationId);
      const batch = batches.find(b => b.id === allocation?.allocation_batch_id);

      return await base44.entities.Dispute.create({
        organization_id: employee.organization_id,
        allocation_line_id: selectedAllocationId,
        allocation_batch_id: batch?.id,
        employee_id: employee.id,
        raised_by_email: employee.email,
        dispute_category: category,
        description: description,
        expected_amount: expectedAmount ? Math.round(parseFloat(expectedAmount) * 100) : null,
        status: 'open'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      onClose();
      setSelectedAllocationId('');
      setDescription('');
      setExpectedAmount('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedAllocationId || !description) return;
    createDisputeMutation.mutate();
  };

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Get recent allocations from finalised/exported batches
  const disputeableAllocations = allocationLines.filter(line => {
    const batch = batches.find(b => b.id === line.allocation_batch_id);
    return batch && (batch.status === 'finalised' || batch.status === 'exported');
  }).slice(0, 20);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Raise a Dispute</DialogTitle>
          <DialogDescription>
            If you believe there's an error in your tip allocation, please provide details below. 
            A manager will review your dispute and respond.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <Alert className="border-indigo-200 bg-indigo-50">
              <AlertTriangle className="w-4 h-4 text-indigo-600" />
              <AlertDescription className="text-indigo-900 text-sm">
                <strong>What happens next:</strong> Your dispute will be reviewed by a manager. 
                They may contact you for more details and will either resolve it with an adjustment or provide an explanation.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Which tip allocation is this about?</Label>
              <Select value={selectedAllocationId} onValueChange={setSelectedAllocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an allocation..." />
                </SelectTrigger>
                <SelectContent>
                  {disputeableAllocations.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No allocations available to dispute
                    </div>
                  ) : (
                    disputeableAllocations.map(alloc => {
                      const batch = batches.find(b => b.id === alloc.allocation_batch_id);
                      return (
                        <SelectItem key={alloc.id} value={alloc.id}>
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>{format(new Date(alloc.allocation_date), 'dd MMM yyyy')}</span>
                            <Badge variant="outline" className="capitalize">
                              {alloc.allocation_method?.replace('_', ' ')}
                            </Badge>
                            <span className="font-semibold">{formatCurrency(alloc.gross_amount)}</span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>What type of issue is this?</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incorrect_amount">Incorrect Amount</SelectItem>
                  <SelectItem value="missing_tips">Missing Tips</SelectItem>
                  <SelectItem value="wrong_allocation_method">Wrong Allocation Method</SelectItem>
                  <SelectItem value="shift_hours_wrong">Hours Counted Incorrectly</SelectItem>
                  <SelectItem value="other">Other Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Please explain the issue (Required)</Label>
              <Textarea
                placeholder="e.g., I was on shift for the full day but my tips seem lower than expected. I worked 8 hours but the allocation shows only 4 hours..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-32"
                required
              />
              <p className="text-xs text-slate-500">
                Be as specific as possible. Include dates, shift times, and any other relevant details.
              </p>
            </div>

            {(category === 'incorrect_amount' || category === 'missing_tips') && (
              <div className="space-y-2">
                <Label>What amount did you expect? (Optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="25.00"
                  value={expectedAmount}
                  onChange={(e) => setExpectedAmount(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  This helps us understand the discrepancy faster.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createDisputeMutation.isPending || !selectedAllocationId || !description}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {createDisputeMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}