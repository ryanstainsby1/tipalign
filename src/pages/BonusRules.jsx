import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Plus, Edit2, Trash2, Play, Pause } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { formatMoney } from '@/components/common/formatMoney';

export default function BonusRules() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location_id: null,
    metric: 'sales',
    threshold: 0,
    bonus_amount: 0,
    bonus_type: 'flat',
    period: 'daily',
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: currentOrg } = useQuery({
    queryKey: ['currentOrganization'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCurrentOrganization', {});
      return response.data.success ? response.data.organization : null;
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', currentOrg?.id],
    queryFn: () => base44.entities.Location.filter({
      organization_id: currentOrg?.id,
      active: true
    }),
    enabled: !!currentOrg?.id,
  });

  const { data: bonusRules = [] } = useQuery({
    queryKey: ['bonusRules', currentOrg?.id],
    queryFn: () => base44.entities.BonusRules.filter({
      organization_id: currentOrg?.id
    }),
    enabled: !!currentOrg?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BonusRules.create({
      ...data,
      organization_id: currentOrg?.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonusRules'] });
      setShowDialog(false);
      resetForm();
      toast.success('Bonus rule created');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BonusRules.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonusRules'] });
      setShowDialog(false);
      resetForm();
      toast.success('Bonus rule updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BonusRules.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonusRules'] });
      toast.success('Bonus rule deleted');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.BonusRules.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonusRules'] });
      toast.success('Rule status updated');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      location_id: null,
      metric: 'sales',
      threshold: 0,
      bonus_amount: 0,
      bonus_type: 'flat',
      period: 'daily',
      is_active: true
    });
    setEditingRule(null);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    // Convert pence to pounds for display
    const displayThreshold = rule.metric === 'items' 
      ? rule.threshold 
      : rule.threshold / 100;
    const displayBonusAmount = rule.bonus_type === 'percent'
      ? rule.bonus_amount
      : rule.bonus_amount / 100;
    
    setFormData({
      name: rule.name,
      location_id: rule.location_id,
      metric: rule.metric,
      threshold: displayThreshold,
      bonus_amount: displayBonusAmount,
      bonus_type: rule.bonus_type,
      period: rule.period,
      is_active: rule.is_active
    });
    setShowDialog(true);
  };

  const handleSubmit = () => {
    // Convert pounds to pence for money metrics
    const storeThreshold = formData.metric === 'items' 
      ? parseInt(formData.threshold) 
      : Math.round(parseFloat(formData.threshold) * 100);
    
    const storeBonusAmount = formData.bonus_type === 'percent'
      ? parseInt(formData.bonus_amount)
      : Math.round(parseFloat(formData.bonus_amount) * 100);

    const data = {
      ...formData,
      threshold: storeThreshold,
      bonus_amount: storeBonusAmount
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatValue = (value, metric) => {
    if (metric === 'sales' || metric === 'tips') {
      return formatMoney(value);
    }
    return value.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bonus Rules</h1>
            <p className="text-slate-500 mt-1">Configure performance incentives for your team</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Rule
          </Button>
        </div>

        {bonusRules.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-20 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No bonus rules yet</h3>
              <p className="text-slate-600 mb-6">Create your first performance-based bonus rule</p>
              <Button
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {bonusRules.map((rule) => {
              const location = locations.find(l => l.id === rule.location_id);
              return (
                <Card key={rule.id} className="border-0 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600 rounded-lg">
                          <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{rule.name}</CardTitle>
                          <p className="text-sm text-slate-500 mt-1">
                            {location ? location.name : 'All Locations'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={rule.is_active ? 'default' : 'outline'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActiveMutation.mutate({
                            id: rule.id,
                            is_active: !rule.is_active
                          })}
                        >
                          {rule.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rule)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Delete this bonus rule?')) {
                              deleteMutation.mutate(rule.id);
                            }
                          }}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Metric</p>
                        <p className="text-lg font-semibold text-slate-900 capitalize">{rule.metric}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Threshold</p>
                        <p className="text-lg font-semibold text-slate-900">
                          {formatValue(rule.threshold, rule.metric)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Bonus Reward</p>
                        <p className="text-lg font-semibold text-purple-600">
                          {rule.bonus_type === 'flat'
                            ? formatMoney(rule.bonus_amount)
                            : `${rule.bonus_amount}%`
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Period</p>
                        <p className="text-lg font-semibold text-slate-900 capitalize">{rule.period}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Bonus Rule' : 'Create Bonus Rule'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Daily Sales Target"
                />
              </div>
              
              <div>
                <Label>Location (optional)</Label>
                <Select
                  value={formData.location_id || 'all'}
                  onValueChange={(v) => setFormData({ ...formData, location_id: v === 'all' ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Metric</Label>
                  <Select
                    value={formData.metric}
                    onValueChange={(v) => setFormData({ ...formData, metric: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="tips">Tips</SelectItem>
                      <SelectItem value="items">Items Sold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Period</Label>
                  <Select
                    value={formData.period}
                    onValueChange={(v) => setFormData({ ...formData, period: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Threshold ({formData.metric === 'items' ? 'count' : '£'})</Label>
                <Input
                  type="number"
                  step={formData.metric === 'items' ? '1' : '0.01'}
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                  placeholder={formData.metric === 'items' ? '50' : '500.00'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Bonus Type</Label>
                  <Select
                    value={formData.bonus_type}
                    onValueChange={(v) => setFormData({ ...formData, bonus_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                      <SelectItem value="percent">Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Bonus Amount ({formData.bonus_type === 'flat' ? '£' : '%'})</Label>
                  <Input
                    type="number"
                    step={formData.bonus_type === 'flat' ? '0.01' : '1'}
                    value={formData.bonus_amount}
                    onChange={(e) => setFormData({ ...formData, bonus_amount: e.target.value })}
                    placeholder={formData.bonus_type === 'flat' ? '20.00' : '10'}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Rule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}