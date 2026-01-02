import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Building2, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';

export default function OnboardingEmployer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organizationName, setOrganizationName] = useState('');
  const [creating, setCreating] = useState(false);

  React.useEffect(() => {
    checkExistingOrg();
  }, []);

  const checkExistingOrg = async () => {
    try {
      const user = await base44.auth.me();
      
      // Check if user has owner/admin membership
      const memberships = await base44.entities.UserOrganizationMembership.filter({
        user_id: user.id,
        status: 'active'
      });

      const ownerOrAdminMembership = memberships.find(m => 
        m.membership_role === 'owner' || m.membership_role === 'admin'
      );

      if (ownerOrAdminMembership) {
        // Has org membership, check Square connection
        const connections = await base44.entities.SquareConnection.filter({
          organization_id: ownerOrAdminMembership.organization_id,
          connection_status: 'connected'
        });

        if (connections.length > 0) {
          // Has active Square connection - go to dashboard
          navigate(createPageUrl('Dashboard'));
          return;
        }
        
        // Has org but no Square - go to connect step
        navigate(createPageUrl('OnboardingConnectSquare'));
        return;
      }

      setLoading(false);
    } catch (error) {
      toast.error('Failed to check organization status');
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!organizationName.trim()) {
      toast.error('Please enter an organization name');
      return;
    }

    setCreating(true);
    try {
      const response = await base44.functions.invoke('createOrganization', {
        name: organizationName
      });

      if (response.data.success) {
        navigate(createPageUrl('OnboardingConnectSquare'));
      } else {
        toast.error(response.data.error || 'Failed to create organization');
      }
    } catch (error) {
      toast.error('Failed to create organization: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Create Your Organization</h1>
          <p className="text-xl text-slate-600">Let's get your business set up on Tiply</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-6">
              <div>
                <Label htmlFor="orgName">Business Name</Label>
                <Input
                  id="orgName"
                  placeholder="e.g., The Coffee Shop"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="mt-2"
                />
                <p className="text-sm text-slate-500 mt-2">
                  This will be displayed to your employees
                </p>
              </div>

              <Button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={creating}
                size="lg"
              >
                {creating ? 'Creating...' : 'Continue'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-200">
          <h3 className="font-semibold text-slate-900 mb-2">Next Steps</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>1. Create your organization</li>
            <li>2. Connect your Square account</li>
            <li>3. Sync your locations and team</li>
            <li>4. Start managing tips!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}