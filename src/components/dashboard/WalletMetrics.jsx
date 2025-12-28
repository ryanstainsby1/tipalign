import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, Users, Zap } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function WalletMetrics({ 
  totalWalletTips = 0,
  tipCount = 0,
  topEmployees = [],
  growth = 0
}) {
  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toFixed(2)}`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Wallet Tips */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Wallet-Sourced Tips
            </CardTitle>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Wallet className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalWalletTips)}
            </span>
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
              This month
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {tipCount} transactions
          </p>
        </CardContent>
      </Card>

      {/* Growth */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Growth
            </CardTitle>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              +{growth}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            vs last month
          </p>
        </CardContent>
      </Card>

      {/* Active Passes */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Active Passes
            </CardTitle>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {topEmployees.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            employees with passes
          </p>
        </CardContent>
      </Card>

      {/* Top Performer */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Top Wallet Earner
            </CardTitle>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topEmployees.length > 0 ? (
            <>
              <div className="text-base font-semibold text-slate-900 truncate">
                {topEmployees[0].name}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {formatCurrency(topEmployees[0].amount)} this month
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No data yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}