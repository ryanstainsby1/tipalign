import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, QrCode, RefreshCw, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function WalletPassSection({ employee, walletPass, onRefresh }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePass = async () => {
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('issueEmployeeWalletPass', {
        employee_id: employee.id
      });

      if (response.data.success) {
        toast.success('Apple Wallet pass generated', {
          description: response.data.is_new_pass ? 'New pass created' : 'Existing pass retrieved'
        });
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      toast.error('Failed to generate wallet pass', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenPass = () => {
    if (walletPass) {
      const passUrl = `${window.location.origin}/functions/employeeWalletPass?serial=${walletPass.pass_serial_number}&auth=${walletPass.pass_auth_token}`;
      window.open(passUrl, '_blank');
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              Mobile Wallet
            </CardTitle>
            <CardDescription>
              Apple Wallet pass for real-time tip tracking
            </CardDescription>
          </div>
          {walletPass && (
            <Badge className="bg-emerald-100 text-emerald-700">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!walletPass ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">No wallet pass yet</h3>
            <p className="text-sm text-slate-600 mb-4">
              Generate an Apple Wallet pass so {employee.full_name} can track tips on their phone
            </p>
            <Button 
              onClick={handleGeneratePass}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Generate Apple Wallet Pass
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pass Info */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Serial Number:</span>
                  <p className="font-mono text-xs text-slate-900 mt-1">
                    {walletPass.pass_serial_number.substring(0, 8)}...
                  </p>
                </div>
                <div>
                  <span className="text-slate-600">Last Updated:</span>
                  <p className="text-slate-900 mt-1">
                    {walletPass.last_pass_update_at 
                      ? format(new Date(walletPass.last_pass_update_at), 'MMM d, yyyy')
                      : 'Never'
                    }
                  </p>
                </div>
                <div>
                  <span className="text-slate-600">Current Period Tips:</span>
                  <p className="text-lg font-bold text-indigo-600 mt-1">
                    £{((walletPass.last_tip_total || 0) / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-600">Status:</span>
                  <p className="text-slate-900 mt-1 capitalize">{walletPass.pass_status}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                onClick={handleOpenPass}
                variant="outline"
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Pass JSON
              </Button>
              <Button 
                onClick={handleGeneratePass}
                disabled={isGenerating}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>

            {/* QR Code for Tipping */}
            {walletPass.last_qr_url && (
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg">
                    <QrCode className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-indigo-900 mb-1">Tipping QR Code</h4>
                    <p className="text-sm text-indigo-700 mb-2">
                      Customers can scan this to leave a tip directly to {employee.full_name}
                    </p>
                    <code className="text-xs bg-white px-2 py-1 rounded border border-indigo-200 break-all">
                      {walletPass.last_qr_url}
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* Setup Note */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> Full Apple Wallet integration requires Apple Developer certificates. 
                Contact your administrator to complete setup.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}