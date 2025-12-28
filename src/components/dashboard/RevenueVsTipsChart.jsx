import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { format } from 'date-fns';

export default function RevenueVsTipsChart({ data = [] }) {
  const [showTipRate, setShowTipRate] = useState(false);

  const formatCurrency = (value) => `£${((value || 0) / 100).toFixed(2)}`;
  const formatPercent = (value) => `${(value || 0).toFixed(1)}%`;

  const chartData = data.map(d => ({
    date: format(new Date(d.business_date), 'MMM dd'),
    revenue: d.total_gross_revenue_pence / 100,
    tips: d.total_tip_pence / 100,
    tipRate: d.avg_tip_percent
  }));

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Revenue vs Tips</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipRate(!showTipRate)}
          >
            Show {showTipRate ? 'Tips' : 'Tip Rate'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke="#64748b"
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              tickFormatter={(v) => `£${v}`}
            />
            {showTipRate && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#64748b"
                tickFormatter={(v) => `${v}%`}
              />
            )}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                    <p className="font-semibold text-slate-900 mb-2">{payload[0].payload.date}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-indigo-600 rounded" />
                        <span className="text-slate-600">Revenue:</span>
                        <span className="font-semibold">£{payload[0].payload.revenue.toFixed(2)}</span>
                      </div>
                      {showTipRate ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-emerald-600 rounded" />
                          <span className="text-slate-600">Tip Rate:</span>
                          <span className="font-semibold">{payload[0].payload.tipRate.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-emerald-600 rounded" />
                          <span className="text-slate-600">Tips:</span>
                          <span className="font-semibold">£{payload[0].payload.tips.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar 
              yAxisId="left"
              dataKey="revenue" 
              fill="#4f46e5" 
              name="Revenue (£)"
              radius={[4, 4, 0, 0]}
            />
            {showTipRate ? (
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="tipRate" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Tip Rate (%)"
                dot={{ fill: '#10b981' }}
              />
            ) : (
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="tips" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Tips (£)"
                dot={{ fill: '#10b981' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}