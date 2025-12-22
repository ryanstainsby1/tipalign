import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';

export default function SquareConnectButton({ 
  isConnected = false, 
  merchantName = null,
  lastSync = null,
  onConnect,
  onSync,
  isSyncing = false
}) {
  if (isConnected) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-emerald-900">Connected to Square</p>
                <p className="text-sm text-emerald-700">{merchantName || 'Your business'}</p>
                {lastSync && (
                  <p className="text-xs text-emerald-600 mt-0.5">Last synced: {lastSync}</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">Connect Your Square Account</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
            Securely connect to Square to sync transactions, employees, and locations automatically.
          </p>
          <Button 
            onClick={onConnect}
            className="bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Link2 className="w-4 h-4 mr-2" />
            Connect with Square
            <ExternalLink className="w-3 h-3 ml-2" />
          </Button>
          <p className="text-xs text-slate-400 mt-3">
            We use OAuth 2.0 for secure, read-only access
          </p>
        </div>
      </CardContent>
    </Card>
  );
}