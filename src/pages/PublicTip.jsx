import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Heart, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function PublicTip() {
  const { employee_id, pass_serial } = useParams();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);

  const presetAmounts = [2, 5, 10, 20];

  useEffect(() => {
    loadEmployee();
  }, [employee_id, pass_serial]);

  const loadEmployee = async () => {
    try {
      // Validate employee and pass
      const response = await base44.functions.invoke('validateTipAccess', {
        employee_id,
        pass_serial
      });

      if (response.data.valid) {
        setEmployee(response.data.employee);
        // Track wallet pass opened
        base44.functions.invoke('trackWalletEvent', {
          event: 'wallet_pass_opened',
          employee_id,
          pass_serial
        }).catch(console.error);
      } else {
        setError(response.data.error || 'Invalid tipping link');
      }
    } catch (err) {
      setError('Failed to load employee information');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmount = (value) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const getTipAmount = () => {
    if (selectedAmount) return selectedAmount;
    if (customAmount) return parseFloat(customAmount);
    return 0;
  };

  const handleSubmitTip = async () => {
    const amount = getTipAmount();
    
    if (amount < 1 || amount > 200) {
      toast.error('Please enter an amount between £1 and £200');
      return;
    }

    setProcessing(true);

    try {
      // Track tip started
      await base44.functions.invoke('trackWalletEvent', {
        event: 'wallet_tip_started',
        employee_id,
        pass_serial,
        amount: Math.round(amount * 100)
      });

      // Create Square payment intent
      const response = await base44.functions.invoke('createTipPaymentIntent', {
        employee_id,
        pass_serial,
        amount: Math.round(amount * 100),
        note: note.trim(),
        source: 'wallet_pass'
      });

      if (response.data.success) {
        // In production, redirect to Square payment page or initialize Square Web SDK
        const paymentUrl = response.data.payment_url;
        
        // For demo: simulate successful payment
        setTimeout(async () => {
          await base44.functions.invoke('completeTipPayment', {
            payment_id: response.data.payment_id,
            employee_id,
            pass_serial
          });
          
          setCompleted(true);
          setProcessing(false);

          // Track completion
          await base44.functions.invoke('trackWalletEvent', {
            event: 'wallet_tip_completed',
            employee_id,
            pass_serial,
            amount: Math.round(amount * 100)
          });
        }, 2000);
      }
    } catch (err) {
      toast.error('Payment failed', {
        description: err.message
      });
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-rose-600 font-medium">{error || 'Invalid tipping link'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank you!</h2>
            <p className="text-slate-600 mb-1">
              Your £{getTipAmount().toFixed(2)} tip to {employee.full_name.split(' ')[0]} has been recorded.
            </p>
            <p className="text-sm text-slate-500">
              They'll receive it with their next allocation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <Avatar className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-500">
              <AvatarFallback className="bg-transparent text-white text-xl font-medium">
                {employee.full_name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl">
            Leave a tip for {employee.full_name.split(' ')[0]}
          </CardTitle>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="outline" className="capitalize">
              {employee.role}
            </Badge>
            {employee.locations?.[0] && (
              <Badge variant="outline">
                {employee.locations[0]}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Preset Amounts */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Select amount
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetAmounts.map(amount => (
                <Button
                  key={amount}
                  variant={selectedAmount === amount ? 'default' : 'outline'}
                  className={selectedAmount === amount ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                  onClick={() => handleAmountSelect(amount)}
                >
                  £{amount}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Or enter custom amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">£</span>
              <Input
                type="number"
                min="1"
                max="200"
                step="0.01"
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => handleCustomAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Add a message (optional)
            </label>
            <Textarea
              placeholder="Thanks for the great service!"
              value={note}
              onChange={(e) => setNote(e.target.value.substring(0, 140))}
              maxLength={140}
              rows={3}
            />
            <p className="text-xs text-slate-500 mt-1">
              {note.length}/140 characters
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmitTip}
            disabled={processing || getTipAmount() === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Heart className="w-5 h-5 mr-2" />
                Leave £{getTipAmount().toFixed(2)} Tip
              </>
            )}
          </Button>

          {/* Security Notice */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <Shield className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-600">
              Payments processed securely by Square. Tiply does not hold customer funds.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}