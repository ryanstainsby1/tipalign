import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Download, FileSpreadsheet, Shield, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function PayrollExportModal({ 
  open, 
  onClose, 
  locations = [],
  onExport,
  isExporting = false 
}) {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(1)),
    to: new Date()
  });
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeHmrc, setIncludeHmrc] = useState(true);

  const formatOptions = [
    { value: 'csv', label: 'CSV (Universal)', icon: FileSpreadsheet },
    { value: 'sage', label: 'Sage Payroll', icon: FileSpreadsheet },
    { value: 'xero', label: 'Xero', icon: FileSpreadsheet },
    { value: 'quickbooks', label: 'QuickBooks', icon: FileSpreadsheet },
    { value: 'hmrc_fps', label: 'HMRC FPS', icon: Shield }
  ];

  const handleExport = () => {
    onExport?.({
      period_start: format(dateRange.from, 'yyyy-MM-dd'),
      period_end: format(dateRange.to, 'yyyy-MM-dd'),
      location_id: selectedLocation,
      export_format: exportFormat,
      include_hmrc_data: includeHmrc
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Download className="w-5 h-5 text-indigo-600" />
            Export Payroll Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pay Period</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                  />
                </PopoverContent>
              </Popover>
              <span className="flex items-center text-slate-400">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, 'dd MMM yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Location</Label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Export Format */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {formatOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExportFormat(opt.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    exportFormat === opt.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <opt.icon className={`w-4 h-4 ${
                      exportFormat === opt.value ? 'text-indigo-600' : 'text-slate-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      exportFormat === opt.value ? 'text-indigo-700' : 'text-slate-700'
                    }`}>
                      {opt.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Compliance Badge */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">HMRC Compliant Export</p>
                <p className="text-xs text-emerald-700 mt-1">
                  All exports include PAYE allocation data and audit trail references required for HMRC inspection.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleExport}
            disabled={isExporting}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isExporting ? 'Generating...' : 'Generate Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}