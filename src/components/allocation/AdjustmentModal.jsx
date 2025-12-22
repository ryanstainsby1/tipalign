import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from 'lucide-react';

export default function AdjustmentModal({ open, onClose, allocationLine, batchId }) {
  const [adjustmentType, setAdjustmentType] = useState('correction');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const createAdjustmentMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('createAdjustment', {
        allocation_line_id: allocationLine?.id,
        adjustment_type: adjustmentType,
        adjustment_amount: Math.round(parseFloat(adjustmentAmount) * 100),
        reason: reason
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['batch'] });
      queryClient.invalidateQueries({ queryKey: ['allocationLines'] });
      onClose();
      setAdjustmentAmount('');
      setReason('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!adjustmentAmount || !reason) return;
    createAdjustmentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Adjustment</DialogTitle>
          <DialogDescription>
            Modify a finalised allocation. All adjustments are audited and require approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <Alert className="border-indigo-200 bg-indigo-50">
              <Info className="w-4 h-4 text-indigo-600" />
              <AlertDescription className="text-indigo-900 text-sm">
                Adjustments create an immutable audit trail. Use positive values for additions, negative for deductions.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="correction">Correction</SelectItem>
                  <SelectItem value="dispute_resolution">Dispute Resolution</SelectItem>
                  <SelectItem value="manual_override">Manual Override</SelectItem>
                  <SelectItem value="clawback">Clawback</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Adjustment Amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="10.50"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                Use negative values for deductions (e.g., -5.00)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reason (Required)</Label>
              <Textarea
                placeholder="Explain why this adjustment is necessary..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-24"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createAdjustmentMutation.isPending || !adjustmentAmount || !reason}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {createAdjustmentMutation.isPending ? 'Creating...' : 'Create Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}