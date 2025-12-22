import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CalendarIcon, 
  Eye, 
  Save, 
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb
} from 'lucide-react';
import { format } from 'date-fns';
import AllocationPreview from '@/components/allocation/AllocationPreview';

const RULE_TEMPLATES = [
  {
    id: 'individual',
    name: 'Direct Attribution',
    description: 'Tips go directly to the employee who processed the transaction',
    method: 'individual',
    icon: '👤',
    default_config: { pool_roles: [] }
  },
  {
    id: 'pooled',
    name: 'Location Pool',
    description: 'All tips pooled and split equally among team',
    method: 'pooled',
    icon: '🤝',
    default_config: { pool_roles: ['server', 'bartender', 'host', 'runner'] }
  },
  {
    id: 'weighted',
    name: 'Role-Weighted Pool',
    description: 'Tips split based on role multipliers',
    method: 'weighted',
    icon: '⚖️',
    default_config: { 
      pool_roles: ['server', 'bartender', 'host', 'kitchen', 'runner'],
      role_weights: { server: 1.2, bartender: 1.2, host: 0.8, kitchen: 1.0, runner: 1.0 }
    }
  },
  {
    id: 'shift_based',
    name: 'Hours-Weighted Pool',
    description: 'Split based on hours worked during shift',
    method: 'shift_based',
    icon: '⏰',
    default_config: { 
      pool_roles: ['server', 'bartender', 'host', 'runner'],
      shift_hours_required: 2
    }
  },
  {
    id: 'hybrid',
    name: 'Hybrid (Direct + Pool)',
    description: 'Employee gets percentage directly, remainder pooled',
    method: 'hybrid',
    icon: '🔀',
    default_config: { 
      pool_roles: ['server', 'bartender', 'host', 'runner'],
      direct_percentage: 50
    }
  }
];

const ROLES = ['server', 'bartender', 'host', 'kitchen', 'manager', 'runner'];

export default function RulesBuilder() {
  const [searchParams] = useSearchParams();
  const locationId = searchParams.get('location');
  const queryClient = useQueryClient();

  const [selectedTemplate, setSelectedTemplate] = useState('individual');
  const [ruleName, setRuleName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date());
  const [poolRoles, setPoolRoles] = useState(['server', 'bartender', 'host', 'runner']);
  const [roleWeights, setRoleWeights] = useState({
    server: 1.2, bartender: 1.2, host: 0.8, kitchen: 1.0, runner: 1.0, manager: 1.5
  });
  const [directPercentage, setDirectPercentage] = useState(50);
  const [tronc, setTronc] = useState(false);
  const [troncMaster, setTroncMaster] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewPeriod, setPreviewPeriod] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date()
  });

  const { data: location } = useQuery({
    queryKey: ['location', locationId],
    queryFn: async () => {
      const locs = await base44.entities.Location.filter({ id: locationId });
      return locs[0];
    },
    enabled: !!locationId
  });

  const { data: currentRules = [] } = useQuery({
    queryKey: ['tipRules', locationId],
    queryFn: () => base44.entities.TipRuleSet.filter({ 
      location_id: locationId,
      is_current: true 
    }),
    enabled: !!locationId
  });

  const { data: previewData, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['allocationPreview', locationId, previewPeriod],
    queryFn: async () => {
      const response = await base44.functions.invoke('executeAllocation', {
        location_id: locationId,
        period_start: previewPeriod.from.toISOString(),
        period_end: previewPeriod.to.toISOString(),
        preview_only: true,
        tip_rule_set_id: null // Use current rules
      });
      return response.data;
    },
    enabled: false
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData) => {
      const template = RULE_TEMPLATES.find(t => t.id === selectedTemplate);
      
      // Get existing versions
      const existingRules = await base44.entities.TipRuleSet.filter({ location_id: locationId });
      const maxVersion = existingRules.reduce((max, r) => Math.max(max, r.version || 0), 0);

      // Build rule definition
      const ruleDefinition = {
        pool_roles: poolRoles,
        ...(template.method === 'weighted' && { role_weights: roleWeights }),
        ...(template.method === 'hybrid' && { direct_percentage: directPercentage }),
        calculation_formula: template.description
      };

      const newRule = await base44.entities.TipRuleSet.create({
        organization_id: location.organization_id,
        location_id: locationId,
        version: maxVersion + 1,
        name: ruleName || `${template.name} v${maxVersion + 1}`,
        effective_from: effectiveDate.toISOString(),
        allocation_method: template.method,
        rule_definition: ruleDefinition,
        tronc_enabled: tronc,
        tronc_master_email: troncMaster,
        is_current: false,
        created_by_email: (await base44.auth.me()).email
      });

      return newRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipRules'] });
    }
  });

  const activateRuleMutation = useMutation({
    mutationFn: async (ruleId) => {
      // Deactivate current rules
      for (const rule of currentRules) {
        await base44.entities.TipRuleSet.update(rule.id, { 
          is_current: false,
          effective_to: new Date().toISOString()
        });
      }

      // Activate new rule
      await base44.entities.TipRuleSet.update(ruleId, { is_current: true });

      // Create audit event
      const user = await base44.auth.me();
      await base44.entities.SystemAuditEvent.create({
        organization_id: location.organization_id,
        event_type: 'tip_rule_updated',
        actor_type: 'user',
        actor_user_id: user.id,
        actor_email: user.email,
        entity_type: 'tip_rule_set',
        entity_id: ruleId,
        changes_summary: 'Activated new tip allocation rule',
        hmrc_relevant: true,
        severity: 'info'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipRules'] });
    }
  });

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = RULE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setPoolRoles(template.default_config.pool_roles || []);
      if (template.default_config.role_weights) {
        setRoleWeights(template.default_config.role_weights);
      }
      if (template.default_config.direct_percentage !== undefined) {
        setDirectPercentage(template.default_config.direct_percentage);
      }
    }
  };

  const handleSave = () => {
    createRuleMutation.mutate();
  };

  const selectedTemplateData = RULE_TEMPLATES.find(t => t.id === selectedTemplate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tip Rules Builder</h1>
          <p className="text-slate-500 mt-1">
            {location?.name || 'Configure'} - Design your tip allocation policy
          </p>
        </div>

        {currentRules.length > 0 && (
          <Alert className="mb-6 border-indigo-200 bg-indigo-50">
            <Info className="w-4 h-4 text-indigo-600" />
            <AlertDescription className="text-indigo-900">
              <strong>Current Rule:</strong> {currentRules[0].name} - {currentRules[0].allocation_method}
              {' '}(v{currentRules[0].version}, effective since {format(new Date(currentRules[0].effective_from), 'PP')})
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Template Selection */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-sm sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg">1. Choose Template</CardTitle>
                <CardDescription>Select an allocation method</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {RULE_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedTemplate === template.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{template.icon}</span>
                      <p className={`font-semibold ${
                        selectedTemplate === template.id ? 'text-indigo-700' : 'text-slate-900'
                      }`}>
                        {template.name}
                      </p>
                    </div>
                    <p className="text-xs text-slate-600">{template.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">2. Configure Rule</CardTitle>
                <CardDescription>{selectedTemplateData?.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    placeholder={`${selectedTemplateData?.name} Policy`}
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Effective From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(effectiveDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={effectiveDate}
                        onSelect={(date) => date && setEffectiveDate(date)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Role Selection */}
                {selectedTemplate !== 'individual' && (
                  <div className="space-y-3">
                    <Label>Included Roles</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {ROLES.map(role => (
                        <label key={role} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-slate-50">
                          <Switch
                            checked={poolRoles.includes(role)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setPoolRoles([...poolRoles, role]);
                              } else {
                                setPoolRoles(poolRoles.filter(r => r !== role));
                              }
                            }}
                          />
                          <span className="text-sm font-medium capitalize">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Role Weights */}
                {selectedTemplate === 'weighted' && (
                  <div className="space-y-4">
                    <Label>Role Multipliers</Label>
                    {poolRoles.map(role => (
                      <div key={role} className="flex items-center gap-4">
                        <span className="w-24 text-sm font-medium capitalize">{role}</span>
                        <Slider
                          value={[roleWeights[role] || 1.0]}
                          onValueChange={(v) => setRoleWeights({ ...roleWeights, [role]: v[0] })}
                          min={0.5}
                          max={2}
                          step={0.1}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="w-16 justify-center">
                          {(roleWeights[role] || 1.0).toFixed(1)}x
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hybrid Direct Percentage */}
                {selectedTemplate === 'hybrid' && (
                  <div className="space-y-3">
                    <Label>Direct Attribution Percentage</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[directPercentage]}
                        onValueChange={(v) => setDirectPercentage(v[0])}
                        min={0}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <Badge variant="outline" className="w-16 justify-center">
                        {directPercentage}%
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Employee gets {directPercentage}% directly, {100 - directPercentage}% goes to pool
                    </p>
                  </div>
                )}

                {/* Tronc */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">Enable Tronc Scheme</p>
                    <p className="text-sm text-slate-500">Independent troncmaster oversees allocations</p>
                  </div>
                  <Switch checked={tronc} onCheckedChange={setTronc} />
                </div>

                {tronc && (
                  <div className="space-y-2">
                    <Label>Tronc Master Email</Label>
                    <Input
                      type="email"
                      placeholder="troncmaster@example.com"
                      value={troncMaster}
                      onChange={(e) => setTroncMaster(e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  3. Preview & Validate
                </CardTitle>
                <CardDescription>Test this rule on historical data before activating</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowPreview(true);
                      refetchPreview();
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Last 7 Days
                  </Button>
                </div>

                {showPreview && previewData && (
                  <AllocationPreview data={previewData} isLoading={previewLoading} />
                )}

                <Alert className="border-amber-200 bg-amber-50">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-amber-900">
                    <strong>Validation:</strong> {poolRoles.length} roles included. 
                    {selectedTemplate === 'weighted' && ` Total weight: ${Object.values(roleWeights).reduce((a, b) => a + b, 0).toFixed(1)}.`}
                    {' '}Preview before activating to ensure expected results.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={createRuleMutation.isPending || !ruleName}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {createRuleMutation.isPending ? 'Saving...' : 'Save Rule'}
              </Button>
              <Button variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}