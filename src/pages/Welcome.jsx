import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Welcome() {
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          navigate(createPageUrl('Dashboard'));
        }
      } catch (error) {
        // Not authenticated, stay on signup page
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Register the user account
      const response = await fetch(`${import.meta.env.VITE_BASE44_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.contactName,
          role: 'admin'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      // Login after registration
      const loginResponse = await fetch(`${import.meta.env.VITE_BASE44_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      if (!loginResponse.ok) {
        throw new Error('Login failed after registration');
      }

      // Create organization record
      await base44.entities.Organization.create({
        name: formData.businessName,
        primary_contact_name: formData.contactName,
        primary_contact_email: formData.email,
        primary_contact_phone: formData.phone,
        subscription_tier: 'trial',
        subscription_status: 'active',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        settings: {
          currency: 'GBP',
          auto_sync_enabled: true,
          sync_frequency: 'daily'
        }
      });

      toast.success('Account created! Connect your Square account to get started.');
      navigate(createPageUrl('Dashboard'));
    } catch (error) {
      toast.error(error.message || 'Failed to create account');
      setLoading(false);
    }
  };

  const features = [
    'Automatic Square integration',
    'Real-time tip tracking',
    'HMRC compliance built-in',
    'Employee self-service portal',
    'Payroll export ready',
    '30-day free trial'
  ];

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69492be29f510e4f29fe435b/01bc0fe1b_ChatGPTImageDec28202501_53_32PM.png" 
              alt="Tiply"
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            Start Managing Tips with Tiply
          </h1>
          <p className="text-xl text-slate-600">
            Digital tip management for hospitality businesses
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Signup Form */}
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle>Create Your Account</CardTitle>
              <CardDescription>Get started with your 30-day free trial</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Google SSO Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 text-base border-2 hover:bg-slate-50"
                  onClick={() => base44.auth.redirectToLogin(createPageUrl('Welcome'))}
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500">Or sign up with email</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => setFormData(f => ({ ...f, businessName: e.target.value }))}
                    placeholder="The Coffee House"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="contactName">Your Name *</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData(f => ({ ...f, contactName: e.target.value }))}
                    placeholder="John Smith"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="john@coffeehouse.com"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+44 20 1234 5678"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">Minimum 8 characters</p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                  {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
                </Button>

                <p className="text-sm text-center text-slate-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => base44.auth.redirectToLogin()}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="space-y-6">
            <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <CardContent className="p-8">
                <Building2 className="w-12 h-12 mb-4" />
                <h3 className="text-2xl font-bold mb-3">
                  Everything You Need to Manage Tips
                </h3>
                <p className="text-indigo-100 mb-6">
                  Tiply integrates directly with Square to automate tip tracking, allocation, and compliance reporting.
                </p>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                      <span className="text-white">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h4 className="font-semibold text-slate-900 mb-2">What happens next?</h4>
                <ol className="space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <span className="font-semibold text-indigo-600">1.</span>
                    Create your account above
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-indigo-600">2.</span>
                    Connect your Square account (takes 2 minutes)
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-indigo-600">3.</span>
                    We automatically sync your locations, employees, and tips
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-indigo-600">4.</span>
                    Start managing tips with full transparency
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}