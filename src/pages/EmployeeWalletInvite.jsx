import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, XCircle, Download } from 'lucide-react';

export default function EmployeeWalletInvite() {
  const { invite_token } = useParams();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    validateAndProcessInvite();
  }, [invite_token]);

  const validateAndProcessInvite = async () => {
    try {
      const response = await base44.functions.invoke('validateWalletInvite', {
        invite_token
      });

      if (response.data.valid) {
        setInvite(response.data.invite);
        
        // If iOS, auto-redirect to .pkpass download
        if (/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())) {
          setTimeout(() => {
            window.location.href = response.data.pass_url;
          }, 1500);
        }
      } else {
        setError(response.data.error || 'Invalid or expired invite');
      }
    } catch (err) {
      setError('Failed to validate invite');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-rose-600" />
            </div>
            <CardTitle className="text-xl">Invite Expired</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-600 mb-4">
              {error}
            </p>
            <p className="text-sm text-slate-500">
              Please ask your manager to send a new wallet invite link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isIOS && invite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download className="w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Adding to Wallet...</h2>
            <p className="text-slate-600">
              Your Tiply pass is being prepared. The Wallet app will open automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-indigo-600" />
          </div>
          <CardTitle className="text-xl">Open on iPhone</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-slate-600">
            To add your Tiply pass to Apple Wallet, please open this email on your iPhone and tap the 
            <strong> "Add to Apple Wallet"</strong> button.
          </p>
          
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600 mb-3">
              Or scan this QR code with your iPhone camera:
            </p>
            <div className="flex justify-center">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invite?.invite_url || '')}`}
                alt="QR Code"
                className="w-48 h-48"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Apple Wallet is only available on iPhone and iPad
          </p>
        </CardContent>
      </Card>
    </div>
  );
}