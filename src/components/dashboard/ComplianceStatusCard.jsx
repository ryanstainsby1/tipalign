import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, FileCheck, Clock, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ComplianceStatusCard({ 
  hmrcReady, 
  auditProgress, 
  pendingAllocations,
  lastExport,
  onExport 
}) {
  const complianceItems = [
    {
      icon: Shield,
      title: "HMRC Ready",
      status: hmrcReady ? "Complete" : "Action required",
      statusColor: hmrcReady ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
      iconColor: hmrcReady ? "text-emerald-600" : "text-rose-600",
      description: hmrcReady 
        ? "All compliance requirements met" 
        : "Update allocation rules and complete audit trail",
      cta: { label: "Review Settings", link: createPageUrl('Settings') }
    },
    {
      icon: FileCheck,
      title: "Audit Trail",
      status: `${auditProgress}% complete`,
      statusColor: auditProgress === 100 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700",
      iconColor: auditProgress === 100 ? "text-emerald-600" : "text-slate-600",
      description: auditProgress === 100 
        ? "Full audit logging active for all allocations"
        : "Enable automatic audit logging for all tip allocations",
      cta: { label: "Setup Audit Trail", link: createPageUrl('Settings') }
    },
    {
      icon: Clock,
      title: "Pending Allocations",
      status: pendingAllocations === 0 ? "All clear" : `${pendingAllocations} awaiting review`,
      statusColor: pendingAllocations === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
      iconColor: pendingAllocations === 0 ? "text-emerald-600" : "text-amber-600",
      description: pendingAllocations === 0 
        ? "All allocations have been confirmed"
        : "Review and confirm pending tip allocations",
      cta: { label: "View Allocations", link: createPageUrl('Allocations') }
    },
    {
      icon: Download,
      title: "Last Export",
      status: lastExport || "No exports yet",
      statusColor: "bg-slate-100 text-slate-700",
      iconColor: "text-slate-600",
      description: "Export payroll data for integration with Sage 50 or your system",
      cta: { label: "Export Now", onClick: onExport }
    }
  ];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900">Compliance Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {complianceItems.map((item, index) => (
            <div key={index} className="p-5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-xl bg-white shadow-sm`}>
                  <item.icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-900">{item.title}</h4>
                    <Badge className={`${item.statusColor} border-0`}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{item.description}</p>
                  {item.cta.link ? (
                    <Link to={item.cta.link}>
                      <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-300 hover:bg-indigo-50">
                        {item.cta.label}
                      </Button>
                    </Link>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                      onClick={item.cta.onClick}
                    >
                      {item.cta.label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}