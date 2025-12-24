import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { format } from 'date-fns';

const syncFrequencyOptions = [
  { value: 'every_30_min', label: 'Every 30 minutes', hours: 0.5 },
  { value: 'hourly', label: 'Every hour', hours: 1 },
  { value: 'every_6_hours', label: 'Every 6 hours', hours: 6 },
  { value: 'daily', label: 'Once daily', hours: 24 }
];

export default function SyncScheduleConfig({ squareConnection }) {
  const queryClient = useQueryClient();

  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const orgs = await base44.entities.Organization.filter({
        id: user.organization_id || user.id
      });
      return orgs[0] || null;
    }
  });

  const settings = organization?.settings || {};
  const autoSyncEnabled = settings.auto_sync_enabled !== false;
  const syncFrequency = settings.sync_frequency || 'daily';

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings) => {
      return await base44.entities.Organization.update(organization.id, {
        settings: {
          ...settings,
          ...newSettings
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Sync settings updated');
    },
    onError: (error) => {
      toast.error('Failed to update settings: ' + error.message);
    }
  });

  const handleToggleAutoSync = (enabled) => {
    updateSettingsMutation.mutate({ auto_sync_enabled: enabled });
  };

  const handleFrequencyChange = (frequency) => {
    updateSettingsMutation.mutate({ sync_frequency: frequency });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-slate-200 rounded"></div>
        <div className="h-12 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (!squareConnection) {
    return (
      <Alert className="border-slate-200">
        <AlertCircle className="w-4 h-4 text-slate-500" />
        <AlertDescription className="text-slate-600">
          Connect to Square to enable automatic synchronization
        </AlertDescription>
      </Alert>
    );
  }

  const lastSync = squareConnection.last_sync_at 
    ? new Date(squareConnection.last_sync_at)
    : null;

  const selectedFrequency = syncFrequencyOptions.find(opt => opt.value === syncFrequency);
  const nextSyncEstimate = lastSync && selectedFrequency
    ? new Date(lastSync.getTime() + selectedFrequency.hours * 60 * 60 * 1000)
    : null;

  return (
    <div className="space-y-6">
      {/* Auto-sync toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${autoSyncEnabled ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            {autoSyncEnabled ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <Clock className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <p className="font-medium text-slate-900">Automatic Synchronization</p>
            <p className="text-sm text-slate-500">
              {autoSyncEnabled 
                ? `Active - Syncing ${selectedFrequency?.label.toLowerCase()}`
                : 'Disabled - Manual sync only'
              }
            </p>
          </div>
        </div>
        <Switch
          checked={autoSyncEnabled}
          onCheckedChange={handleToggleAutoSync}
          disabled={updateSettingsMutation.isPending}
        />
      </div>

      {/* Frequency selector */}
      {autoSyncEnabled && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Sync Frequency</Label>
          <Select 
            value={syncFrequency} 
            onValueChange={handleFrequencyChange}
            disabled={updateSettingsMutation.isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {syncFrequencyOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {lastSync && nextSyncEstimate && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              <span>
                Next sync estimated: {format(nextSyncEstimate, 'PPp')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Setup instructions */}
      {autoSyncEnabled && (
        <Alert className="border-indigo-200 bg-indigo-50">
          <Info className="w-4 h-4 text-indigo-600" />
          <AlertDescription className="text-indigo-900">
            <strong>Setup Required:</strong> To enable automatic syncing, set up a cron job to call:
            <code className="block mt-2 p-2 bg-white rounded text-xs font-mono">
              POST {window.location.origin}/api/scheduledSquareSync
            </code>
            <p className="mt-2 text-xs">
              Schedule this to run at your chosen frequency. The function will check if syncs are due based on your settings.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Last sync info */}
      {lastSync && (
        <div className="p-3 rounded-lg bg-slate-50 text-sm">
          <span className="text-slate-600">Last synced: </span>
          <span className="font-medium text-slate-900">
            {format(lastSync, 'PPp')}
          </span>
        </div>
      )}
    </div>
  );
}