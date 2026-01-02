import React from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';

export default function OnboardingConnectSquare() {
  const navigate = useNavigate();
  const [connecting, setConnecting] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    checkSquareStatus();

    // Check URL params for Square connection callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('square_connected') === '1') {
      toast.success('Square connected successfully! Redirecting to dashboard...');
      setTimeout(() => navigate(createPageUrl('Dashboard')), 1500);
    }
  }, []);

  const checkSquareStatus = async () => {
    try {
      const user = await base44.auth.me();
      const memberships = await base44.entities.UserOrganizationMembership.filter({
        user_id: user.id,
        status: 'active'
      });

      if (memberships.length > 0) {
        const orgs = await base44.entities.Organization.filter({ 
          id: memberships[0].organization_id 
        });
        
        if (orgs[0]?.square_merchant_id) {
          // Already connected
          navigate(createPageUrl('Dashboard'));
          return;
        }
      }

      setChecking(false);
    } catch (error) {
      setChecking(false);
    }
  };

  const handleConnectSquare = async () => {
    setConnecting(true);
    try {
      const response = await base44.functions.invoke('squareOAuthStart', {});
      if (response.data.success && response.data.redirect_url) {
        window.location.href = response.data.redirect_url;
      } else {
        toast.error('Failed to start Square connection');
        setConnecting(false);
      }
    } catch (error) {
      toast.error('Connection failed: ' + error.message);
      setConnecting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Checking status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-2xl mx-auto px-4 py-20">
        <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
          <CardContent className="p-10">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </div>
              <h1 className="text-3xl font-bold mb-4">Connect Your Square Account</h1>
              <p className="text-slate-300 text-lg">
                Link your Square account to automatically sync transactions, employees, and locations
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-slate-200">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Automatic transaction syncing</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Team member management</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Location data sync</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Real-time webhook updates</span>
              </div>
            </div>

            <Button
              onClick={handleConnectSquare}
              disabled={connecting}
              className="w-full bg-white text-slate-900 hover:bg-slate-50 shadow-xl"
              size="lg"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Connecting to Square...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                  Connect Square Account
                </>
              )}
            </Button>

            <p className="text-center text-slate-400 text-sm mt-6">
              Secure OAuth 2.0 authentication • Your credentials are never stored
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}