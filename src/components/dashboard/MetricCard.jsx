import React from 'react';
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendDirection = "up",
  icon: Icon,
  accentColor = "indigo"
}) {
  const colorMap = {
    indigo: "from-indigo-500 to-indigo-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    rose: "from-rose-500 to-rose-600",
    sky: "from-sky-500 to-sky-600"
  };

  return (
    <Card className="relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">
              {title}
            </p>
            <p className="text-3xl font-semibold text-slate-900 tracking-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={`p-3 rounded-xl bg-gradient-to-br ${colorMap[accentColor]} shadow-lg`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
        
        {trend && (
          <div className="mt-4 flex items-center gap-1.5">
            {trendDirection === "up" ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
            <span className={`text-sm font-medium ${
              trendDirection === "up" ? "text-emerald-600" : "text-rose-600"
            }`}>
              {trend}
            </span>
            <span className="text-sm text-slate-400">vs last period</span>
          </div>
        )}
      </div>
      
      {/* Subtle gradient accent */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorMap[accentColor]} opacity-60`} />
    </Card>
  );
}