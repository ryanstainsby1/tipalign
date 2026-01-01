import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Shield, 
  Bell, 
  Users,
  Key,
  Copy,
  Plus,
  MoreVertical,
  Upload,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AddUserModal from '@/components/settings/AddUserModal';
import CreateAPIKeyModal from '@/components/settings/CreateAPIKeyModal';
import ChangeRoleModal from '@/components/settings/ChangeRoleModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleDefinitionsOpen, setRoleDefinitionsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: squareConnections = [] } = useQuery({
    queryKey: ['squareConnection'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return await base44.entities.SquareConnection.filter({
        organization_id: user.organization_id || user.id
      });
    },
  });

  const squareConnection = squareConnections.find(c => c.connection_status === 'connected');

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      return await base44.entities.User.list('-created_date', 100);
    },
  });

  const menuItems = [
    { id: 'profile', label: 'Organization Profile', icon: Building2 },
    { id: 'users', label: 'Users & Permissions', icon: Users },
    { id: 'api', label: 'API Credentials', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const mockAPIKeys = [
    { 
      name: 'Production API Key', 
      key: 'sk_live_abc123...xyz789',
      created: '2025-12-01',
      lastUsed: '2025-12-28',
      id: 1 
    },
  ];

  const [notifications, setNotifications] = useState({
    dailySummary: true,
    allocationDisputes: true,
    hmrcAlerts: true,
    failedSyncs: true,
    payrollExports: true
  });

  const handleAddUser = async (userData) => {
    try {
      await base44.users.inviteUser(userData.email, userData.role);
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('User invited successfully', {
        description: `Invitation sent to ${userData.email}`
      });
    } catch (error) {
      toast.error('Failed to invite user: ' + error.message);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await base44.entities.User.update(userId, { role: newRole });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('User role updated successfully');
    } catch (error) {
      toast.error('Failed to update role: ' + error.message);
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await base44.entities.User.delete(userId);
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('User removed successfully');
    } catch (error) {
      toast.error('Failed to remove user: ' + error.message);
    }
  };

  const handleGenerateAPIKey = (keyData) => {
    toast.success('API key created successfully');
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const handleSaveProfile = () => {
    toast.success('Profile updated successfully');
  };

  const handleToggleNotification = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('Notification preferences updated');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
            Settings
          </h1>
          <p className="text-slate-600 text-lg">Manage your organization and platform preferences</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1 sticky top-8">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left
                      transition-all duration-150
                      ${activeSection === item.id
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Organization Profile */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Organization Profile</CardTitle>
                    <CardDescription>Your business information and branding</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label>Merchant Name</Label>
                      <Input 
                        defaultValue={squareConnection?.merchant_business_name || 'Demo Restaurant'}
                        disabled
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">Auto-filled from Square</p>
                    </div>

                    <div>
                      <Label>Business Address</Label>
                      <Input 
                        defaultValue="123 High Street, London, UK"
                        disabled
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">Auto-filled from Square</p>
                    </div>

                    <div>
                      <Label>Locations Managed</Label>
                      <Input 
                        defaultValue={`${locations.length} locations`}
                        disabled
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">Auto-filled from Square</p>
                    </div>

                    <div>
                      <Label>Company Logo</Label>
                      <div className="mt-2 flex items-center gap-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-10 h-10 text-slate-400" />
                        </div>
                        <Button variant="outline">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload New Logo
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Timezone</Label>
                      <Select defaultValue="europe-london">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="europe-london">Europe/London (GMT)</SelectItem>
                          <SelectItem value="europe-paris">Europe/Paris (CET)</SelectItem>
                          <SelectItem value="america-new-york">America/New York (EST)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleSaveProfile} className="bg-indigo-600 hover:bg-indigo-700">
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Users & Permissions */}
            {activeSection === 'users' && (
              <div className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Team Access</CardTitle>
                        <CardDescription>Manage who can access Tiply and what they can do</CardDescription>
                      </div>
                      <Button onClick={() => setShowAddUser(true)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add User
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Last Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allUsers.map(user => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name || 'Pending'}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                                user.role === 'user' ? 'bg-slate-100 text-slate-700' : ''
                              }>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {user.updated_date ? format(new Date(user.updated_date), 'MMM d, yyyy') : 'Never'}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedUser(user);
                                    setShowChangeRole(true);
                                  }}>
                                    Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-rose-600"
                                    onClick={() => {
                                      if (confirm(`Remove ${user.email}?`)) {
                                        handleRemoveUser(user.id);
                                      }
                                    }}
                                  >
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Collapsible open={roleDefinitionsOpen} onOpenChange={setRoleDefinitionsOpen}>
                  <Card className="border-0 shadow-lg">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader>
                        <CardTitle className="text-left">Role Definitions</CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                          <h4 className="font-semibold text-indigo-900 mb-2">Admin</h4>
                          <p className="text-sm text-indigo-700">
                            Full access to all features including dashboard, allocations, locations, employees, compliance, payroll exports, and settings management.
                          </p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <h4 className="font-semibold text-amber-900 mb-2">Staff</h4>
                          <p className="text-sm text-amber-700">
                            Limited to Employee Portal only. Can view their own tips, allocations, and tip history. Cannot access admin features.
                          </p>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            )}

            {/* API Credentials */}
            {activeSection === 'api' && (
              <div className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>API Keys</CardTitle>
                        <CardDescription>For advanced integrations with external systems</CardDescription>
                      </div>
                      <Button onClick={() => setShowCreateKey(true)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mockAPIKeys.map(apiKey => (
                        <div key={apiKey.id} className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h4 className="font-semibold text-slate-900">{apiKey.name}</h4>
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-700">
                                  Active
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mb-3">
                                <code className="text-sm bg-white px-3 py-1.5 rounded border border-slate-200">
                                  {apiKey.key}
                                </code>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleCopyKey(apiKey.key)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-slate-600">Created:</span>
                                  <span className="ml-2 text-slate-900">
                                    {format(new Date(apiKey.created), 'MMM d, yyyy')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-600">Last used:</span>
                                  <span className="ml-2 text-slate-900">
                                    {format(new Date(apiKey.lastUsed), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Regenerate</DropdownMenuItem>
                                <DropdownMenuItem className="text-rose-600">Revoke</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}

                      <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">API Documentation</h4>
                        <p className="text-sm text-blue-700 mb-3">
                          Use these keys to integrate Tiply with external systems. Keep your keys secure and never share them publicly.
                        </p>
                        <Button variant="outline" className="bg-white">
                          View API Docs
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Email Alerts</CardTitle>
                    <CardDescription>Configure when you receive email notifications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="flex items-start justify-between py-3 border-b border-slate-200">
                        <div>
                          <h4 className="font-medium text-slate-900 mb-1">Daily Summary</h4>
                          <p className="text-sm text-slate-600">
                            Receive a daily email with tips, allocations, and sync status
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.dailySummary}
                          onCheckedChange={() => handleToggleNotification('dailySummary')}
                        />
                      </div>

                      <div className="flex items-start justify-between py-3 border-b border-slate-200">
                        <div>
                          <h4 className="font-medium text-slate-900 mb-1">Allocation Disputes</h4>
                          <p className="text-sm text-slate-600">
                            Get notified when an employee files a dispute
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.allocationDisputes}
                          onCheckedChange={() => handleToggleNotification('allocationDisputes')}
                        />
                      </div>

                      <div className="flex items-start justify-between py-3 border-b border-slate-200">
                        <div>
                          <h4 className="font-medium text-slate-900 mb-1">HMRC Alerts</h4>
                          <p className="text-sm text-slate-600">
                            Important notifications when compliance status changes
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.hmrcAlerts}
                          onCheckedChange={() => handleToggleNotification('hmrcAlerts')}
                        />
                      </div>

                      <div className="flex items-start justify-between py-3 border-b border-slate-200">
                        <div>
                          <h4 className="font-medium text-slate-900 mb-1">Failed Syncs</h4>
                          <p className="text-sm text-slate-600">
                            Alert when Square data sync encounters an error
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.failedSyncs}
                          onCheckedChange={() => handleToggleNotification('failedSyncs')}
                        />
                      </div>

                      <div className="flex items-start justify-between py-3">
                        <div>
                          <h4 className="font-medium text-slate-900 mb-1">Payroll Exports</h4>
                          <p className="text-sm text-slate-600">
                            Confirmation emails when payroll exports are completed
                          </p>
                        </div>
                        <Switch 
                          checked={notifications.payrollExports}
                          onCheckedChange={() => handleToggleNotification('payrollExports')}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>

      <AddUserModal
        open={showAddUser}
        onClose={() => setShowAddUser(false)}
        onAdd={handleAddUser}
      />

      <CreateAPIKeyModal
        open={showCreateKey}
        onClose={() => setShowCreateKey(false)}
        onGenerate={handleGenerateAPIKey}
      />

      <ChangeRoleModal
        open={showChangeRole}
        onClose={() => {
          setShowChangeRole(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onUpdate={handleChangeRole}
      />
    </div>
  );
}