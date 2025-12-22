import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Info, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function AllocationPreview({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-sm text-slate-500 mt-3">Calculating preview...</p>
      </div>
    );
  }

  if (!data || !data.allocations) {
    return null;
  }

  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  // Group by employee
  const byEmployee = data.allocations.reduce((acc, alloc) => {
    if (!acc[alloc.employee_id]) {
      acc[alloc.employee_id] = {
        employee_id: alloc.employee_id,
        total: 0,
        count: 0,
        methods: []
      };
    }
    acc[alloc.employee_id].total += alloc.gross_amount;
    acc[alloc.employee_id].count++;
    acc[alloc.employee_id].methods.push(alloc.calculation_metadata?.method);
    return acc;
  }, {});

  const employeeData = Object.values(byEmployee)
    .map((e, i) => ({
      ...e,
      name: `Employee ${i + 1}`,
      fill: COLORS[i % COLORS.length]
    }))
    .sort((a, b) => b.total - a.total);

  const { summary } = data;

  return (
    <div className="space-y-6">
      <Alert className="border-emerald-200 bg-emerald-50">
        <CheckCircle className="w-4 h-4 text-emerald-600" />
        <AlertDescription className="text-emerald-900">
          <strong>Preview Success:</strong> Calculated {data.allocations.length} allocations 
          for {summary.employee_count} employees based on "{summary.rule_set_name}" rules.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Total Tips</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.total_tips)}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Allocated</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.total_allocated)}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Employees</p>
            <p className="text-2xl font-bold text-indigo-600">{summary.employee_count}</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Payments</p>
            <p className="text-2xl font-bold text-slate-900">{summary.payment_count}</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Distribution Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={employeeData}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: ${formatCurrency(entry.total)}`}
              >
                {employeeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ background: 'white', border: '1px solid #e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Allocation Details */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Allocation Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Explanation</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.allocations.slice(0, 20).map((alloc, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">Employee {i + 1}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {alloc.allocation_method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-md">
                    {alloc.calculation_metadata?.explanation}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(alloc.gross_amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.allocations.length > 20 && (
            <p className="text-sm text-slate-500 text-center mt-4">
              Showing 20 of {data.allocations.length} allocations
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}