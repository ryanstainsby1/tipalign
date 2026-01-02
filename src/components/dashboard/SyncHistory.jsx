import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function SyncHistory({ syncJobs = [] }) {
  const [expandedJobs, setExpandedJobs] = useState({});

  const toggleExpanded = (jobId) => {
    setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-rose-600" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      partial: 'bg-amber-50 text-amber-700 border-amber-200',
      failed: 'bg-rose-50 text-rose-700 border-rose-200',
      running: 'bg-blue-50 text-blue-700 border-blue-200'
    };
    
    return (
      <Badge variant="outline" className={styles[status] || 'bg-slate-50 text-slate-700'}>
        {status}
      </Badge>
    );
  };

  const getTriggerLabel = (trigger) => {
    const labels = {
      manual: 'Manual',
      initial_setup: 'Initial Setup',
      webhook: 'Webhook',
      scheduled: 'Scheduled'
    };
    return labels[trigger] || trigger;
  };

  if (syncJobs.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Recent Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No sync jobs yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Recent Sync History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {syncJobs.map((job) => (
            <Collapsible
              key={job.id}
              open={expandedJobs[job.id]}
              onOpenChange={() => toggleExpanded(job.id)}
            >
              <div className="rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                <CollapsibleTrigger className="w-full p-3 flex items-start justify-between cursor-pointer hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {getStatusIcon(job.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(job.status)}
                        <span className="text-xs text-slate-500">
                          {getTriggerLabel(job.triggered_by)}
                        </span>
                        {job.sync_type === 'full' && (
                          <Badge variant="outline" className="text-xs">Full Sync</Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-slate-500">
                        {format(new Date(job.started_at), 'PPp')}
                      </p>

                      {job.status !== 'running' && (
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          {job.records_created > 0 && (
                            <span className="text-emerald-600 font-medium">
                              +{job.records_created} created
                            </span>
                          )}
                          {job.records_updated > 0 && (
                            <span className="text-blue-600 font-medium">
                              {job.records_updated} updated
                            </span>
                          )}
                          {job.records_skipped > 0 && (
                            <span className="text-slate-500">
                              {job.records_skipped} skipped
                            </span>
                          )}
                          {job.errors?.length > 0 && (
                            <span className="text-amber-600 font-medium">
                              {job.errors.length} {job.errors.length === 1 ? 'warning' : 'warnings'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-2">
                    {expandedJobs[job.id] ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </CollapsibleTrigger>

                {job.errors?.length > 0 && (
                  <CollapsibleContent>
                    <div className="px-3 pb-3 border-t border-slate-100 mt-2 pt-3">
                      <h4 className="text-xs font-semibold text-slate-700 mb-2">Warnings / Errors:</h4>
                      <div className="space-y-2">
                        {job.errors.map((error, idx) => (
                          <div key={idx} className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                {error.entity_type && (
                                  <span className="font-medium text-amber-900">
                                    {error.entity_type}
                                    {error.square_id && ` (${error.square_id})`}:
                                  </span>
                                )}
                                <p className="text-amber-800 mt-0.5 break-words">
                                  {error.error_message || error.message || JSON.stringify(error)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                )}
              </div>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}