import { useEffect, useMemo, useState } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Clock, Palette, Save, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ThemeOption = 'auto' | 'light' | 'dark';
type DigestFrequency = 'daily' | 'weekly' | 'monthly';

type AppSettings = {
  emailNotifications: boolean;
  enableSmartAlerts: boolean;
  weeklyDigestFrequency: DigestFrequency;
  workingHoursStart: string;
  workingHoursEnd: string;
  timezone: string;
  theme: ThemeOption;
  dataExportEmail: string;
};

const STORAGE_KEY = 'talentflow:settings';

const DEFAULT_SETTINGS: AppSettings = {
  emailNotifications: true,
  enableSmartAlerts: true,
  weeklyDigestFrequency: 'weekly',
  workingHoursStart: '09:00',
  workingHoursEnd: '17:00',
  timezone: 'UTC',
  theme: 'auto',
  dataExportEmail: 'hr@company.com',
};

const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
];

const Toggle = ({ checked, onToggle }: { checked: boolean; onToggle: () => void }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? 'bg-purple-500' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
        checked ? 'translate-x-5' : 'translate-x-1'
      }`}
    ></span>
  </button>
);

export const Settings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error'>('success');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings', error);
    }
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const timezoneLabel = useMemo(() => {
    try {
      const date = new Date();
      return new Intl.DateTimeFormat('en', {
        timeZone: settings.timezone,
        timeStyle: 'short',
      }).format(date);
    } catch (_) {
      return 'Current time unavailable';
    }
  }, [settings.timezone]);

  const toggleSetting = (key: 'emailNotifications' | 'enableSmartAlerts') => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateSetting = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setStatusTone('success');
      setStatusMessage('Settings saved successfully.');
    } catch (error) {
      console.error('Failed to save settings', error);
      setStatusTone('error');
      setStatusMessage('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setStatusTone('success');
    setStatusMessage('Settings restored to defaults.');
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 p-3 shadow-lg shadow-purple-500/40">
                <SettingsIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Workspace Settings</h1>
                <p className="text-sm text-gray-600">
                  Configure notification preferences, schedules, and personalization options.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              statusTone === 'success'
                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-800'
                : 'border-red-500/30 bg-red-50 text-red-800'
            }`}
          >
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Bell className="h-5 w-5 text-purple-600" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Email notifications</p>
                  <p className="text-xs text-gray-600">
                    Receive alerts about onboarding progress and employee milestones.
                  </p>
                </div>
                <Toggle
                  checked={settings.emailNotifications}
                  onToggle={() => toggleSetting('emailNotifications')}
                />
              </label>

              <label className="flex items-center justify-between gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Smart alerts</p>
                  <p className="text-xs text-gray-600">
                    Let the AI assistant flag approvals or risks that need attention.
                  </p>
                </div>
                <Toggle
                  checked={settings.enableSmartAlerts}
                  onToggle={() => toggleSetting('enableSmartAlerts')}
                />
              </label>

              <div className="space-y-2">
                <p className="text-sm font-medium text-white">Digest frequency</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as DigestFrequency[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => updateSetting('weeklyDigestFrequency', option)}
                      className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                        settings.weeklyDigestFrequency === option
                          ? 'border-purple-500/50 bg-purple-50 text-purple-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-purple-500/30 hover:bg-purple-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Clock className="h-5 w-5 text-purple-600" />
                Working Hours & Timezone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-gray-600">Start</span>
                  <Input
                    type="time"
                    value={settings.workingHoursStart}
                    onChange={(event) => updateSetting('workingHoursStart', event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-wide text-gray-600">End</span>
                  <Input
                    type="time"
                    value={settings.workingHoursEnd}
                    onChange={(event) => updateSetting('workingHoursEnd', event.target.value)}
                  />
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-gray-600">Timezone</span>
                <select
                  value={settings.timezone}
                  onChange={(event) => updateSetting('timezone', event.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-white"
                >
                  {TIMEZONE_OPTIONS.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Local time in selected timezone: <span className="text-gray-900">{timezoneLabel}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Palette className="h-5 w-5 text-purple-600" />
                Personalization
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900">Theme</p>
                <div className="flex items-center gap-2">
                  {(['auto', 'dark', 'light'] as ThemeOption[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => updateSetting('theme', option)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${
                        settings.theme === option
                          ? 'border-purple-500/50 bg-purple-50 text-purple-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-purple-500/30 hover:bg-purple-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600">
                  Auto mode follows the system preference or browser theme.
                </p>
              </div>

              <div className="space-y-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-gray-900">Data export email</span>
                  <Input
                    type="email"
                    value={settings.dataExportEmail}
                    onChange={(event) => updateSetting('dataExportEmail', event.target.value)}
                    placeholder="reports@company.com"
                  />
                </label>
                <p className="text-xs text-gray-600">
                  Automated reports and policy exports are delivered to this address.
                </p>
              </div>

              <div className="md:col-span-2 rounded-lg border border-purple-500/20 bg-purple-50 px-4 py-3 text-xs text-purple-900 flex items-start gap-3">
                <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  These preferences are stored locally in your browser. Workspace admins can provision
                  defaults for all HR partners in future releases.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};


