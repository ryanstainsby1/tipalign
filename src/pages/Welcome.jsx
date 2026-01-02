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