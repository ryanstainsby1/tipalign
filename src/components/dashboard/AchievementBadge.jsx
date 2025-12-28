import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, Zap, Star } from 'lucide-react';

const achievements = {
  first_sync: { icon: Zap, color: 'from-amber-400 to-orange-500', label: 'First Sync Complete' },
  team_ready: { icon: Star, color: 'from-indigo-400 to-purple-500', label: 'Team Onboarded' },
  allocation_master: { icon: Target, color: 'from-emerald-400 to-teal-500', label: 'Allocation Pro' },
  compliance_pro: { icon: Trophy, color: 'from-rose-400 to-pink-500', label: 'Compliance Ready' }
};

export default function AchievementBadge({ type, unlocked }) {
  const achievement = achievements[type];
  if (!achievement) return null;
  
  const Icon = achievement.icon;
  
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: unlocked ? 1 : 0.9, rotate: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className={`relative group cursor-pointer ${unlocked ? '' : 'opacity-40 grayscale'}`}
    >
      <div className={`
        w-16 h-16 rounded-2xl bg-gradient-to-br ${achievement.color} 
        flex items-center justify-center shadow-lg
        ${unlocked ? 'shadow-xl' : ''}
      `}>
        <Icon className="w-7 h-7 text-white" />
        {unlocked && (
          <motion.div
            className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <span className="text-white text-xs">✓</span>
          </motion.div>
        )}
      </div>
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
          {achievement.label}
        </div>
      </div>
    </motion.div>
  );
}