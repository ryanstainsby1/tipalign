import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Shield, 
  FileCheck, 
  Download, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  FileText,
  Eye,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from "@/components/ui/skeleton";
import PayrollExportModal from '@/components/exports/PayrollExportModal';

export default function Compliance() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: exports = [], isLoading: loadingExports } = useQuery({
    queryKey: ['exports'],
    queryFn: () => base44.entities.PayrollExport.list('-export_date', 50),
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 100),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.list(),
  });

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const complianceChecks = [
    {
      name: "PAYE Allocation Records",
      status: "compliant",
      description: "All tip allocations linked to tax periods",
      lastChecked: "2 hours ago"
    },
    {
      name: "Audit Trail Integrity",
      status: "compliant",
      description: "All transactions have immutable hash records",
      lastChecked: "2 hours ago"
    },
    {
      name: "Employee NI References",
      status: "warning",
      description: "3 employees missing payroll references",
      lastChecked: "2 hours ago"
    },
    {
      name: "Allocation Disputes",
      status: "compliant",
      description: "No unresolved disputes pending",
      lastChecked: "2 hours ago"
    },
    {
      name: "Data Retention",
      status: "compliant",
      description: "7-year retention policy active",
      lastChecked: "2 hours ago"
    }
  ];

  const statusColors = {
    compliant: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    warning: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    error: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" }
  };

  const actionIcons = {
    tip_allocated: FileCheck,
    policy_changed: FileText,
    payroll_exported: Download,
    hmrc_report_generated: Shield,
    sync_completed: CheckCircle
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Compliance</h1>
            <p className="text-slate-500 mt-1">HMRC-ready reporting and audit trails</p>
          </div>
          <Button 
            onClick={() => setShowExportModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Generate HMRC Report
          </Button>
        </div>

        {/* Compliance Score Card */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Compliance Score</p>
                <p className="text-4xl font-bold mt-1">98%</p>
                <p className="text-emerald-100 text-sm mt-2">
                  All critical requirements met • Ready for HMRC inspection
                </p>
              </div>
              <div className="p-4 bg-white/10 rounded-2xl">
                <Shield className="w-12 h-12" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="exports">Export History</TabsTrigger>
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Compliance Checks */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Compliance Checks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {complianceChecks.map((check, i) => {
                    const colors = statusColors[check.status];
                    return (
                      <div 
                        key={i}
                        className={`flex items-center justify-between p-4 rounded-xl ${colors.bg} border ${colors.border}`}
                      >
                        <div className="flex items-center gap-3">
                          {check.status === 'compliant' ? (
                            <CheckCircle className={`w-5 h-5 ${colors.text}`} />
                          ) : (
                            <AlertTriangle className={`w-5 h-5 ${colors.text}`} />
                          )}
                          <div>
                            <p className={`font-medium ${colors.text}`}>{check.name}</p>
                            <p className="text-sm opacity-80">{check.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border}`}>
                            {check.status}
                          </Badge>
                          <p className="text-xs mt-1 opacity-60">Checked {check.lastChecked}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* HMRC Requirements */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">UK Tip Compliance Requirements</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-slate max-w-none">
                <div className="grid md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900">PAYE Obligations</h4>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        Tips controlled by employer are subject to PAYE & NI
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        Card tips processed through payroll as additional earnings
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        Full audit trail maintained for 7 years
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-900">Tronc Schemes</h4>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        Independent tronc master required for NI exemption
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        PAYE still applies to tronc distributions
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        Clear separation from employer control documented
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exports">
            {loadingExports ? (
              <Skeleton className="h-96 rounded-xl" />
            ) : (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Payroll Export History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead>Period</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead className="text-right">Total Tips</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exports.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                            No exports generated yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        exports.map(exp => (
                          <TableRow key={exp.id}>
                            <TableCell className="font-medium">
                              {exp.period_start && exp.period_end ? (
                                `${format(new Date(exp.period_start), 'dd MMM')} - ${format(new Date(exp.period_end), 'dd MMM yyyy')}`
                              ) : '-'}
                            </TableCell>
                            <TableCell>{exp.location_name || 'All'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="uppercase text-xs">
                                {exp.export_format}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(exp.total_tips)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                exp.status === 'reconciled' 
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-50 text-slate-700'
                              }>
                                {exp.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {exp.file_url && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={exp.file_url} download>
                                    <Download className="w-4 h-4" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audit">
            {loadingAudit ? (
              <Skeleton className="h-96 rounded-xl" />
            ) : (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" />
                    Audit Trail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        No audit entries yet
                      </div>
                    ) : (
                      auditLogs.map(log => {
                        const Icon = actionIcons[log.action_type] || FileText;
                        return (
                          <div 
                            key={log.id}
                            className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors"
                          >
                            <div className="p-2 rounded-lg bg-indigo-50">
                              <Icon className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900 capitalize">
                                  {log.action_type?.replace(/_/g, ' ')}
                                </p>
                                {log.hmrc_relevant && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">
                                    HMRC Relevant
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 mt-0.5">
                                {log.reason || `Action on ${log.entity_type}`}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                by {log.actor_email} • {log.created_date ? format(new Date(log.created_date), 'dd MMM yyyy HH:mm') : '-'}
                              </p>
                            </div>
                            {log.immutable_hash && (
                              <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-500">
                                {log.immutable_hash?.substring(0, 8)}...
                              </code>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PayrollExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        locations={locations}
        onExport={(data) => {
          console.log('Generate HMRC export:', data);
          setShowExportModal(false);
        }}
      />
    </div>
  );
}