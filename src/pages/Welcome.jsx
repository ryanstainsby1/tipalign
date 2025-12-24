import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowRight, Building2, Users, PieChart, Shield, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function Welcome() {
  const [connecting, setConnecting] = useState(false);

  const { data: squareConnections = [], isLoading } = useQuery({
    queryKey: ['squareConnection'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SquareConnection.filter({
        organization_id: user.organization_id || user.id
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('squareOAuthStart', {});
      return response.data;
    },
    onSuccess: (data) => {
      if (data.redirect_url) {
        setConnecting(true);
        window.location.href = data.redirect_url;
      }
    },
    onError: (error) => {
      toast.error('Connection failed: ' + error.message);
    }
  });

  const hasConnection = squareConnections.some(c => c.connection_status === 'connected');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (hasConnection) {
    window.location.href = createPageUrl('Dashboard');
    return null;
  }

  const features = [
    {
      icon: Building2,
      title: 'Sync Square Data',
      description: 'Automatically import locations, employees, and transactions'
    },
    {
      icon: Users,
      title: 'Manage Staff',
      description: 'Track employee tips and working hours in real-time'
    },
    {
      icon: PieChart,
      title: 'Allocate Tips',
      description: 'Flexible pooling, weighted, and individual allocation methods'
    },
    {
      icon: Shield,
      title: 'HMRC Compliant',
      description: 'Full audit trail and payroll export for UK tax compliance'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">T</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">TipFlow</h1>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to TipFlow</h2>
          <p className="text-lg text-slate-600">Your comprehensive tip management platform for UK hospitality</p>
        </div>

        {/* Main CTA */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                  <Badge className="bg-emerald-500 text-white border-0">Required</Badge>
                </div>
                <h3 className="text-2xl font-bold mb-2">Connect Your Square Account</h3>
                <p className="text-slate-300 mb-4">
                  Securely link TipFlow to your Square POS to begin syncing transactions, locations, and staff data.
                </p>
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending || connecting}
                  className="bg-white text-slate-900 hover:bg-slate-100"
                  size="lg"
                >
                  {connectMutation.isPending || connecting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect with Square
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
              <div className="hidden md:flex gap-4">
                <div className="text-center p-4 rounded-xl bg-white/10">
                  <div className="text-3xl font-bold">OAuth 2.0</div>
                  <div className="text-xs text-slate-300">Secure</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/10">
                  <div className="text-3xl font-bold">2-Min</div>
                  <div className="text-xs text-slate-300">Setup</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {features.map((feature, idx) => (
            <Card key={idx} className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-lg bg-indigo-100">
                    <feature.icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="mt-1">{feature.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* What Happens Next */}
        <Card className="border-0 shadow-sm bg-indigo-50">
          <CardHeader>
            <CardTitle className="text-lg text-indigo-900">What happens after you connect?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'TipFlow will securely authenticate with your Square account',
              'Your locations, team members, and payment devices will be synced',
              'Recent transactions and tips will be imported',
              'You can start allocating tips to your staff immediately'
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                <p className="text-slate-700">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}