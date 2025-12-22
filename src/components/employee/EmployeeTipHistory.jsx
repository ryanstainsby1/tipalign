import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function EmployeeTipHistory({ allocations = [], employeeName = "Employee" }) {
  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const methodLabels = {
    individual: { label: "Individual", color: "bg-blue-50 text-blue-700" },
    pooled: { label: "Pool Share", color: "bg-purple-50 text-purple-700" },
    weighted: { label: "Weighted", color: "bg-amber-50 text-amber-700" },
    shift_based: { label: "Shift Based", color: "bg-emerald-50 text-emerald-700" }
  };

  const statusColors = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paid: "bg-blue-50 text-blue-700 border-blue-200",
    disputed: "bg-rose-50 text-rose-700 border-rose-200"
  };

  // Group by date
  const groupedByDate = allocations.reduce((acc, alloc) => {
    const date = format(new Date(alloc.allocation_date), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(alloc);
    return acc;
  }, {});

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
              .map(([date, dayAllocations]) => {
                const dayTotal = dayAllocations.reduce((sum, a) => sum + (a.gross_amount || 0), 0);
                
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
                      {dayAllocations.map((alloc) => {
                        const method = methodLabels[alloc.allocation_method] || methodLabels.individual;
                        
                        return (
                          <div 
                            key={alloc.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-indigo-50">
                                <ArrowUpRight className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={method.color}>
                                    {method.label}
                                  </Badge>
                                  {alloc.pool_percentage && (
                                    <span className="text-xs text-slate-500">
                                      ({alloc.pool_percentage}% of pool)
                                    </span>
                                  )}
                                </div>
                                {alloc.hours_worked && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {alloc.hours_worked} hours worked
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">
                                {formatCurrency(alloc.gross_amount)}
                              </p>
                              <Badge variant="outline" className={`text-xs ${statusColors[alloc.status]}`}>
                                {alloc.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
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