import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { User, Calendar, CreditCard, Clock } from 'lucide-react';

export default function AllocationCard({ allocation, onReview, statusType }) {
  const formatCurrency = (value) => {
    return `£${(value / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const methodColors = {
    pooled: 'bg-blue-100 text-blue-700',
    individual: 'bg-purple-100 text-purple-700',
    weighted: 'bg-amber-100 text-amber-700',
    shift_based: 'bg-teal-100 text-teal-700'
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onReview(allocation)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">{allocation.employee_name}</h4>
              <p className="text-xs text-slate-500">ID: {allocation.employee_id?.slice(0, 8)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-indigo-600">
              {formatCurrency(allocation.gross_amount)}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(allocation.allocation_date), 'PPP')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${methodColors[allocation.allocation_method] || 'bg-slate-100 text-slate-700'} border-0`}>
              {allocation.allocation_method || 'Pooled'}
            </Badge>
            <span className="text-xs text-slate-500">
              {allocation.transaction_count || 3} tips
            </span>
          </div>
        </div>

        {statusType === 'confirmed' && allocation.confirmed_by && (
          <div className="mb-3 p-2 bg-emerald-50 rounded-lg">
            <p className="text-xs text-emerald-700">
              Confirmed by {allocation.confirmed_by} on {format(new Date(allocation.updated_date), 'PP')}
            </p>
          </div>
        )}

        {statusType === 'disputed' && allocation.dispute_reason && (
          <div className="mb-3 p-2 bg-rose-50 rounded-lg">
            <p className="text-xs text-rose-700 font-medium mb-1">Dispute reason:</p>
            <p className="text-xs text-rose-600">{allocation.dispute_reason}</p>
            <p className="text-xs text-rose-500 mt-1">Disputed by: {allocation.disputed_by}</p>
          </div>
        )}

        <Button 
          variant={statusType === 'disputed' ? 'default' : 'outline'} 
          size="sm" 
          className={`w-full ${statusType === 'disputed' ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onReview(allocation);
          }}
        >
          {statusType === 'pending' && 'Review'}
          {statusType === 'confirmed' && 'View Details'}
          {statusType === 'disputed' && 'Resolve'}
        </Button>
      </CardContent>
    </Card>
  );
}