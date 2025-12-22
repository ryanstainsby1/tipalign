import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';

export default function DisputeResolutionModal({ open, onClose, dispute }) {
  const [resolution, setResolution] = useState('resolved');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [createAdjustment, setCreateAdjustment] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('resolveDispute', {
        dispute_id: dispute.id,
        resolution: resolution,
        resolution_notes: resolutionNotes,
        create_adjustment: createAdjustment && resolution === 'resolved',
        adjustment_amount: createAdjustment ? Math.round(parseFloat(adjustmentAmount) * 100) : null
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      onClose();
      setResolutionNotes('');
      setCreateAdjustment(false);
      setAdjustmentAmount('');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!resolutionNotes) return;
    resolveMutation.mutate();
  };

  if (!dispute) return null;

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve Dispute</DialogTitle>
          <DialogDescription>
            Review the dispute details and provide a resolution
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Dispute Details */}
            <div className="p-4 rounded-lg bg-slate-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <Badge variant="outline">{dispute.dispute_category?.replace('_', ' ')}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Raised by</span>
                <span className="text-sm text-slate-600">{dispute.raised_by_email}</span>
              </div>
              {dispute.expected_amount && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Expected Amount</span>
                  <span className="text-sm font-semibold">{formatCurrency(dispute.expected_amount)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-700 mb-1">Description</p>
                <p className="text-sm text-slate-600">{dispute.description}</p>
              </div>
            </div>

            {/* Resolution Type */}
            <div className="space-y-2">
              <Label>Resolution Type</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={resolution === 'resolved' ? 'default' : 'outline'}
                  onClick={() => setResolution('resolved')}
                  className={resolution === 'resolved' ? 'bg-emerald-600' : ''}
                >
                  Resolve
                </Button>
                <Button
                  type="button"
                  variant={resolution === 'rejected' ? 'default' : 'outline'}
                  onClick={() => setResolution('rejected')}
                  className={resolution === 'rejected' ? 'bg-rose-600' : ''}
                >
                  Reject
                </Button>
              </div>
            </div>

            {/* Resolution Notes */}
            <div className="space-y-2">
              <Label>Resolution Notes (Required)</Label>
              <Textarea
                placeholder="Explain your decision and any actions taken..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="h-24"
                required
              />
            </div>

            {/* Create Adjustment */}
            {resolution === 'resolved' && (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg bg-indigo-50">
                  <div>
                    <p className="font-medium text-indigo-900">Create Adjustment</p>
                    <p className="text-sm text-indigo-700">Issue a tip correction for this employee</p>
                  </div>
                  <Switch checked={createAdjustment} onCheckedChange={setCreateAdjustment} />
                </div>

                {createAdjustment && (
                  <div className="space-y-2 pl-4 border-l-2 border-indigo-200">
                    <Label>Adjustment Amount (£)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="10.50"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      required={createAdjustment}
                    />
                    <p className="text-xs text-slate-500">
                      Use positive values for additions, negative for deductions
                    </p>
                  </div>
                )}
              </>
            )}

            {resolution === 'rejected' && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <strong>Rejecting a dispute:</strong> Make sure to provide clear reasoning in your notes. 
                  The employee will be notified of the decision.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={resolveMutation.isPending || !resolutionNotes}
              className={resolution === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
            >
              {resolveMutation.isPending ? 'Processing...' : `${resolution === 'resolved' ? 'Resolve' : 'Reject'} Dispute`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}