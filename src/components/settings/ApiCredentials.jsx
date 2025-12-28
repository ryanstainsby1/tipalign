import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Key, AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ApiCredentials() {
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', scopes: [] });
  const [generatedKey, setGeneratedKey] = useState(null);

  const existingKeys = [
    { 
      id: '1', 
      name: 'Production API Key',
      key: 'sk_live_••••••••••••1234',
      created: new Date('2025-01-01'),
      lastUsed: new Date('2025-12-28')
    }
  ];

  const scopes = [
    { id: 'read-tips', label: 'Read tips data' },
    { id: 'read-allocations', label: 'Read allocations' },
    { id: 'export-payroll', label: 'Export payroll data' },
    { id: 'manage-employees', label: 'Manage employees' }
  ];

  const handleGenerateKey = () => {
    const key = 'sk_live_' + Math.random().toString(36).substring(2, 34);
    setGeneratedKey(key);
    toast.success('API key generated successfully');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleDownload = (key) => {
    const blob = new Blob([key], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tiply-api-key.txt';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <p className="text-sm text-slate-600 mt-1">For advanced integrations</p>
            </div>
            <Button onClick={() => setShowNewKeyModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Create New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Key className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              Use these keys to integrate Tiply with external systems. Keep your API keys secure and never share them publicly.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {existingKeys.map(key => (
              <div key={key.id} className="p-5 border border-slate-200 rounded-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">{key.name}</h4>
                    <code className="text-sm text-slate-600 bg-slate-100 px-2 py-1 rounded mt-2 inline-block">
                      {key.key}
                    </code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(key.key)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-6 text-sm text-slate-600">
                  <span>Created: {format(key.created, 'MMM d, yyyy')}</span>
                  <span>Last used: {format(key.lastUsed, 'MMM d, yyyy')}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm">Regenerate</Button>
                  <Button variant="outline" size="sm" className="text-rose-600">Revoke</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewKeyModal} onOpenChange={setShowNewKeyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for external integrations
            </DialogDescription>
          </DialogHeader>

          {!generatedKey ? (
            <>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Key Name</Label>
                  <Input
                    placeholder="e.g., Production Key"
                    value={newKey.name}
                    onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Permissions</Label>
                  <div className="space-y-3">
                    {scopes.map(scope => (
                      <div key={scope.id} className="flex items-center gap-2">
                        <Checkbox
                          id={scope.id}
                          checked={newKey.scopes.includes(scope.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewKey({ ...newKey, scopes: [...newKey.scopes, scope.id] });
                            } else {
                              setNewKey({ ...newKey, scopes: newKey.scopes.filter(s => s !== scope.id) });
                            }
                          }}
                        />
                        <Label htmlFor={scope.id} className="cursor-pointer">
                          {scope.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewKeyModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerateKey}
                  disabled={!newKey.name || newKey.scopes.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Generate Key
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <strong>Save this key now!</strong> You won't be able to see it again.
                </AlertDescription>
              </Alert>

              <div className="py-4">
                <Label>Your New API Key</Label>
                <div className="mt-2 p-4 bg-slate-100 rounded-lg border border-slate-200">
                  <code className="text-sm text-slate-900 break-all">{generatedKey}</code>
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => handleCopy(generatedKey)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Key
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleDownload(generatedKey)}
                >
                  Download as .txt
                </Button>
                <Button 
                  onClick={() => {
                    setShowNewKeyModal(false);
                    setGeneratedKey(null);
                    setNewKey({ name: '', scopes: [] });
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}