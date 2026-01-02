import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';

export default function OnboardingEmployee() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [matches, setMatches] = useState([]);
  const [showMatches, setShowMatches] = useState(false);

  React.useEffect(() => {
    checkExistingLink();
  }, []);

  const checkExistingLink = async () => {
    try {
      const user = await base44.auth.me();
      setEmail(user.email);

      // Check if already linked
      const links = await base44.entities.SquareTeamMemberLink.filter({
        user_id: user.id,
        link_status: 'linked'
      });

      if (links.length > 0) {
        navigate(createPageUrl('EmployeePortal'));
        return;
      }

      setLoading(false);
    } catch (error) {
      toast.error('Failed to check link status');
      setLoading(false);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    setLinking(true);

    try {
      const response = await base44.functions.invoke('linkEmployeeAccount', {
        email: email
      });

      if (response.data.success) {
        if (response.data.linked) {
          toast.success('Account linked successfully!');
          navigate(createPageUrl('EmployeePortal'));
        } else if (response.data.matches?.length > 1) {
          setMatches(response.data.matches);
          setShowMatches(true);
        }
      } else {
        toast.error(response.data.error || 'Failed to link account');
      }
    } catch (error) {
      toast.error('Failed to link account: ' + error.message);
    } finally {
      setLinking(false);
    }
  };

  const handleSelectOrg = async (match) => {
    setLinking(true);
    try {
      const response = await base44.functions.invoke('linkEmployeeAccount', {
        email: email,
        organization_id: match.organization_id,
        employee_id: match.employee_id
      });

      if (response.data.success) {
        toast.success('Account linked successfully!');
        navigate(createPageUrl('EmployeePortal'));
      } else {
        toast.error(response.data.error || 'Failed to link account');
      }
    } catch (error) {
      toast.error('Failed to link account: ' + error.message);
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading...</div>
      </div>
    );
  }

  if (showMatches) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="max-w-2xl mx-auto px-4 py-20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-4">Multiple Matches Found</h1>
            <p className="text-slate-600">Select your organization</p>
          </div>

          <div className="space-y-4">
            {matches.map((match, idx) => (
              <Card key={idx} className="border-2 hover:border-emerald-500 transition-all cursor-pointer" onClick={() => !linking && handleSelectOrg(match)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{match.organization_name}</h3>
                      <p className="text-sm text-slate-600">{match.employee_name}</p>
                      {match.location_name && (
                        <p className="text-xs text-slate-500 mt-1">Location: {match.location_name}</p>
                      )}
                    </div>
                    <CheckCircle className="w-6 h-6 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Link Your Employee Account</h1>
          <p className="text-xl text-slate-600">We'll match you with your employer's Square team data</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Confirm Your Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLink} className="space-y-6">
              <div>
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2"
                  placeholder="your.email@company.com"
                />
                <p className="text-sm text-slate-500 mt-2">
                  This should match the email your employer has on file in Square
                </p>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>Important:</strong> You must be added as a team member in Square by your employer before you can link your account.
                </AlertDescription>
              </Alert>

              <Button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={linking}
                size="lg"
              >
                {linking ? 'Searching...' : 'Link My Account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 p-6 bg-amber-50 rounded-xl border border-amber-200">
          <h3 className="font-semibold text-slate-900 mb-2">Can't find your account?</h3>
          <p className="text-sm text-slate-600 mb-3">
            If you see an error, ask your employer to:
          </p>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>1. Add you as a team member in their Square dashboard</li>
            <li>2. Run a sync in Tiply to import the latest team data</li>
            <li>3. Confirm your email matches what's in Square</li>
          </ul>
        </div>
      </div>
    </div>
  );
}