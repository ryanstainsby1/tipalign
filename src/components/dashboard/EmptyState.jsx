import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from 'lucide-react';

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction,
  isLoading 
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-12 text-center">
        <div className="max-w-md mx-auto">
          {Icon && (
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon className="w-8 h-8 text-slate-400" />
            </div>
          )}
          <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-600 mb-6">{description}</p>
          {actionLabel && onAction && (
            <Button
              onClick={onAction}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
              size="lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                actionLabel
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}