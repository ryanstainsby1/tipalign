import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ROLES = ['server', 'bartender', 'host', 'kitchen', 'manager', 'runner'];

export default function AllocationRuleBuilder({ 
  initialPolicy = 'individual',
  initialWeights = {},
  onSave,
  isSaving = false
}) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [roleWeights, setRoleWeights] = useState(
    ROLES.reduce((acc, role) => ({
      ...acc,
      [role]: initialWeights[role] || 1.0
    }), {})
  );
  const [includedRoles, setIncludedRoles] = useState(
    ROLES.reduce((acc, role) => ({ ...acc, [role]: true }), {})
  );

  const handleWeightChange = (role, value) => {
    setRoleWeights(prev => ({
      ...prev,
      [role]: value[0]
    }));
  };

  const handleRoleToggle = (role) => {
    setIncludedRoles(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };

  const handleSave = () => {
    const activeRoles = Object.entries(includedRoles)
      .filter(([_, active]) => active)
      .map(([role]) => role);
    
    const weights = Object.fromEntries(
      Object.entries(roleWeights).filter(([role]) => includedRoles[role])
    );

    onSave?.({
      tip_policy: policy,
      pool_roles: activeRoles,
      role_weights: weights
    });
  };

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          Tip Allocation Rules
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-slate-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Configure how tips are distributed among your team. These rules apply to all new transactions at this location.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Policy Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-700">Allocation Method</Label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'individual', label: 'Individual', desc: 'Tips go to the employee who served' },
              { value: 'pooled', label: 'Pooled', desc: 'Tips split equally among team' },
              { value: 'weighted', label: 'Weighted', desc: 'Tips split by role weights' },
              { value: 'hybrid', label: 'Hybrid', desc: 'Combination of methods' }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPolicy(opt.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  policy === opt.value 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className={`font-medium ${policy === opt.value ? 'text-indigo-700' : 'text-slate-900'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Role Configuration - Only show for pooled/weighted/hybrid */}
        {policy !== 'individual' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">Role Configuration</Label>
              <Badge variant="outline" className="text-xs">
                {Object.values(includedRoles).filter(Boolean).length} roles active
              </Badge>
            </div>
            
            <div className="space-y-3">
              {ROLES.map((role) => (
                <div 
                  key={role}
                  className={`p-4 rounded-xl border transition-all ${
                    includedRoles[role] ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-slate-300" />
                      <span className={`font-medium capitalize ${
                        includedRoles[role] ? 'text-slate-900' : 'text-slate-400'
                      }`}>
                        {role}
                      </span>
                    </div>
                    <Switch
                      checked={includedRoles[role]}
                      onCheckedChange={() => handleRoleToggle(role)}
                    />
                  </div>
                  
                  {includedRoles[role] && policy === 'weighted' && (
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Slider
                          value={[roleWeights[role]]}
                          onValueChange={(v) => handleWeightChange(role, v)}
                          min={0.25}
                          max={2}
                          step={0.25}
                          className="py-2"
                        />
                      </div>
                      <div className="w-16 text-right">
                        <Badge variant="outline" className="font-mono">
                          {roleWeights[role].toFixed(2)}x
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <p className="text-sm font-medium text-slate-700 mb-2">Allocation Preview</p>
          <p className="text-sm text-slate-600">
            {policy === 'individual' && "Each employee keeps tips from their own transactions."}
            {policy === 'pooled' && `Tips will be split equally among ${Object.values(includedRoles).filter(Boolean).length} active roles.`}
            {policy === 'weighted' && "Tips will be split based on configured role weights."}
            {policy === 'hybrid' && "A portion goes to the individual, remainder is pooled."}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline">Cancel</Button>
        <Button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {isSaving ? 'Saving...' : 'Save Rules'}
        </Button>
      </CardFooter>
    </Card>
  );
}