import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle } from 'lucide-react';

export default function DisputeModal({ allocation, open, onClose, onSubmit }) {
  const [disputeReason, setDisputeReason] = useState('too_low');
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    onSubmit({
      allocation_id: allocation?.id,
      reason: disputeReason,
      details,
    });
    setDetails('');
    onClose();
  };

  const reasons = [
    { value: 'too_low', label: 'Amount seems too low' },
    { value: 'too_high', label: 'Amount seems too high' },
    { value: 'wrong_person', label: 'This was meant for someone else' },
    { value: 'not_recorded', label: 'Tips not recorded correctly' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Tell us what seems wrong with this allocation. We'll review it and get back to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {allocation && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Allocation Amount</p>
                  <p className="font-semibold text-slate-900">
                    £{(allocation.gross_amount / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Shift Date</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(allocation.allocation_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="mb-3 block">What's the issue?</Label>
            <RadioGroup value={disputeReason} onValueChange={setDisputeReason}>
              <div className="space-y-3">
                {reasons.map((reason) => (
                  <div key={reason.value} className="flex items-center gap-3">
                    <RadioGroupItem value={reason.value} id={reason.value} />
                    <Label htmlFor={reason.value} className="font-normal cursor-pointer">
                      {reason.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="details" className="mb-2 block">
              Additional details (optional)
            </Label>
            <Textarea
              id="details"
              placeholder="Tell us more about the issue..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-amber-600 hover:bg-amber-700">
              Submit Issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}