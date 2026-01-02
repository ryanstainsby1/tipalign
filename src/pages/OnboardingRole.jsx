import React from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Building2, Users, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from 'sonner';

export default function OnboardingRole() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [selecting, setSelecting] = React.useState(false);

  React.useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      const user = await base44.auth.me();
      
      // Check if already set up as employer
      if (user.role_type === 'employer') {
        const memberships = await base44.entities.UserOrganizationMembership.filter({
          user_id: user.id,
          membership_role: ['owner', 'admin'],
          status: 'active'
        });
        if (memberships.length > 0) {
          navigate(createPageUrl('Dashboard'));
          return;
        }
      }

      // Check if already set up as employee
      if (user.role_type === 'employee') {
        const links = await base44.entities.SquareTeamMemberLink.filter({
          user_id: user.id,
          link_status: 'linked'
        });
        if (links.length > 0) {
          navigate(createPageUrl('EmployeePortal'));
          return;
        }
      }

      setLoading(false);
    } catch (error) {
      toast.error('Failed to check user status');
      setLoading(false);
    }
  };

  const handleSelectRole = async (role) => {
    setSelecting(true);
    try {
      await base44.auth.updateMe({ role_type: role });
      
      if (role === 'employer') {
        navigate(createPageUrl('OnboardingEmployer'));
      } else {
        navigate(createPageUrl('OnboardingEmployee'));
      }
    } catch (error) {
      toast.error('Failed to set role');
      setSelecting(false);
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
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Welcome to Tiply</h1>
          <p className="text-xl text-slate-600">How will you be using Tiply?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Employer Card */}
          <Card className="border-2 hover:border-indigo-500 transition-all cursor-pointer group" onClick={() => !selecting && handleSelectRole('employer')}>
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors">
                <Building2 className="w-8 h-8 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">I'm an Employer</h2>
              <p className="text-slate-600 mb-6">
                I manage a business and want to distribute tips to my team through Square
              </p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li>✓ Connect your Square account</li>
                <li>✓ Manage locations and staff</li>
                <li>✓ Automate tip allocation</li>
                <li>✓ Export payroll data</li>
              </ul>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={selecting}
              >
                Continue as Employer
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Employee Card */}
          <Card className="border-2 hover:border-emerald-500 transition-all cursor-pointer group" onClick={() => !selecting && handleSelectRole('employee')}>
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 transition-colors">
                <Users className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">I'm an Employee</h2>
              <p className="text-slate-600 mb-6">
                I work at a business that uses Tiply and want to view my tips
              </p>
              <ul className="space-y-2 text-sm text-slate-600 mb-6">
                <li>✓ View your tip history</li>
                <li>✓ Track monthly earnings</li>
                <li>✓ Download statements</li>
                <li>✓ Raise disputes if needed</li>
              </ul>
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={selecting}
              >
                Continue as Employee
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}