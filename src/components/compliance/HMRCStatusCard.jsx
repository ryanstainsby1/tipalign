import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Shield } from 'lucide-react';

export default function HMRCStatusCard({ 
  auditLoggingEnabled, 
  allocationRulesConfigured, 
  employeeRecordsComplete,
  noUnresolvedDisputes,
  onReviewIssues 
}) {
  const checks = [
    { label: 'Audit logging enabled', status: auditLoggingEnabled },
    { label: 'Allocation rules configured', status: allocationRulesConfigured },
    { label: 'Employee records complete', status: employeeRecordsComplete },
    { label: 'No unresolved disputes', status: noUnresolvedDisputes }
  ];

  const isReady = checks.every(c => c.status);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isReady ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            <Shield className={`w-5 h-5 ${isReady ? 'text-emerald-600' : 'text-rose-600'}`} />
          </div>
          HMRC Ready
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
            isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}>
            {isReady ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Ready for HMRC</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Action required</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {checks.map((check, idx) => (
            <div key={idx} className="flex items-center gap-3">
              {check.status ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className={`text-sm ${check.status ? 'text-slate-700' : 'text-slate-900 font-medium'}`}>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        {!isReady && (
          <Button onClick={onReviewIssues} className="w-full bg-rose-600 hover:bg-rose-700">
            Review Issues
          </Button>
        )}
      </CardContent>
    </Card>
  );
}