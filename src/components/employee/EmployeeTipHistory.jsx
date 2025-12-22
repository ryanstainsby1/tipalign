import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ArrowUpRight, AlertTriangle, Info } from 'lucide-react';

export default function EmployeeTipHistory({ allocationLines = [], adjustments = [], batches = [], employeeName = "Employee" }) {
  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const methodLabels = {
    individual: { label: "Individual", color: "bg-blue-50 text-blue-700" },
    pooled: { label: "Pool Share", color: "bg-purple-50 text-purple-700" },
    weighted: { label: "Weighted", color: "bg-amber-50 text-amber-700" },
    shift_based: { label: "Shift Based", color: "bg-emerald-50 text-emerald-700" },
    hybrid: { label: "Hybrid", color: "bg-indigo-50 text-indigo-700" }
  };

  const batchStatusColors = {
    draft: "bg-slate-100 text-slate-700",
    pending_approval: "bg-amber-100 text-amber-700",
    finalised: "bg-indigo-100 text-indigo-700",
    exported: "bg-emerald-100 text-emerald-700"
  };

  // Group allocations by date
  const groupedByDate = allocationLines.reduce((acc, line) => {
    const date = format(new Date(line.allocation_date), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = { allocations: [], adjustments: [] };
    acc[date].allocations.push(line);
    return acc;
  }, {});

  // Add adjustments to their respective dates
  adjustments.forEach(adj => {
    const date = format(new Date(adj.created_date), 'yyyy-MM-dd');
    if (!groupedByDate[date]) groupedByDate[date] = { allocations: [], adjustments: [] };
    groupedByDate[date].adjustments.push(adj);
  });

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900">
          Tip History for {employeeName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedByDate).length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No tip allocations found</p>
            <p className="text-sm mt-1">Allocations will appear here once tips are distributed</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedByDate)
              .sort((a, b) => new Date(b[0]) - new Date(a[0]))
              .map(([date, dayData]) => {
                const dayTotal = dayData.allocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0) +
                                 dayData.adjustments.reduce((sum, a) => sum + (a.adjustment_amount || 0), 0);
                
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-slate-500">
                        {format(new Date(date), 'EEEE, dd MMMM yyyy')}
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(dayTotal)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      {/* Allocations */}
                      {dayData.allocations.map((line) => {
                        const method = methodLabels[line.allocation_method] || methodLabels.individual;
                        const batch = batches.find(b => b.id === line.allocation_batch_id);
                        const batchStatus = batch?.status || 'draft';
                        
                        return (
                          <div 
                            key={line.id}
                            className="flex items-start justify-between p-3 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-indigo-50 mt-0.5">
                                <ArrowUpRight className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={method.color}>
                                    {method.label}
                                  </Badge>
                                  <Badge variant="outline" className={batchStatusColors[batchStatus]}>
                                    {batchStatus === 'draft' ? 'Pending' : 
                                     batchStatus === 'pending_approval' ? 'Pending' :
                                     batchStatus === 'finalised' ? 'Finalised' : 'Exported'}
                                  </Badge>
                                </div>
                                {line.calculation_metadata?.explanation && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    {line.calculation_metadata.explanation}
                                  </p>
                                )}
                                {line.hours_worked && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {line.hours_worked} hours worked
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">
                                {formatCurrency(line.gross_amount)}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {/* Adjustments */}
                      {dayData.adjustments.map((adj) => (
                        <div 
                          key={adj.id}
                          className="flex items-start justify-between p-3 rounded-lg bg-amber-50 border border-amber-200"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-amber-100 mt-0.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 capitalize">
                                  {adj.adjustment_type.replace('_', ' ')}
                                </Badge>
                                <Badge variant="outline" className={
                                  adj.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                }>
                                  {adj.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-amber-900">{adj.reason}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${adj.adjustment_amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {adj.adjustment_amount > 0 ? '+' : ''}{formatCurrency(adj.adjustment_amount)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}