import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    dailySummary: true,
    disputes: true,
    hmrcAlerts: true,
    failedSyncs: true,
    payrollExports: true
  });

  const handleToggle = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    toast.success('Notification preferences updated');
  };

  const notificationOptions = [
    {
      key: 'dailySummary',
      label: 'Daily Summary',
      description: 'Tips, allocations, and sync status summary'
    },
    {
      key: 'disputes',
      label: 'Allocation Disputes',
      description: 'Email when a dispute is filed by an employee'
    },
    {
      key: 'hmrcAlerts',
      label: 'HMRC Alerts',
      description: 'When compliance status changes'
    },
    {
      key: 'failedSyncs',
      label: 'Failed Syncs',
      description: 'Email if Square sync fails'
    },
    {
      key: 'payrollExports',
      label: 'Payroll Exports',
      description: 'Email when export is completed'
    }
  ];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Bell className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle>Email Alerts</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Configure email notifications</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {notificationOptions.map(option => (
          <div key={option.key} className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
            <div className="flex-1">
              <Label htmlFor={option.key} className="text-base font-semibold text-slate-900 cursor-pointer">
                {option.label}
              </Label>
              <p className="text-sm text-slate-600 mt-1">{option.description}</p>
            </div>
            <Switch
              id={option.key}
              checked={notifications[option.key]}
              onCheckedChange={() => handleToggle(option.key)}
            />
          </div>
        ))}

        <Button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700">
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}