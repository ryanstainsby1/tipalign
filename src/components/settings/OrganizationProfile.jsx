import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function OrganizationProfile({ squareConnection }) {
  const [timezone, setTimezone] = useState('Europe/London');

  const handleSave = () => {
    toast.success('Organization profile updated');
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Organization Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Merchant Name</Label>
          <Input 
            value={squareConnection?.merchant_business_name || 'Not connected'}
            disabled
            className="mt-2"
          />
          <p className="text-xs text-slate-500 mt-1">Auto-filled from Square</p>
        </div>

        <div>
          <Label>Business Address</Label>
          <Input 
            value="Auto-filled from Square"
            disabled
            className="mt-2"
          />
          <p className="text-xs text-slate-500 mt-1">Synced from your Square account</p>
        </div>

        <div>
          <Label>Locations Managed</Label>
          <Input 
            value="Auto-filled from Square"
            disabled
            className="mt-2"
          />
          <p className="text-xs text-slate-500 mt-1">Automatically synced</p>
        </div>

        <div>
          <Label>Logo</Label>
          <div className="mt-2 border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-600 mb-2">Upload your business logo</p>
            <Button variant="outline" size="sm">Choose File</Button>
          </div>
        </div>

        <div>
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
              <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
              <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700">
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}