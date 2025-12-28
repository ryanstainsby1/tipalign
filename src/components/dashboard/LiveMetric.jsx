import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function LiveMetric({ title, value, change, isPositive, icon: Icon, color = "indigo" }) {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    sky: 'from-sky-500 to-sky-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative group"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 rounded-2xl"></div>
      <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100">
        {/* Animated gradient accent */}
        <motion.div
          className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]} rounded-t-2xl`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {change && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change}
            </motion.div>
          )}
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold text-slate-900 mb-1"
        >
          {value}
        </motion.div>
        <div className="text-sm text-slate-500">{title}</div>
        
        {/* Hover effect glow */}
        <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`}></div>
      </div>
    </motion.div>
  );
}