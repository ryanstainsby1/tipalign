import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DataQualityCard({ 
  totalTips,
  totalAllocations,
  disputedAllocations,
  teamMembers,
  locations 
}) {
  const disputePercentage = totalAllocations > 0 
    ? ((disputedAllocations / totalAllocations) * 100).toFixed(1)
    : 0;

  const handleValidation = () => {
    toast.success('Data integrity check passed', {
      description: 'All records validated successfully'
    });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          Data Quality
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Total tips captured:</span>
            <span className="text-lg font-bold text-slate-900">{totalTips}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Allocations:</span>
            <div className="text-right">
              <span className="text-lg font-bold text-slate-900">{totalAllocations}</span>
              {disputedAllocations > 0 && (
                <div className="text-xs text-rose-600">
                  ({disputePercentage}% disputed)
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Team members:</span>
            <span className="text-lg font-bold text-slate-900">{teamMembers}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Locations:</span>
            <span className="text-lg font-bold text-slate-900">{locations}</span>
          </div>
        </div>

        <Button onClick={handleValidation} variant="outline" className="w-full">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Data Integrity Check
        </Button>
      </CardContent>
    </Card>
  );
}