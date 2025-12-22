import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Terminal, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function LocationCard({ location }) {
  const policyLabels = {
    individual: { label: "Individual Tips", color: "bg-blue-50 text-blue-700 border-blue-200" },
    pooled: { label: "Pooled Tips", color: "bg-purple-50 text-purple-700 border-purple-200" },
    weighted: { label: "Weighted Pool", color: "bg-amber-50 text-amber-700 border-amber-200" },
    hybrid: { label: "Hybrid", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  };

  const policy = policyLabels[location.tip_policy] || policyLabels.individual;

  return (
    <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {location.name}
              </h3>
              <p className="text-sm text-slate-500">{location.address || 'No address set'}</p>
            </div>
          </div>
          <Link 
            to={createPageUrl(`LocationSettings?id=${location.id}`)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-400" />
          </Link>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Terminal className="w-4 h-4 text-slate-400" />
            <span>{location.terminals_count || 0} terminals</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Users className="w-4 h-4 text-slate-400" />
            <span>Active</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Badge variant="outline" className={policy.color}>
            {policy.label}
          </Badge>
          {location.tronc_enabled && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Tronc Active
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}