import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ArrowRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function RecentTransactions({ transactions = [] }) {
  const formatCurrency = (value) => {
    return `£${(value / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const statusConfig = {
    allocated: { 
      icon: CheckCircle, 
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconColor: "text-emerald-500"
    },
    pending: { 
      icon: Clock, 
      color: "bg-amber-50 text-amber-700 border-amber-200",
      iconColor: "text-amber-500"
    },
    disputed: { 
      icon: AlertCircle, 
      color: "bg-rose-50 text-rose-700 border-rose-200",
      iconColor: "text-rose-500"
    }
  };

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900">Recent Transactions</CardTitle>
        <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors">
          View all <ArrowRight className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No transactions yet</p>
              <p className="text-xs mt-1">Transactions will appear here once synced with Square</p>
            </div>
          ) : (
            transactions.slice(0, 5).map((tx) => {
              const status = statusConfig[tx.allocation_status] || statusConfig.pending;
              const StatusIcon = status.icon;
              
              return (
                <div 
                  key={tx.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status.color}`}>
                      <StatusIcon className={`w-4 h-4 ${status.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {tx.location_name || 'Unknown Location'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(tx.transaction_date), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(tx.tip_amount)}
                    </p>
                    <Badge variant="outline" className={`text-xs ${status.color}`}>
                      {tx.allocation_status}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}