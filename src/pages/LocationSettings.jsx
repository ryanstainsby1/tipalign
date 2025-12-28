import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Save, Users, Terminal, Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AllocationRuleBuilder from '@/components/allocation/AllocationRuleBuilder';
import { Skeleton } from "@/components/ui/skeleton";

export default function LocationSettings() {
  const urlParams = new URLSearchParams(window.location.search);
  const locationId = urlParams.get('id');
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const { data: location, isLoading } = useQuery({
    queryKey: ['location', locationId],
    queryFn: async () => {
      const locations = await base44.entities.Location.filter({ id: locationId });
      return locations[0];
    },
    enabled: !!locationId,
  });

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    tronc_enabled: false,
    tronc_master_email: '',
    payroll_export_format: 'csv'
  });

  useEffect(() => {
    if (location) {
      setFormData({
        name: location.name || '',
        address: location.address || '',
        tronc_enabled: location.tronc_enabled || false,
        tronc_master_email: location.tronc_master_email || '',
        payroll_export_format: location.payroll_export_format || 'csv'
      });
    }
  }, [location]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Location.update(locationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location', locationId] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    },
  });

  const handleSaveBasic = () => {
    updateMutation.mutate({
      name: formData.name,
      address: formData.address,
      tronc_enabled: formData.tronc_enabled,
      tronc_master_email: formData.tronc_master_email,
      payroll_export_format: formData.payroll_export_format
    });
  };

  const handleSaveRules = (rules) => {
    updateMutation.mutate(rules);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-900 mb-2">Location not found</p>
          <Link to={createPageUrl('Locations')}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Locations
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to={createPageUrl('Locations')}
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Locations
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{location.name}</h1>
              <p className="text-slate-500">
                {location.address && typeof location.address === 'object'
                  ? `${location.address.line1 || ''}${location.address.city ? ', ' + location.address.city : ''}`.trim() || 'No address set'
                  : location.address || 'No address set'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Terminal className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{location.terminals_count || 0}</p>
                  <p className="text-sm text-slate-500">Terminals</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">Active</p>
                  <p className="text-sm text-slate-500">Status</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <Badge variant="outline" className={
                  location.tip_policy === 'pooled' ? 'bg-purple-50 text-purple-700' :
                  location.tip_policy === 'weighted' ? 'bg-amber-50 text-amber-700' :
                  'bg-blue-50 text-blue-700'
                }>
                  {location.tip_policy || 'Individual'} Tips
                </Badge>
                <p className="text-sm text-slate-500 mt-2">Current Policy</p>
              </CardContent>
            </Card>
          </div>

          {/* Basic Settings */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Location Details</CardTitle>
              <CardDescription>Basic information about this venue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location Name</Label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input 
                    value={formData.address}
                    onChange={(e) => setFormData(f => ({ ...f, address: e.target.value }))}
                    placeholder="123 High Street, London"
                  />
                </div>
              </div>

              {/* Tronc Settings */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-medium text-slate-700">Tronc Scheme</p>
                    <p className="text-sm text-slate-500">Enable independent tronc master for NI exemption</p>
                  </div>
                  <Switch 
                    checked={formData.tronc_enabled}
                    onCheckedChange={(v) => setFormData(f => ({ ...f, tronc_enabled: v }))}
                  />
                </div>
                
                {formData.tronc_enabled && (
                  <div className="space-y-2 pl-4 border-l-2 border-indigo-200">
                    <Label>Tronc Master Email</Label>
                    <Input 
                      type="email"
                      value={formData.tronc_master_email}
                      onChange={(e) => setFormData(f => ({ ...f, tronc_master_email: e.target.value }))}
                      placeholder="troncmaster@example.com"
                    />
                    <p className="text-xs text-slate-500">
                      The tronc master must be independent and not involved in allocation decisions
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={handleSaveBasic}
                  disabled={updateMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Details'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Allocation Rules - Link to Builder */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Tip Allocation Rules</CardTitle>
              <CardDescription>Configure how tips are distributed at this location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">Rules Builder</p>
                  <p className="text-sm text-slate-500">Design allocation policies with versioning and preview</p>
                </div>
                <Button
                  onClick={() => navigate(createPageUrl('RulesBuilder') + `?location=${locationId}`)}
                  variant="outline"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Rules
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}