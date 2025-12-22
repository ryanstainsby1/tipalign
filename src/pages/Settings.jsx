import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Shield, 
  Bell, 
  Link2,
  CheckCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import AllocationRuleBuilder from '@/components/allocation/AllocationRuleBuilder';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSquareConnected, setIsSquareConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const [selectedLocation, setSelectedLocation] = useState(null);

  const handleSync = async () => {
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsSyncing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-slate-500 mt-1">Configure your tip management platform</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1">
            <TabsTrigger value="general" className="gap-2">
              <SettingsIcon className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Link2 className="w-4 h-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="allocation" className="gap-2">
              <Building2 className="w-4 h-4" />
              Allocation Rules
            </TabsTrigger>
            <TabsTrigger value="compliance" className="gap-2">
              <Shield className="w-4 h-4" />
              Compliance
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Your organization details for HMRC reporting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input defaultValue="Demo Restaurant Group" />
                  </div>
                  <div className="space-y-2">
                    <Label>PAYE Reference</Label>
                    <Input placeholder="123/AB45678" />
                  </div>
                  <div className="space-y-2">
                    <Label>Accounts Office Reference</Label>
                    <Input placeholder="123PA00012345" />
                  </div>
                  <div className="space-y-2">
                    <Label>Primary Contact Email</Label>
                    <Input type="email" defaultValue="finance@demo.com" />
                  </div>
                </div>
                <div className="pt-4">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure alerts and reminders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Daily tip summary email", enabled: true },
                  { label: "Pending allocation reminders", enabled: true },
                  { label: "Payroll export due alerts", enabled: true },
                  { label: "Compliance check notifications", enabled: false },
                  { label: "Employee dispute alerts", enabled: true }
                ].map((notification, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-slate-700">{notification.label}</span>
                    <Switch defaultChecked={notification.enabled} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Square Integration
                  {isSquareConnected && (
                    <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge>
                  )}
                </CardTitle>
                <CardDescription>Sync transactions, employees, and locations from Square</CardDescription>
              </CardHeader>
              <CardContent>
                {isSquareConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="font-medium text-emerald-900">Connected to Square</p>
                          <p className="text-sm text-emerald-700">Merchant: Demo Restaurant Group</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="border-emerald-300"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                      </Button>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-slate-50">
                        <p className="text-2xl font-bold text-slate-900">127</p>
                        <p className="text-sm text-slate-500">Transactions synced today</p>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-50">
                        <p className="text-2xl font-bold text-slate-900">24</p>
                        <p className="text-sm text-slate-500">Team members synced</p>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-50">
                        <p className="text-2xl font-bold text-slate-900">3</p>
                        <p className="text-sm text-slate-500">Locations connected</p>
                      </div>
                    </div>

                    <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50">
                      Disconnect Square
                    </Button>
                  </div>
                ) : (
                  <Button className="bg-slate-900 hover:bg-slate-800">
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect with Square
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Payroll Integration</CardTitle>
                <CardDescription>Connect to your payroll provider for automatic exports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { name: 'Sage', connected: false },
                    { name: 'Xero', connected: false },
                    { name: 'QuickBooks', connected: false },
                    { name: 'Custom API', connected: false }
                  ].map(provider => (
                    <div key={provider.name} className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
                      <span className="font-medium text-slate-700">{provider.name}</span>
                      <Button variant="outline" size="sm">
                        Connect
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Allocation Rules */}
          <TabsContent value="allocation" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Default Allocation Rules</CardTitle>
                <CardDescription>Set company-wide defaults (can be overridden per location)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <Label className="text-sm font-medium">Select Location to Configure</Label>
                  <Select 
                    value={selectedLocation?.id || 'default'} 
                    onValueChange={(v) => setSelectedLocation(v === 'default' ? null : locations.find(l => l.id === v))}
                  >
                    <SelectTrigger className="mt-2 w-full max-w-xs">
                      <SelectValue placeholder="Default (All Locations)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (All Locations)</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <AllocationRuleBuilder
              initialPolicy={selectedLocation?.tip_policy || 'individual'}
              initialWeights={selectedLocation?.role_weights || {}}
              onSave={(data) => console.log('Save allocation rules:', data)}
            />
          </TabsContent>

          {/* Compliance Settings */}
          <TabsContent value="compliance" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>HMRC Configuration</CardTitle>
                <CardDescription>Settings for UK tax compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tax Year</Label>
                  <Select defaultValue="2024-25">
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024-25">2024-25</SelectItem>
                      <SelectItem value="2023-24">2023-24</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-700">Tronc Scheme</p>
                    <p className="text-sm text-slate-500">Enable independent tronc master allocation</p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-700">Automatic PAYE Period Assignment</p>
                    <p className="text-sm text-slate-500">Assign tax periods to allocations automatically</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-700">Audit Hash Generation</p>
                    <p className="text-sm text-slate-500">Generate immutable hashes for all transactions</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Data Retention</CardTitle>
                <CardDescription>Configure how long records are stored</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Retention Period</Label>
                  <Select defaultValue="7">
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 years (HMRC required)</SelectItem>
                      <SelectItem value="10">10 years</SelectItem>
                      <SelectItem value="indefinite">Indefinite</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    HMRC requires employers to keep payroll records for at least 3 years after the tax year they relate to. We recommend 7 years for full compliance.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}