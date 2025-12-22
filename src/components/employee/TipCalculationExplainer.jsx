import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Users, Clock, Calculator, CheckCircle } from 'lucide-react';

export default function TipCalculationExplainer({ employee, recentAllocations = [], batches = [] }) {
  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const methodExplanations = {
    individual: {
      title: "Individual Allocation",
      description: "You receive 100% of the tips from transactions you directly served.",
      howItWorks: "When a customer leaves a tip on a transaction you processed, that tip goes entirely to you. It's straightforward and direct.",
      icon: Users
    },
    pooled: {
      title: "Pooled Tips",
      description: "All tips collected during a period are combined and shared equally among eligible staff.",
      howItWorks: "Every eligible team member on shift receives an equal share of the total tips collected, regardless of individual transactions.",
      icon: Users
    },
    weighted: {
      title: "Weighted by Role",
      description: "Tips are shared based on your role and a multiplier that reflects responsibility.",
      howItWorks: `Your role is "${employee?.role || 'N/A'}" with a weight of ${employee?.role_weight || 1}x. This means if the base share is £10, you'd receive £${((employee?.role_weight || 1) * 10).toFixed(2)}.`,
      icon: Calculator
    },
    shift_based: {
      title: "Based on Hours Worked",
      description: "Your share is proportional to the hours you worked during the tip collection period.",
      howItWorks: "If you worked 8 hours out of a total 40 hours worked by all staff, you'd receive 20% of the tips (8 ÷ 40).",
      icon: Clock
    },
    hybrid: {
      title: "Hybrid Method",
      description: "A combination of direct attribution and pooled sharing.",
      howItWorks: "A percentage of your direct tips goes to you, while the remainder is pooled with the team.",
      icon: Users
    }
  };

  // Get the most common method from recent allocations
  const methodCounts = recentAllocations.reduce((acc, alloc) => {
    const method = alloc.allocation_method || 'individual';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  const mostCommonMethod = Object.keys(methodCounts).length > 0 
    ? Object.keys(methodCounts).reduce((a, b) => methodCounts[a] > methodCounts[b] ? a : b)
    : 'individual';

  const explanation = methodExplanations[mostCommonMethod] || methodExplanations.individual;
  const Icon = explanation.icon;

  // Get example calculation from a recent allocation
  const exampleAllocation = recentAllocations.find(a => a.calculation_metadata?.explanation) || recentAllocations[0];

  return (
    <div className="space-y-6">
      {/* Main explanation */}
      <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-600">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">{explanation.title}</CardTitle>
              <p className="text-sm text-slate-600 mt-1">{explanation.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-xl p-4">
            <h4 className="font-semibold text-slate-900 mb-2">How it works:</h4>
            <p className="text-slate-700">{explanation.howItWorks}</p>
          </div>
        </CardContent>
      </Card>

      {/* Your details */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Your Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">Your Role</Badge>
                <span className="font-medium text-slate-900 capitalize">{employee?.role || 'N/A'}</span>
              </div>
              <p className="text-sm text-slate-600">
                Your role affects how tips are distributed to you in weighted allocations.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="bg-purple-50 text-purple-700">Weight Multiplier</Badge>
                <span className="font-medium text-slate-900">{employee?.role_weight || 1}x</span>
              </div>
              <p className="text-sm text-slate-600">
                In weighted pools, your share is multiplied by this factor.
              </p>
            </div>
          </div>

          {employee?.locations && employee.locations.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Your Locations</Badge>
                <span className="font-medium text-slate-900">{employee.locations.length}</span>
              </div>
              <p className="text-sm text-slate-600">
                You work at {employee.locations.length} {employee.locations.length === 1 ? 'location' : 'locations'}. 
                Tips are calculated separately for each location.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Example calculation */}
      {exampleAllocation && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Example from Your Recent Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50">
                <Calculator className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="capitalize">
                      {exampleAllocation.allocation_method?.replace('_', ' ')}
                    </Badge>
                    <span className="text-lg font-bold text-slate-900">
                      {formatCurrency(exampleAllocation.gross_amount)}
                    </span>
                  </div>
                  {exampleAllocation.calculation_metadata?.explanation ? (
                    <p className="text-sm text-slate-700">{exampleAllocation.calculation_metadata.explanation}</p>
                  ) : (
                    <p className="text-sm text-slate-700">
                      Allocated on {new Date(exampleAllocation.allocation_date).toLocaleDateString('en-GB')}
                    </p>
                  )}
                  {exampleAllocation.hours_worked && (
                    <p className="text-xs text-slate-500 mt-1">
                      Based on {exampleAllocation.hours_worked} hours worked
                    </p>
                  )}
                  {exampleAllocation.pool_share_percentage && (
                    <p className="text-xs text-slate-500 mt-1">
                      Your share: {exampleAllocation.pool_share_percentage.toFixed(1)}% of the pool
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status explanation */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">What Do the Statuses Mean?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-amber-900">Pending</span>
              <Badge variant="outline" className="bg-amber-100 text-amber-700">Draft</Badge>
            </div>
            <p className="text-sm text-amber-800">
              Tips are calculated but not yet confirmed. Managers are reviewing the allocation before finalising.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-indigo-900">Finalised</span>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700">Confirmed</Badge>
            </div>
            <p className="text-sm text-indigo-800">
              Tips are confirmed and locked. They'll be included in your next payroll run. No changes can be made except via approved adjustments.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-emerald-900">Exported</span>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700">In Payroll</Badge>
            </div>
            <p className="text-sm text-emerald-800">
              Tips have been sent to payroll and will appear in your next pay. This is immutable and fully auditable.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Trust & transparency */}
      <Alert className="border-indigo-200 bg-indigo-50">
        <Info className="w-4 h-4 text-indigo-600" />
        <AlertDescription className="text-indigo-900">
          <strong>100% Transparent:</strong> Every tip allocation is recorded with a unique hash that proves it hasn't been tampered with. 
          You can see exactly how your tips were calculated, and if you have questions, you can raise a dispute for review.
        </AlertDescription>
      </Alert>
    </div>
  );
}