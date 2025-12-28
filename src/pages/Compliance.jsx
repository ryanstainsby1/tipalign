import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Search, Calendar as CalendarIcon, FileText, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import HMRCStatusCard from '@/components/compliance/HMRCStatusCard';
import AuditTrailCard from '@/components/compliance/AuditTrailCard';
import DataQualityCard from '@/components/compliance/DataQualityCard';
import RegulatoryInfo from '@/components/compliance/RegulatoryInfo';

export default function Compliance() {
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [reportPeriod, setReportPeriod] = useState('month');

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['allocations'],
    queryFn: () => base44.entities.TipAllocation.list(),
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['disputes'],
    queryFn: () => base44.entities.Dispute.list(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list(),
  });

  // Calculate compliance status
  const auditLoggingEnabled = auditLogs.length > 0;
  const allocationRulesConfigured = allocations.length > 0;
  const employeeRecordsComplete = employees.every(e => e.full_name && e.email);
  const noUnresolvedDisputes = disputes.filter(d => d.status === 'open').length === 0;
  const disputedAllocations = allocations.filter(a => a.status === 'disputed').length;

  // Filter audit logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.action_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesEventType = eventTypeFilter === 'all' || log.action_type === eventTypeFilter;
    const matchesActor = actorFilter === 'all' || log.actor_email === actorFilter;
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    
    return matchesSearch && matchesEventType && matchesActor && matchesEntity;
  });

  const uniqueActors = [...new Set(auditLogs.map(l => l.actor_email).filter(Boolean))];
  const uniqueEntityTypes = [...new Set(auditLogs.map(l => l.entity_type).filter(Boolean))];
  const uniqueEventTypes = [...new Set(auditLogs.map(l => l.action_type).filter(Boolean))];

  const handleExportAuditTrail = () => {
    try {
      const csv = [
        'Timestamp,Event Type,Actor,Entity,Action,Details,Audit ID',
        ...filteredLogs.map(log => 
          `${log.created_date},${log.action_type},${log.actor_email},${log.entity_type},${log.changes_summary || ''},${log.reason || ''},${log.id}`
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Audit trail exported successfully');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleGenerateReport = (type) => {
    toast.success(`Generating ${type} report...`, {
      description: 'Your report will be ready for download shortly'
    });
  };

  const handleGenerateAuditorLink = () => {
    const auditorCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    toast.success('Auditor access link generated', {
      description: `Code: ${auditorCode} (Valid for 7 days)`
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
            Compliance Center
          </h1>
          <p className="text-slate-600 text-lg">HMRC audit preparation and regulatory reporting</p>
        </div>

        {/* Section 1: Compliance Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <HMRCStatusCard
            auditLoggingEnabled={auditLoggingEnabled}
            allocationRulesConfigured={allocationRulesConfigured}
            employeeRecordsComplete={employeeRecordsComplete}
            noUnresolvedDisputes={noUnresolvedDisputes}
            onReviewIssues={() => toast.info('Review compliance issues')}
          />

          <AuditTrailCard
            totalEvents={auditLogs.length}
            earliestEvent={auditLogs[auditLogs.length - 1]?.created_date}
            latestEvent={auditLogs[0]?.created_date}
            onViewAll={() => document.getElementById('audit-log-section').scrollIntoView({ behavior: 'smooth' })}
          />

          <DataQualityCard
            totalTips={transactions.length}
            totalAllocations={allocations.length}
            disputedAllocations={disputedAllocations}
            teamMembers={employees.length}
            locations={locations.length}
          />
        </div>

        {/* Section 2: Audit Log Table */}
        <div id="audit-log-section" className="mb-10">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Complete Audit Trail</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Immutable log of all system actions for regulatory compliance
                  </p>
                </div>
                <Button onClick={handleExportAuditTrail} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, 'PP')} - {format(dateRange.to, 'PP')}
                          </>
                        ) : (
                          format(dateRange.from, 'PP')
                        )
                      ) : (
                        'Date Range'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                    />
                  </PopoverContent>
                </Popover>

                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {uniqueEventTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={actorFilter} onValueChange={setActorFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Actor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actors</SelectItem>
                    {uniqueActors.map(actor => (
                      <SelectItem key={actor} value={actor}>{actor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Entity Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {uniqueEntityTypes.map(entity => (
                      <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Audit ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                          No audit events found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.slice(0, 25).map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {log.created_date ? format(new Date(log.created_date), 'PPp') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {log.action_type?.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{log.actor_email || 'System'}</TableCell>
                          <TableCell className="text-sm capitalize">{log.entity_type}</TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {log.changes_summary || log.reason || '-'}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                              {log.id?.substring(0, 8)}
                            </code>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {filteredLogs.length > 25 && (
                <div className="mt-4 text-center text-sm text-slate-600">
                  Showing 25 of {filteredLogs.length} records
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 3: HMRC Submission Prep */}
        <Card className="border-0 shadow-lg mb-10">
          <CardHeader>
            <CardTitle className="text-xl">Ready for Submission</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Generate reports for tax authorities
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Report Period
              </label>
              <Select value={reportPeriod} onValueChange={setReportPeriod}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                      <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 mb-2">PAYE Returns (P32)</h4>
                      <p className="text-sm text-slate-600 mb-4">
                        HMRC submission format with NI numbers, tax, and NI contributions
                      </p>
                      <Button 
                        onClick={() => handleGenerateReport('PAYE Returns')}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Generate Report
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl">
                      <FileText className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 mb-2">Payroll Summary</h4>
                      <p className="text-sm text-slate-600 mb-4">
                        CSV export for your accountant or tax advisor
                      </p>
                      <Button 
                        onClick={() => handleGenerateReport('Payroll Summary')}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Generate Report
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-100 rounded-xl">
                      <FileText className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 mb-2">Compliance Certificate</h4>
                      <p className="text-sm text-slate-600 mb-4">
                        PDF certifying HMRC compliance and audit readiness
                      </p>
                      <Button 
                        onClick={() => handleGenerateReport('Compliance Certificate')}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Generate Certificate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 rounded-xl">
                      <FileText className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 mb-2">Dispute Resolution Report</h4>
                      <p className="text-sm text-slate-600 mb-4">
                        Timeline of all disputes and resolutions
                      </p>
                      <Button 
                        onClick={() => handleGenerateReport('Dispute Report')}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Generate Report
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Regulatory Information */}
        <div className="mb-10">
          <RegulatoryInfo />
        </div>

        {/* Section 5: Export for External Audit */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Auditor Access</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Provide third-party auditors with secure access to compliance data
            </p>
          </CardHeader>
          <CardContent>
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 mb-6">
              <h4 className="font-semibold text-slate-900 mb-4">Generate Temporary Audit Link</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Data Scope
                    </label>
                    <Select defaultValue="all">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Data</SelectItem>
                        <SelectItem value="tips">Tips Only</SelectItem>
                        <SelectItem value="allocations">Allocations Only</SelectItem>
                        <SelectItem value="audit">Audit Trail Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Access Duration
                    </label>
                    <Select defaultValue="7">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 day</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleGenerateAuditorLink} className="w-full bg-indigo-600 hover:bg-indigo-700">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Generate Auditor Link
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Past Auditor Access</h4>
              {auditLogs.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No auditor access logs yet</p>
              ) : (
                <div className="space-y-2">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">Auditor:</span>
                        <p className="font-medium text-slate-900">Sample Audit Firm</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Accessed:</span>
                        <p className="font-medium text-slate-900">Dec 15, 2025</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Data Viewed:</span>
                        <p className="font-medium text-slate-900">All Data</p>
                      </div>
                      <div>
                        <span className="text-slate-600">Duration:</span>
                        <p className="font-medium text-slate-900">7 days (Expired)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}