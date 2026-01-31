import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Wallet, QrCode, RefreshCw, Download, Mail, Clock, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function WalletPassSection({ employee, walletPass, onRefresh }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [walletConfig, setWalletConfig] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const handleGeneratePass = async () => {
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('issueEmployeeWalletPass', {
        employee_id: employee.id
      });

      if (response.data.success) {
        toast.success('Apple Wallet pass generated', {
          description: response.data.is_new_pass ? 'New pass created' : 'Existing pass retrieved'
        });
        if (onRefresh) onRefresh();
      }
    } catch (error) {
      toast.error('Failed to generate wallet pass', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToWallet = () => {
    if (walletPass) {
      const baseUrl = 'https://tip-align-29fe435b.base44.app';
      const pkpassUrl = `${baseUrl}/functions/employeePassPkpass?employeeId=${employee.id}&serial=${walletPass.pass_serial_number}&auth=${walletPass.pass_auth_token}`;
      window.location.href = pkpassUrl;
    }
  };

  const handleSendInvite = async () => {
    setIsSending(true);
    try {
      const response = await base44.functions.invoke('walletInvite', {
        employee_id: employee.id,
        invite_method: 'email'
      });

      if (response.data.success) {
        if (response.data.requires_manual_share) {
          setShareUrl(response.data.wallet_url);
          setShowShareModal(true);
          toast.info('Email not configured', {
            description: 'Share the wallet link manually with the employee'
          });
        } else {
          toast.success('Invite sent!', {
            description: `Wallet invite emailed to ${employee.email}`
          });
          loadInvites();
        }
      } else {
        toast.error('Failed to send invite', {
          description: response.data.error || 'Unknown error'
        });
      }
    } catch (error) {
      toast.error('Failed to send invite', {
        description: error.message
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generatePkpass', {
        employee_id: employee.id
      });

      if (response.data.success) {
        toast.success('Pass generated!', {
          description: 'Pass data ready for download'
        });
        console.log('Pass JSON:', response.data.pass_json);
      }
    } catch (error) {
      toast.error('Failed to generate pass', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const [invites, setInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const allInvites = await base44.entities.WalletInvite.filter({
        employee_id: employee.id
      });
      setInvites(allInvites.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at)));
    } catch (error) {
      console.error('Failed to load invites:', error);
    } finally {
      setLoadingInvites(false);
    }
  };

  const checkWalletConfig = async () => {
    try {
      const response = await base44.functions.invoke('walletConfigCheck', {});
      setWalletConfig(response.data);
    } catch (error) {
      console.error('Failed to check wallet config:', error);
    }
  };

  useEffect(() => {
    checkWalletConfig();
    if (walletPass) {
      loadInvites();
    }
  }, [walletPass]);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              Mobile Wallet
            </CardTitle>
            <CardDescription>
              Apple Wallet pass for real-time tip tracking
            </CardDescription>
          </div>
          {walletPass && (
            <Badge className="bg-emerald-100 text-emerald-700">
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!walletPass ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">No wallet pass yet</h3>
            <p className="text-sm text-slate-600 mb-4">
              Generate an Apple Wallet pass so {employee.full_name} can track tips on their phone
            </p>
            <Button 
              onClick={handleGeneratePass}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Generate Apple Wallet Pass
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pass Info */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Serial Number:</span>
                  <p className="font-mono text-xs text-slate-900 mt-1">
                    {walletPass.pass_serial_number.substring(0, 8)}...
                  </p>
                </div>
                <div>
                  <span className="text-slate-600">Last Updated:</span>
                  <p className="text-slate-900 mt-1">
                    {walletPass.last_pass_update_at 
                      ? format(new Date(walletPass.last_pass_update_at), 'MMM d, yyyy')
                      : 'Never'
                    }
                  </p>
                </div>
                <div>
                  <span className="text-slate-600">Current Period Tips:</span>
                  <p className="text-lg font-bold text-indigo-600 mt-1">
                    £{((walletPass.last_tip_total || 0) / 100).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-600">Status:</span>
                  <p className="text-slate-900 mt-1 capitalize">{walletPass.pass_status}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                onClick={handleSendInvite}
                disabled={isSending || !employee.email}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Wallet Invite
                  </>
                )}
              </Button>
              <div className="flex gap-3">
                <Button 
                  onClick={handleDownload}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  {isGenerating ? 'Generating...' : 'Download'}
                </Button>
                <Button 
                  onClick={handleGeneratePass}
                  disabled={isGenerating}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>
            </div>

            {/* Invites Section */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-3 text-sm">Invite History</h4>
              
              {loadingInvites ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : invites.length === 0 ? (
                <p className="text-sm text-slate-500">No wallet invites sent yet</p>
              ) : (
                <div className="space-y-2">
                  {invites.map((invite) => {
                    const statusConfig = {
                      pending: { icon: Clock, color: 'text-slate-500', label: 'Pending' },
                      opened: { icon: Mail, color: 'text-blue-600', label: 'Opened' },
                      installed: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Installed' },
                      expired: { icon: XCircle, color: 'text-rose-600', label: 'Expired' },
                      revoked: { icon: XCircle, color: 'text-rose-600', label: 'Revoked' }
                    }[invite.status] || { icon: Clock, color: 'text-slate-500', label: invite.status };
                    
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div key={invite.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                            <span className="text-sm font-medium text-slate-900">{statusConfig.label}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(invite.sent_at).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 space-y-0.5">
                          <div>To: {invite.delivery_target}</div>
                          {invite.opened_at && (
                            <div>Opened: {new Date(invite.opened_at).toLocaleString('en-GB')}</div>
                          )}
                          {invite.installed_at && (
                            <div>Installed: {new Date(invite.installed_at).toLocaleString('en-GB')}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* QR Code for Tipping */}
            {walletPass.last_qr_url && (
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg">
                    <QrCode className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-indigo-900 mb-1">Tipping QR Code</h4>
                    <p className="text-sm text-indigo-700 mb-2">
                      Customers can scan this to leave a tip directly to {employee.full_name}
                    </p>
                    <code className="text-xs bg-white px-2 py-1 rounded border border-indigo-200 break-all">
                      {walletPass.last_qr_url}
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* Config Status - Only show if wallet not configured */}
            {walletConfig && !walletConfig.wallet_configured && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-2 text-sm">Apple Wallet Setup Required</h4>
                <div className="text-xs text-amber-700 space-y-1">
                  <p><strong>Administrator:</strong> Configure Apple Wallet certificates in environment variables</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Share Link Modal */}
        <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Wallet Link</DialogTitle>
              <DialogDescription>
                Email is not configured. Share this link manually with {employee.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600 mb-2">Wallet Pass URL:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white p-2 rounded border border-slate-300 break-all">
                    {shareUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(shareUrl)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}