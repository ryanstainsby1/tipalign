import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, MoreVertical, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function UsersPermissions() {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'staff', sendEmail: true });

  const users = [
    { name: 'Admin User', email: 'admin@demo.com', role: 'admin', lastActive: new Date() },
    { name: 'Manager Jane', email: 'jane@demo.com', role: 'manager', lastActive: new Date() },
  ];

  const roleDefinitions = [
    { role: 'Admin', permissions: 'Full access, can manage users and settings' },
    { role: 'Manager', permissions: 'Can view all locations, approve allocations, export payroll' },
    { role: 'Staff', permissions: 'Can view own tips only (Employee Portal)' }
  ];

  const handleAddUser = () => {
    toast.success('Invitation sent to ' + newUser.email);
    setShowAddUserModal(false);
    setNewUser({ email: '', role: 'staff', sendEmail: true });
  };

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Access</CardTitle>
              <p className="text-sm text-slate-600 mt-1">Manage who can access Tiply and what they can do</p>
            </div>
            <Button onClick={() => setShowAddUserModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <UserPlus className="w-4 h-4 mr-2" />
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
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-0' :
                      user.role === 'manager' ? 'bg-blue-100 text-blue-700 border-0' :
                      'bg-slate-100 text-slate-700 border-0'
                    }>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {format(user.lastActive, 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6 pt-6 border-t">
            <button
              onClick={() => setShowRoleInfo(!showRoleInfo)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Role Definitions
              <ChevronDown className={`w-4 h-4 transition-transform ${showRoleInfo ? 'rotate-180' : ''}`} />
            </button>
            
            {showRoleInfo && (
              <div className="mt-4 space-y-3">
                {roleDefinitions.map((def, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-semibold text-slate-900">{def.role}</p>
                    <p className="text-sm text-slate-600 mt-1">{def.permissions}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Invite a new user to access Tiply</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(role) => setNewUser({ ...newUser, role })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                checked={newUser.sendEmail}
                onCheckedChange={(checked) => setNewUser({ ...newUser, sendEmail: checked })}
                id="sendEmail"
              />
              <Label htmlFor="sendEmail" className="cursor-pointer">
                Send invitation email
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} className="bg-indigo-600 hover:bg-indigo-700">
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}