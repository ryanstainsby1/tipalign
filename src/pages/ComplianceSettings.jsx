import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Shield, FileCheck, Download, AlertCircle, CheckCircle2, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ComplianceSettings() {
  const queryClient = useQueryClient();
  const [allocationMethod, setAllocationMethod] = useState('pooled');
  const [auditLoggingEnabled, setAuditLoggingEnabled] = useState(false);
  const [payrollSystem, setPayrollSystem] = useState('csv');
  const [taxRate, setTaxRate] = useState('20');
  const [niTreatment, setNiTreatment] = useState('employee_gratuity');
  const [exportDateRange, setExportDateRange] = useState({ from: null, to: null });

  const { data: organization } = useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const orgs = await base44.entities.Organization.filter({ 
        created_by: user.email 
      });
      return orgs[0];
    }
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['audit-events'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 100)
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (settings) => {
      if (!organization) return;
      await base44.entities.Organization.update(organization.id, {
        settings: {
          ...organization.settings,
          ...settings
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['organization']);
      toast.success('Settings saved successfully');
    },
    onError: () => {
      toast.error('Failed to save settings');
    }
  });

  const handleSaveAllocationRules = () => {
    saveSettingsMutation.mutate({
      allocation_method: allocationMethod
    });
  };

  const handleToggleAuditLogging = (enabled) => {
    setAuditLoggingEnabled(enabled);
    saveSettingsMutation.mutate({
      audit_logging_enabled: enabled
    });
  };

  const handleExport = async (type) => {
    try {
      let filename = '';
      let data = [];

      switch (type) {
        case 'audit':
          filename = `audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`;
          data = auditEvents.map(e => ({
            timestamp: e.created_date,
            action: e.action_type,
            entity: e.entity_type,
            actor: e.actor_email,
            changes: e.changes_summary
          }));
          break;
        case 'ledger':
          filename = `tip-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
          const allocations = await base44.entities.TipAllocation.list();
          data = allocations.map(a => ({
            date: a.allocation_date,
            employee: a.employee_id,
            amount: a.gross_amount / 100,
            method: a.allocation_method
          }));
          break;
        case 'payroll':
          filename = `payroll-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`;
          const employees = await base44.entities.Employee.list();
          data = employees.map(e => ({
            name: e.full_name,
            total_tips: (e.total_tips_current_tax_year || 0) / 100,
            pending: (e.pending_tips || 0) / 100
          }));
          break;
      }

      const csv = [
        Object.keys(data[0] || {}).join(','),
        ...data.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Export complete');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
            Compliance Settings
          </h1>
          <p className="text-slate-600 text-lg">
            Configure allocation rules and enable audit logging for HMRC compliance
          </p>
        </div>

        <div className="space-y-8">
          {/* Section 1: Allocation Rules */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Shield className="w-5 h-5 text-indigo-600" />
                </div>
                Configure Tip Allocation Rules
              </CardTitle>
              <CardDescription>
                Choose how tips are distributed among your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={allocationMethod} onValueChange={setAllocationMethod}>
                <div className="space-y-4">
                  {/* Individual Allocation */}
                  <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl opacity-50 cursor-not-allowed">
                    <RadioGroupItem value="individual" id="individual" disabled />
                    <div className="flex-1">
                      <Label htmlFor="individual" className="text-base font-semibold text-slate-900">
                        Individual Allocation
                      </Label>
                      <p className="text-sm text-slate-600 mt-1">
                        Tips go to the person who processed the card transaction
                      </p>
                      <Badge variant="outline" className="mt-2 text-slate-500">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Requires POS integration
                      </Badge>
                    </div>
                  </div>

                  {/* Pooled Allocation */}
                  <div className="flex items-start gap-4 p-4 border-2 border-indigo-200 rounded-xl bg-indigo-50/50">
                    <RadioGroupItem value="pooled" id="pooled" />
                    <div className="flex-1">
                      <Label htmlFor="pooled" className="text-base font-semibold text-slate-900">
                        Pooled Allocation
                      </Label>
                      <p className="text-sm text-slate-600 mt-1">
                        All tips for a shift go into a common pool, divided equally among team members working that shift
                      </p>
                      <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Available now
                      </Badge>
                    </div>
                  </div>

                  {/* Role-Weighted */}
                  <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors">
                    <RadioGroupItem value="role_weighted" id="role_weighted" />
                    <div className="flex-1">
                      <Label htmlFor="role_weighted" className="text-base font-semibold text-slate-900">
                        Role-Weighted Allocation
                      </Label>
                      <p className="text-sm text-slate-600 mt-1">
                        Tips distributed by job role (e.g., 50% server, 30% busser, 20% manager)
                      </p>
                      <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Available now
                      </Badge>
                    </div>
                  </div>

                  {/* Shift-Based */}
                  <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors">
                    <RadioGroupItem value="shift_based" id="shift_based" />
                    <div className="flex-1">
                      <Label htmlFor="shift_based" className="text-base font-semibold text-slate-900">
                        Shift-Based Allocation
                      </Label>
                      <p className="text-sm text-slate-600 mt-1">
                        Tips allocated by hours worked during the shift
                      </p>
                      <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Available now
                      </Badge>
                    </div>
                  </div>
                </div>
              </RadioGroup>

              <Button 
                onClick={handleSaveAllocationRules}
                className="mt-6 bg-indigo-600 hover:bg-indigo-700"
                disabled={saveSettingsMutation.isPending}
              >
                Apply Allocation Rules
              </Button>
            </CardContent>
          </Card>

          {/* Section 2: Audit Logging */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                </div>
                Enable Audit Trail
              </CardTitle>
              <CardDescription>
                Maintain an immutable log of all tip allocations for HMRC inspection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex-1">
                  <Label htmlFor="audit-toggle" className="text-base font-semibold text-slate-900">
                    Enable Automatic Audit Logging
                  </Label>
                  <p className="text-sm text-slate-600 mt-1">
                    {auditLoggingEnabled 
                      ? 'Audit events are being recorded for every tip allocation'
                      : 'Turn on to start recording audit events for HMRC compliance'
                    }
                  </p>
                </div>
                <Switch 
                  id="audit-toggle"
                  checked={auditLoggingEnabled}
                  onCheckedChange={handleToggleAuditLogging}
                />
              </div>

              {auditLoggingEnabled && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-900">
                      Audit events: {auditEvents.length} recorded
                    </span>
                    {auditEvents.length > 0 && (
                      <span className="text-sm text-slate-600">
                        Last: {format(new Date(auditEvents[0].created_date), 'PPp')}
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2">
                    View Audit Log
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Payroll Integration */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Download className="w-5 h-5 text-amber-600" />
                </div>
                Payroll System Setup
              </CardTitle>
              <CardDescription>
                Export tip data to your payroll system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payroll-system">Select Payroll System</Label>
                  <Select value={payrollSystem} onValueChange={setPayrollSystem}>
                    <SelectTrigger id="payroll-system" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sage50">Sage 50</SelectItem>
                      <SelectItem value="csv">CSV Export (Manual)</SelectItem>
                      <SelectItem value="gusto">Gusto</SelectItem>
                      <SelectItem value="xero">Xero</SelectItem>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {payrollSystem !== 'csv' && payrollSystem !== 'manual' && (
                  <div>
                    <Label htmlFor="api-key">API Key / Credentials</Label>
                    <Input 
                      id="api-key" 
                      type="password" 
                      placeholder="Enter API key"
                      className="mt-2"
                    />
                    <Button variant="outline" className="mt-3" size="sm">
                      Test Connection
                    </Button>
                  </div>
                )}

                <div>
                  <Label htmlFor="export-frequency">Export Frequency</Label>
                  <Select defaultValue="monthly">
                    <SelectTrigger id="export-frequency" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: UK Tax Compliance */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <Shield className="w-5 h-5 text-rose-600" />
                </div>
                UK Tax & NI Configuration
              </CardTitle>
              <CardDescription>
                Ensure tips are correctly categorized for payroll tax
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="tax-rate">Employee Tax Rate (%)</Label>
                  <Input 
                    id="tax-rate" 
                    type="number" 
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="ni-treatment">National Insurance Treatment</Label>
                  <Select value={niTreatment} onValueChange={setNiTreatment}>
                    <SelectTrigger id="ni-treatment" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee_gratuity">Employee tips (gratuity)</SelectItem>
                      <SelectItem value="tronc">Tronc scheme</SelectItem>
                      <SelectItem value="service_charge">Service charge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="threshold">Tip Bonus/Gratuity Threshold (£/month)</Label>
                  <Input 
                    id="threshold" 
                    type="number" 
                    placeholder="500"
                    className="mt-2"
                  />
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-slate-700 mb-3">
                    Tips are subject to PAYE and NI. Tiply ensures HMRC-compliant reporting.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href="https://www.gov.uk/guidance/tipping-and-service-charges" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      Review HMRC Guidance
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Data Export */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Download className="w-5 h-5 text-purple-600" />
                </div>
                Generate Compliance Reports
              </CardTitle>
              <CardDescription>
                Export data for audit purposes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date Range (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full mt-2 justify-start">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {exportDateRange.from ? (
                            exportDateRange.to ? (
                              <>
                                {format(exportDateRange.from, 'PP')} - {format(exportDateRange.to, 'PP')}
                              </>
                            ) : (
                              format(exportDateRange.from, 'PP')
                            )
                          ) : (
                            'Select date range'
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={exportDateRange}
                          onSelect={setExportDateRange}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => handleExport('audit')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Audit Trail
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => handleExport('ledger')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Tip Ledger
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => handleExport('payroll')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Payroll Summary
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}