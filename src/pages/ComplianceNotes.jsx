import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Lock, 
  Database, 
  FileText,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export default function ComplianceNotes() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Implementation & Compliance Notes
          </h1>
          <p className="text-slate-500 mt-1">
            Technical documentation for UK hospitality operators
          </p>
        </div>

        {/* Overview */}
        <Alert className="mb-6 border-indigo-200 bg-indigo-50">
          <Shield className="w-4 h-4 text-indigo-600" />
          <AlertDescription className="text-indigo-900">
            <strong>TipFlow</strong> is designed to meet UK employment law requirements for transparent tip distribution. 
            This document explains our data handling, compliance approach, and integration with Square.
          </AlertDescription>
        </Alert>

        {/* Data Handling */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Data Handling & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">What We Store</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span><strong>Square Data:</strong> Location names, employee names/IDs, payment amounts, tip amounts, shift records</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span><strong>Tip Allocations:</strong> Calculated distributions, allocation methods, timestamps, audit hashes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span><strong>Audit Logs:</strong> All changes to allocations, disputes, adjustments with actor identification</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span><strong>Optional Payroll Data:</strong> National Insurance numbers and bank details are stored encrypted if provided, but are NOT required for basic operation</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-slate-50">
              <h4 className="font-semibold text-slate-900 mb-2">Data Minimization</h4>
              <p className="text-sm text-slate-700">
                We follow GDPR data minimization principles. Sensitive payroll information (NI numbers, bank details) is optional. 
                The core tip allocation and reporting functionality works without this data. Operators can choose to store it 
                encrypted for convenience, or maintain it separately in their payroll system.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Square Integration */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              Square Integration Architecture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">OAuth & Permissions</h3>
              <div className="space-y-2 text-sm text-slate-700">
                <p>TipFlow uses OAuth 2.0 to securely connect to Square. We request minimal scopes:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">MERCHANT_PROFILE_READ</code> - Business details</li>
                  <li><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">PAYMENTS_READ</code> - View payment transactions and tips</li>
                  <li><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">EMPLOYEES_READ</code> - View team member information</li>
                  <li><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">TIMECARDS_READ</code> - View shift and hours data</li>
                </ul>
                <p className="mt-2">We do NOT request write permissions or access to customer data.</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <h4 className="font-semibold text-emerald-900 mb-2">Security Measures</h4>
              <ul className="space-y-1 text-sm text-emerald-800">
                <li>• OAuth tokens stored encrypted at rest</li>
                <li>• Webhook signature verification for all incoming Square events</li>
                <li>• Idempotency keys prevent duplicate processing</li>
                <li>• Automatic retry logic with exponential backoff</li>
                <li>• Rate limiting on API calls to prevent abuse</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* UK Compliance */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              UK Employment Law Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Employment (Allocation of Tips) Act 2023</h3>
              <p className="text-sm text-slate-700 mb-3">
                TipFlow is designed to help employers comply with the Act's requirements:
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="font-medium text-slate-900 text-sm mb-1">✓ Fair & Transparent Distribution</p>
                  <p className="text-xs text-slate-600">
                    All allocation rules are versioned and documented. Employees can see exactly how their tips were calculated.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="font-medium text-slate-900 text-sm mb-1">✓ Timely Payment</p>
                  <p className="text-xs text-slate-600">
                    Export to payroll within required timeframes. Track pending vs exported tips.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="font-medium text-slate-900 text-sm mb-1">✓ Audit Trail</p>
                  <p className="text-xs text-slate-600">
                    Immutable records with SHA-256 hashes. Every change logged with timestamp and actor.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50">
                  <p className="font-medium text-slate-900 text-sm mb-1">✓ Employee Access</p>
                  <p className="text-xs text-slate-600">
                    Employees can view their tip history and raise disputes if needed.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">HMRC Reporting</h3>
              <p className="text-sm text-slate-700">
                TipFlow generates audit packs for HMRC compliance reviews, including:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-slate-700 mt-2">
                <li>Total tips received by location and period</li>
                <li>Allocation method documentation with rule versions</li>
                <li>Individual employee allocations with explanations</li>
                <li>Adjustment records with approval trails</li>
                <li>Handling of refunds and disputes</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Integration */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle>Payroll Integration Approach</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">CSV Export Format</h3>
              <p className="text-sm text-slate-700 mb-3">
                TipFlow generates CSV files compatible with major UK payroll systems:
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border border-slate-200 px-3 py-2 text-left">Column</th>
                      <th className="border border-slate-200 px-3 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Payroll ID</td>
                      <td className="border border-slate-200 px-3 py-2">Employee's payroll reference</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Employee Name</td>
                      <td className="border border-slate-200 px-3 py-2">Full name</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Period Start/End</td>
                      <td className="border border-slate-200 px-3 py-2">Tax period dates</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Total Tips Allocated</td>
                      <td className="border border-slate-200 px-3 py-2">Gross tips before adjustments</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Adjustments</td>
                      <td className="border border-slate-200 px-3 py-2">Corrections, disputes, clawbacks</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Net Tips for Payroll</td>
                      <td className="border border-slate-200 px-3 py-2">Final amount to process</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Location Breakdown</td>
                      <td className="border border-slate-200 px-3 py-2">Tips by location (for multi-site)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
              <h4 className="font-semibold text-indigo-900 mb-2">Tax Treatment</h4>
              <p className="text-sm text-indigo-800">
                Tips distributed through TipFlow should be processed through PAYE as tronc payments. 
                Operators may appoint an independent troncmaster to potentially qualify for National Insurance savings. 
                <strong> Consult with your accountant or payroll provider for specific tax treatment.</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Scalability */}
        <Card className="border-0 shadow-sm mb-6">
          <CardHeader>
            <CardTitle>Scalability & Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Multi-Site Support</h3>
              <p className="text-sm text-slate-700 mb-3">
                TipFlow is architected to handle enterprises with 100+ locations:
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Batch processing prevents timeout issues</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Incremental sync using cursors and watermarks</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Webhooks for real-time updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Location-specific rule sets and allocations</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Error Handling & Reliability</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li>• Automatic retries with exponential backoff</li>
                <li>• Idempotency prevents duplicate allocations</li>
                <li>• Detailed error logging and monitoring</li>
                <li>• Graceful degradation if Square is unavailable</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Uninstall Hygiene */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Disconnection & Data Retention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">What Happens When You Disconnect</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span>OAuth tokens are revoked with Square immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <span>Webhook subscriptions are cancelled</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Historical tip records and audit logs are preserved for compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Previously exported payroll files remain accessible</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>HMRC audit packs can still be generated from historical data</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-slate-50">
              <h4 className="font-semibold text-slate-900 mb-2">Data Retention Policy</h4>
              <p className="text-sm text-slate-700">
                UK employment law requires tip records to be retained for 6 years. TipFlow maintains all tip allocation 
                records, audit logs, and exports for this period even after disconnection. You can request complete data 
                export or deletion after the retention period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}