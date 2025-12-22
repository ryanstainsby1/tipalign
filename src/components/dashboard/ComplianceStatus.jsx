import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, AlertTriangle, FileCheck, Clock } from 'lucide-react';

export default function ComplianceStatus({ 
  hmrcReady = true, 
  lastExport = null, 
  pendingAllocations = 0,
  auditScore = 100 
}) {
  const items = [
    {
      label: "HMRC Ready",
      status: hmrcReady ? "compliant" : "attention",
      icon: Shield,
      detail: hmrcReady ? "All records compliant" : "Action required"
    },
    {
      label: "Audit Trail",
      status: auditScore >= 95 ? "compliant" : auditScore >= 80 ? "warning" : "attention",
      icon: FileCheck,
      detail: `${auditScore}% complete`
    },
    {
      label: "Pending Allocations",
      status: pendingAllocations === 0 ? "compliant" : pendingAllocations < 10 ? "warning" : "attention",
      icon: Clock,
      detail: `${pendingAllocations} awaiting review`
    },
    {
      label: "Last Export",
      status: lastExport ? "compliant" : "warning",
      icon: CheckCircle2,
      detail: lastExport || "No exports yet"
    }
  ];

  const statusColors = {
    compliant: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    attention: "bg-rose-50 text-rose-700 border-rose-200"
  };

  const iconColors = {
    compliant: "text-emerald-500",
    warning: "text-amber-500",
    attention: "text-rose-500"
  };

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          <CardTitle className="text-lg font-semibold text-slate-900">Compliance Status</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div 
                key={item.label}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${statusColors[item.status]}`}>
                    <Icon className={`w-4 h-4 ${iconColors[item.status]}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.detail}</p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-xs capitalize ${statusColors[item.status]}`}
                >
                  {item.status === "compliant" ? "OK" : item.status}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}