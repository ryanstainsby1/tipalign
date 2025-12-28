import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateAPIKeyModal({ open, onClose, onGenerate }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState({
    readTips: true,
    readAllocations: true,
    exportPayroll: false,
    manageEmployees: false
  });
  const [generatedKey, setGeneratedKey] = useState('');

  const handleGenerate = () => {
    const key = `sk_live_${Math.random().toString(36).substring(2, 34)}`;
    setGeneratedKey(key);
    onGenerate({ name, scopes, key });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedKey);
    toast.success('API key copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([generatedKey], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiply-api-key-${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('API key downloaded');
  };

  const handleClose = () => {
    setName('');
    setGeneratedKey('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            {generatedKey ? 'Save this key - you won\'t see it again' : 'Configure your new API key'}
          </DialogDescription>
        </DialogHeader>

        {!generatedKey ? (
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="Production API Key"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="mb-3 block">Permissions</Label>
              <div className="space-y-3">
                {[
                  { key: 'readTips', label: 'Read tips data' },
                  { key: 'readAllocations', label: 'Read allocations' },
                  { key: 'exportPayroll', label: 'Export payroll' },
                  { key: 'manageEmployees', label: 'Manage employees' }
                ].map(scope => (
                  <div key={scope.key} className="flex items-center gap-2">
                    <Checkbox
                      id={scope.key}
                      checked={scopes[scope.key]}
                      onCheckedChange={(checked) => setScopes({ ...scopes, [scope.key]: checked })}
                    />
                    <Label htmlFor={scope.key} className="font-normal cursor-pointer">
                      {scope.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleGenerate} className="w-full bg-indigo-600 hover:bg-indigo-700">
              Generate API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <code className="text-sm break-all">{generatedKey}</code>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopy} variant="outline" className="flex-1">
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                Download
              </Button>
            </div>
            <Button onClick={handleClose} className="w-full bg-indigo-600 hover:bg-indigo-700">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}