import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, FileText, Shield, Archive } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function RegulatoryInfo() {
  const panels = [
    {
      icon: FileText,
      title: 'Employee Tips & PAYE',
      summary: 'Tips are subject to income tax and National Insurance contributions',
      link: 'https://www.gov.uk/guidance/tipping-and-service-charges',
      linkText: 'HMRC guidance on tips and gratuities',
      compliance: 'Tiply calculates and reports all tips in accordance with HMRC requirements'
    },
    {
      icon: Shield,
      title: 'Employer Obligations',
      summary: 'You must maintain accurate records of all tips and tip allocations',
      link: 'https://www.gov.uk/keeping-payroll-records',
      linkText: 'HMRC record-keeping requirements',
      compliance: 'Tiply maintains an immutable audit trail for all tips and allocations'
    },
    {
      icon: Archive,
      title: 'Data Retention',
      summary: 'Tips records must be kept for 6 years minimum for HMRC compliance',
      link: 'https://www.gov.uk/running-payroll/keeping-records',
      linkText: 'HMRC data retention guidance',
      compliance: 'Tiply automatically archives all data for 7 years (exceeds requirement)'
    }
  ];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>UK Regulatory Framework</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {panels.map((panel, idx) => {
            const Icon = panel.icon;
            return (
              <div key={idx} className="p-5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-2">{panel.title}</h4>
                    <p className="text-sm text-slate-700 mb-3">{panel.summary}</p>
                    <Button 
                      variant="link" 
                      className="text-indigo-600 p-0 h-auto mb-3"
                      asChild
                    >
                      <a href={panel.link} target="_blank" rel="noopener noreferrer">
                        {panel.linkText}
                        <ExternalLink className="w-3 h-3 ml-1 inline" />
                      </a>
                    </Button>
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-sm text-emerald-800">
                        <strong>Tiply compliance:</strong> {panel.compliance}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}