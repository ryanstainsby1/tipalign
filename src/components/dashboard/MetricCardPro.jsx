import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, CheckCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function MetricCardPro({ 
  title, 
  value, 
  trend, 
  trendColor = "emerald",
  icon: Icon, 
  bgColor = "indigo",
  onClick 
}) {
  const colorClasses = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-600',
    blue: 'bg-blue-600'
  };

  const trendColorClasses = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: onClick ? 1.02 : 1, y: onClick ? -2 : 0 }}
      onClick={onClick}
      className={`relative bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border-t-2 ${
        bgColor === 'indigo' ? 'border-t-indigo-600' :
        bgColor === 'emerald' ? 'border-t-emerald-600' :
        bgColor === 'amber' ? 'border-t-amber-600' :
        'border-t-blue-600'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-5">
        <div className={`p-3.5 rounded-xl ${colorClasses[bgColor]} shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <Badge className={`${trendColorClasses[trendColor]} border flex items-center gap-1.5 px-3 py-1.5`}>
            {trendColor === 'emerald' && <CheckCircle className="w-3.5 h-3.5" />}
            {trendColor === 'emerald' && trend.includes('+') && <TrendingUp className="w-3.5 h-3.5" />}
            <span className="text-xs font-semibold">{trend}</span>
          </Badge>
        )}
      </div>
      
      <div className="text-4xl font-bold text-slate-900 mb-2">
        {value}
      </div>
      <div className="text-sm text-slate-600 font-medium">{title}</div>
    </motion.div>
  );
}