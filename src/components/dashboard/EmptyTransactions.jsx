import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function EmptyTransactions() {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="py-12">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No transactions yet</h3>
          <p className="text-slate-600 mb-4 leading-relaxed">
            Transactions will appear here once synced with Square. Tips captured via your Square terminals will automatically sync and be allocated to your team.
          </p>
          <Link 
            to={createPageUrl('Transactions')} 
            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
          >
            View all transactions →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}