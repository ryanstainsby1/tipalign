import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle, XCircle, AlertCircle, Clock, Play } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ButtonWiringChecklist() {
  const [testingItem, setTestingItem] = useState(null);
  const [testNotes, setTestNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['buttonWiringTests'],
    queryFn: () => base44.entities.ButtonWiringTest.list(),
  });

  const updateTestMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ButtonWiringTest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buttonWiringTests'] });
      setTestingItem(null);
      setTestNotes('');
      toast.success('Test result saved');
    },
  });

  const handleTest = async (test, status) => {
    const user = await base44.auth.me();
    updateTestMutation.mutate({
      id: test.id,
      data: {
        status,
        last_tested_at: new Date().toISOString(),
        tested_by_email: user.email,
        test_notes: testNotes
      }
    });
  };

  const statusConfig = {
    working: { icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Working' },
    failing: { icon: XCircle, color: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Failing' },
    not_implemented: { icon: Clock, color: 'bg-slate-50 text-slate-700 border-slate-200', label: 'Not Implemented' },
    partial: { icon: AlertCircle, color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Partial' }
  };

  const groupedTests = tests.reduce((acc, test) => {
    if (!acc[test.page]) acc[test.page] = [];
    acc[test.page].push(test);
    return acc;
  }, {});

  const statusCounts = {
    working: tests.filter(t => t.status === 'working').length,
    failing: tests.filter(t => t.status === 'failing').length,
    not_implemented: tests.filter(t => t.status === 'not_implemented').length,
    partial: tests.filter(t => t.status === 'partial').length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Button Wiring Checklist</h1>
          <p className="text-slate-500 mt-1">Test and track clickable element functionality</p>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Object.entries(statusCounts).map(([status, count]) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            return (
              <Card key={status} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{count}</p>
                      <p className="text-sm text-slate-500">{config.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tests by Page */}
        {Object.entries(groupedTests).map(([page, pageTests]) => (
          <Card key={page} className="border-0 shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{page}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead>Element</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Tested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTests.map(test => {
                    const config = statusConfig[test.status];
                    const Icon = config.icon;
                    return (
                      <TableRow key={test.id}>
                        <TableCell className="font-medium">{test.element_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {test.element_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-xs truncate">
                          {test.action_description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.color}>
                            <Icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {test.last_tested_at 
                            ? format(new Date(test.last_tested_at), 'dd MMM HH:mm')
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTestingItem(test);
                              setTestNotes(test.test_notes || '');
                            }}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Test
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        {/* Test Dialog */}
        <Dialog open={!!testingItem} onOpenChange={() => setTestingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test: {testingItem?.element_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">
                  <strong>Action:</strong> {testingItem?.action_description}
                </p>
                {testingItem?.wiring_map && (
                  <div className="p-3 rounded-lg bg-slate-50 text-xs space-y-1">
                    <p><strong>Handler:</strong> {testingItem.wiring_map.handler}</p>
                    <p><strong>API:</strong> {testingItem.wiring_map.api_endpoint}</p>
                    {testingItem.wiring_map.db_operations?.length > 0 && (
                      <p><strong>DB:</strong> {testingItem.wiring_map.db_operations.join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Test Notes</label>
                <Textarea
                  value={testNotes}
                  onChange={(e) => setTestNotes(e.target.value)}
                  placeholder="Add notes about the test result..."
                  className="h-24"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setTestingItem(null)}>Cancel</Button>
              <Button 
                onClick={() => handleTest(testingItem, 'failing')}
                variant="outline"
                className="bg-rose-50 text-rose-700 border-rose-200"
              >
                Mark Failing
              </Button>
              <Button 
                onClick={() => handleTest(testingItem, 'partial')}
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200"
              >
                Mark Partial
              </Button>
              <Button 
                onClick={() => handleTest(testingItem, 'working')}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Mark Working
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}