import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

type SystemSetting = {
  id: string;
  key: string;
  value: any;
  description: string | null;
};

const defaultSettings = {
  company_name: 'Private Fleet Services',
  default_currency: 'USD',
  timezone: 'America/New_York',
  email_notifications: true,
  auto_confirm_quotes: false,
  require_approval_above: 50000,
  max_passengers: 19,
  commission_min_percent: 0,
  commission_max_percent: 25,
};

export function SystemSettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        const settingsMap = data.reduce((acc, setting) => {
          acc[setting.key] = setting.value;
          return acc;
        }, {} as Record<string, any>);
        setSettings({ ...defaultSettings, ...settingsMap });
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Upsert each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            key,
            value,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'key',
          });

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Configure basic system settings and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_currency">Default Currency</Label>
              <Input
                id="default_currency"
                value={settings.default_currency}
                onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_passengers">Max Passengers per Flight</Label>
              <Input
                id="max_passengers"
                type="number"
                value={settings.max_passengers}
                onChange={(e) => setSettings({ ...settings, max_passengers: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure email and system notification preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email_notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications for new requests and updates.
              </p>
            </div>
            <Switch
              id="email_notifications"
              checked={settings.email_notifications}
              onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_confirm_quotes">Auto-confirm Quotes</Label>
              <p className="text-sm text-muted-foreground">
                Automatically confirm quotes below the approval threshold.
              </p>
            </div>
            <Switch
              id="auto_confirm_quotes"
              checked={settings.auto_confirm_quotes}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_confirm_quotes: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Approval Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Workflow</CardTitle>
          <CardDescription>
            Configure approval thresholds and workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="require_approval_above">Require Approval Above ($)</Label>
            <Input
              id="require_approval_above"
              type="number"
              value={settings.require_approval_above}
              onChange={(e) => setSettings({ ...settings, require_approval_above: parseInt(e.target.value) || 0 })}
            />
            <p className="text-sm text-muted-foreground">
              Quotes above this amount will require manager approval.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Commission Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Limits</CardTitle>
          <CardDescription>
            The allowed range for the commission % Sales enters when preparing a client quotation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="commission_min_percent">Minimum Commission %</Label>
              <Input
                id="commission_min_percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.commission_min_percent}
                onChange={(e) => setSettings({ ...settings, commission_min_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission_max_percent">Maximum Commission %</Label>
              <Input
                id="commission_max_percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.commission_max_percent}
                onChange={(e) => setSettings({ ...settings, commission_max_percent: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Sales won't be able to generate a quotation with a commission % outside this range.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isSaving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
