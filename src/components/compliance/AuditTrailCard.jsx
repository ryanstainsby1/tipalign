import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditTrailCard({ 
  totalEvents, 
  earliestEvent,
  latestEvent,
  onViewAll 
}) {
  const completeness = totalEvents > 0 ? 100 : 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FileCheck className="w-5 h-5 text-indigo-600" />
          </div>
          Audit Trail Completeness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold text-slate-900">{completeness}%</span>
            <span className="text-slate-600">complete</span>
          </div>
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{totalEvents}</span> events logged
          </div>
        </div>

        <div className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Time period:</span>
            <span className="text-slate-900 font-medium">
              {earliestEvent ? format(new Date(earliestEvent), 'MMM d, yyyy') : 'No data'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Last event:</span>
            <span className="text-slate-900 font-medium">
              {latestEvent ? format(new Date(latestEvent), 'PPp') : 'No data'}
            </span>
          </div>
        </div>

        <Button onClick={onViewAll} variant="outline" className="w-full">
          View All Audit Events
        </Button>
      </CardContent>
    </Card>
  );
}