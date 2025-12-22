import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Download, 
  FileText, 
  CalendarIcon, 
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';

export default function Exports() {
  const [periodStart, setPeriodStart] = useState(null);
  const [periodEnd, setPeriodEnd] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [exportFormat, setExportFormat] = useState('csv');
  const queryClient = useQueryClient();

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const { data: exportRuns = [], isLoading } = useQuery({
    queryKey: ['exportRuns'],
    queryFn: () => base44.entities.ExportRun.list('-created_date', 50),
  });

  const generatePayrollMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generatePayrollExport', {
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        location_ids: selectedLocations,
        export_format: exportFormat
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exportRuns'] });
      queryClient.invalidateQueries({ queryKey: ['allocationBatches'] });
      
      // Download CSV
      if (data.csv_content) {
        const blob = new Blob([data.csv_content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll_export_${format(periodStart, 'yyyy-MM-dd')}_${format(periodEnd, 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    }
  });

  const generateAuditPackMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateHMRCAuditPack', {
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        location_ids: selectedLocations
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Download HTML
      if (data.html_content) {
        const blob = new Blob([data.html_content], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hmrc_audit_pack_${format(periodStart, 'yyyy-MM-dd')}_${format(periodEnd, 'yyyy-MM-dd')}.html`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    }
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const canGenerate = periodStart && periodEnd;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Payroll Exports</h1>
          <p className="text-slate-500 mt-1">Generate payroll files and HMRC compliance reports</p>
        </div>

        {/* Export Configuration */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle>Generate New Export</CardTitle>
            <CardDescription>Select period and locations for payroll export</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-indigo-200 bg-indigo-50">
              <Shield className="w-4 h-4 text-indigo-600" />
              <AlertDescription className="text-indigo-900">
                <strong>Export locks allocations:</strong> Batches included in an export will be marked as exported and locked. 
                Only adjustments can modify them afterwards.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Period Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodStart ? format(periodStart, 'PPP') : 'Select start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={periodStart}
                      onSelect={setPeriodStart}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Period End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodEnd ? format(periodEnd, 'PPP') : 'Select end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={periodEnd}
                      onSelect={setPeriodEnd}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Locations (leave empty for all)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {locations.map(location => (
                  <label key={location.id} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(location.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLocations([...selectedLocations, location.id]);
                        } else {
                          setSelectedLocations(selectedLocations.filter(id => id !== location.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">{location.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => generatePayrollMutation.mutate()}
                disabled={!canGenerate || generatePayrollMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {generatePayrollMutation.isPending ? 'Generating...' : 'Generate Payroll CSV'}
              </Button>
              <Button
                onClick={() => generateAuditPackMutation.mutate()}
                disabled={!canGenerate || generateAuditPackMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-2" />
                {generateAuditPackMutation.isPending ? 'Generating...' : 'Generate HMRC Audit Pack'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export History */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>Previous payroll exports and compliance reports</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : exportRuns.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No exports yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generated</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead className="text-right">Total Tips</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportRuns.map(run => (
                    <TableRow key={run.id}>
                      <TableCell>{format(new Date(run.created_date), 'dd MMM yyyy HH:mm')}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(run.period_start), 'dd MMM')} - {format(new Date(run.period_end), 'dd MMM')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {run.export_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="uppercase text-xs font-medium">{run.export_format}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(run.total_tips_exported)}
                      </TableCell>
                      <TableCell className="text-right">{run.employee_count}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            run.status === 'ready' ? 'bg-emerald-50 text-emerald-700' :
                            run.status === 'error' ? 'bg-rose-50 text-rose-700' :
                            'bg-slate-50 text-slate-700'
                          }
                        >
                          {run.status === 'ready' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {run.status === 'error' && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{run.generated_by_email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}