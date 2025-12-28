import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function LocationBreakdown({ data = [] }) {
  const formatCurrency = (value) => `£${((value || 0) / 100).toFixed(2)}`;

  // Sort by tip rate descending
  const sortedData = [...data].sort((a, b) => b.tipRate - a.tipRate);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Performance by Location</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Rank</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Location</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Revenue</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Tips</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Tip Rate</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Avg/Transaction</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    No data available
                  </td>
                </tr>
              ) : (
                sortedData.map((location, index) => (
                  <tr key={location.locationId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">#{index + 1}</span>
                        {index === 0 && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Top</Badge>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-slate-900">{location.locationName}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-slate-900">{formatCurrency(location.revenue)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-slate-900">{formatCurrency(location.tips)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-semibold text-slate-900">{location.tipRate.toFixed(1)}%</span>
                        {location.tipRate >= 15 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : location.tipRate < 10 ? (
                          <TrendingDown className="w-4 h-4 text-rose-600" />
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm text-slate-600">{formatCurrency(location.avgTipPerTransaction)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}