import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Save,
  Clock,
  UserX,
  Globe,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Security Settings | Admin" },
    { name: "description", content: "Configure platform security settings" },
  ];
};

interface SecuritySettings {
  // Password policies
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  passwordExpiryDays: number;
  // Session settings
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  rememberMeDays: number;
  // Login security
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  enableCaptcha: boolean;
  enableTwoFactor: boolean;
  // IP & Access
  enableIpWhitelist: boolean;
  ipWhitelist: string[];
  enableRateLimiting: boolean;
  rateLimitRequestsPerMinute: number;
  // Audit
  enableAuditLog: boolean;
  auditLogRetentionDays: number;
}

const defaultSettings: SecuritySettings = {
  minPasswordLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  passwordExpiryDays: 0,
  sessionTimeoutMinutes: 60,
  maxConcurrentSessions: 5,
  rememberMeDays: 30,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  enableCaptcha: false,
  enableTwoFactor: false,
  enableIpWhitelist: false,
  ipWhitelist: [],
  enableRateLimiting: true,
  rateLimitRequestsPerMinute: 100,
  enableAuditLog: true,
  auditLogRetentionDays: 90,
};

export async function clientLoader() {
  try {
    const settingsRes = await adminApi.getSettings();
    return {
      settings: (settingsRes.security as unknown as SecuritySettings) || defaultSettings,
      error: null,
    };
  } catch (error: any) {
    return {
      settings: defaultSettings,
      error: error?.message || "Failed to load security settings",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  
  const ipWhitelistRaw = formData.get("ipWhitelist") as string;
  const ipWhitelist = ipWhitelistRaw
    ? ipWhitelistRaw.split("\n").map((ip) => ip.trim()).filter(Boolean)
    : [];

  const settings: Partial<SecuritySettings> = {
    minPasswordLength: parseInt(formData.get("minPasswordLength") as string, 10),
    requireUppercase: formData.get("requireUppercase") === "true",
    requireLowercase: formData.get("requireLowercase") === "true",
    requireNumbers: formData.get("requireNumbers") === "true",
    requireSpecialChars: formData.get("requireSpecialChars") === "true",
    passwordExpiryDays: parseInt(formData.get("passwordExpiryDays") as string, 10),
    sessionTimeoutMinutes: parseInt(formData.get("sessionTimeoutMinutes") as string, 10),
    maxConcurrentSessions: parseInt(formData.get("maxConcurrentSessions") as string, 10),
    rememberMeDays: parseInt(formData.get("rememberMeDays") as string, 10),
    maxLoginAttempts: parseInt(formData.get("maxLoginAttempts") as string, 10),
    lockoutDurationMinutes: parseInt(formData.get("lockoutDurationMinutes") as string, 10),
    enableCaptcha: formData.get("enableCaptcha") === "true",
    enableTwoFactor: formData.get("enableTwoFactor") === "true",
    enableIpWhitelist: formData.get("enableIpWhitelist") === "true",
    ipWhitelist,
    enableRateLimiting: formData.get("enableRateLimiting") === "true",
    rateLimitRequestsPerMinute: parseInt(formData.get("rateLimitRequestsPerMinute") as string, 10),
    enableAuditLog: formData.get("enableAuditLog") === "true",
    auditLogRetentionDays: parseInt(formData.get("auditLogRetentionDays") as string, 10),
  };

  try {
    await adminApi.updateSettings({ security: settings });
    return { success: true, message: "Security settings updated successfully" };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.message || "Failed to update settings",
    };
  }
}

export default function SecuritySettingsPage() {
  const { settings, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [formValues, setFormValues] = useState<SecuritySettings>(settings);

  useEffect(() => {
    if (settings) {
      setFormValues(settings);
    }
  }, [settings]);

  const ToggleSwitch = ({
    name,
    checked,
    onChange,
  }: {
    name: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
    </>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin/system"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          ← Back to System Settings
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure platform security policies and access controls
        </p>
      </div>

      {/* Action Messages */}
      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5 inline-block mr-2" />
          {actionData.message}
        </div>
      )}
      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <XCircle className="w-5 h-5 inline-block mr-2" />
          {actionData.error}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
          <AlertTriangle className="w-5 h-5 inline-block mr-2" />
          Using default settings: {error}
        </div>
      )}

      <Form method="post">
        {/* Password Policy */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">Password Policy</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label htmlFor="minPasswordLength" className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Password Length
              </label>
              <input
                type="number"
                id="minPasswordLength"
                name="minPasswordLength"
                min="6"
                max="32"
                value={formValues.minPasswordLength}
                onChange={(e) => setFormValues({ ...formValues, minPasswordLength: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="passwordExpiryDays" className="block text-sm font-medium text-gray-700 mb-1">
                Password Expiry (days, 0 = never)
              </label>
              <input
                type="number"
                id="passwordExpiryDays"
                name="passwordExpiryDays"
                min="0"
                max="365"
                value={formValues.passwordExpiryDays}
                onChange={(e) => setFormValues({ ...formValues, passwordExpiryDays: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Uppercase Letters</p>
                <p className="text-sm text-gray-500">Password must contain A-Z</p>
              </div>
              <ToggleSwitch
                name="requireUppercase"
                checked={formValues.requireUppercase}
                onChange={(checked) => setFormValues({ ...formValues, requireUppercase: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Lowercase Letters</p>
                <p className="text-sm text-gray-500">Password must contain a-z</p>
              </div>
              <ToggleSwitch
                name="requireLowercase"
                checked={formValues.requireLowercase}
                onChange={(checked) => setFormValues({ ...formValues, requireLowercase: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Numbers</p>
                <p className="text-sm text-gray-500">Password must contain 0-9</p>
              </div>
              <ToggleSwitch
                name="requireNumbers"
                checked={formValues.requireNumbers}
                onChange={(checked) => setFormValues({ ...formValues, requireNumbers: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Special Characters</p>
                <p className="text-sm text-gray-500">Password must contain !@#$%^&* etc.</p>
              </div>
              <ToggleSwitch
                name="requireSpecialChars"
                checked={formValues.requireSpecialChars}
                onChange={(checked) => setFormValues({ ...formValues, requireSpecialChars: checked })}
              />
            </div>
          </div>
        </div>

        {/* Session Settings */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">Session Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="sessionTimeoutMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                id="sessionTimeoutMinutes"
                name="sessionTimeoutMinutes"
                min="5"
                max="1440"
                value={formValues.sessionTimeoutMinutes}
                onChange={(e) => setFormValues({ ...formValues, sessionTimeoutMinutes: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="maxConcurrentSessions" className="block text-sm font-medium text-gray-700 mb-1">
                Max Concurrent Sessions
              </label>
              <input
                type="number"
                id="maxConcurrentSessions"
                name="maxConcurrentSessions"
                min="1"
                max="20"
                value={formValues.maxConcurrentSessions}
                onChange={(e) => setFormValues({ ...formValues, maxConcurrentSessions: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="rememberMeDays" className="block text-sm font-medium text-gray-700 mb-1">
                Remember Me Duration (days)
              </label>
              <input
                type="number"
                id="rememberMeDays"
                name="rememberMeDays"
                min="1"
                max="90"
                value={formValues.rememberMeDays}
                onChange={(e) => setFormValues({ ...formValues, rememberMeDays: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Login Security */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <UserX className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-semibold text-gray-900">Login Security</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <label htmlFor="maxLoginAttempts" className="block text-sm font-medium text-gray-700 mb-1">
                Max Login Attempts
              </label>
              <input
                type="number"
                id="maxLoginAttempts"
                name="maxLoginAttempts"
                min="3"
                max="20"
                value={formValues.maxLoginAttempts}
                onChange={(e) => setFormValues({ ...formValues, maxLoginAttempts: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="lockoutDurationMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                Lockout Duration (minutes)
              </label>
              <input
                type="number"
                id="lockoutDurationMinutes"
                name="lockoutDurationMinutes"
                min="1"
                max="1440"
                value={formValues.lockoutDurationMinutes}
                onChange={(e) => setFormValues({ ...formValues, lockoutDurationMinutes: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable CAPTCHA</p>
                <p className="text-sm text-gray-500">Show CAPTCHA after failed login attempts</p>
              </div>
              <ToggleSwitch
                name="enableCaptcha"
                checked={formValues.enableCaptcha}
                onChange={(checked) => setFormValues({ ...formValues, enableCaptcha: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Allow users to enable 2FA for their accounts</p>
              </div>
              <ToggleSwitch
                name="enableTwoFactor"
                checked={formValues.enableTwoFactor}
                onChange={(checked) => setFormValues({ ...formValues, enableTwoFactor: checked })}
              />
            </div>
          </div>
        </div>

        {/* IP & Rate Limiting */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold text-gray-900">IP & Rate Limiting</h2>
          </div>

          <div className="space-y-4 mb-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable Rate Limiting</p>
                <p className="text-sm text-gray-500">Limit API requests per IP address</p>
              </div>
              <ToggleSwitch
                name="enableRateLimiting"
                checked={formValues.enableRateLimiting}
                onChange={(checked) => setFormValues({ ...formValues, enableRateLimiting: checked })}
              />
            </div>

            {formValues.enableRateLimiting && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <label htmlFor="rateLimitRequestsPerMinute" className="block text-sm font-medium text-gray-700 mb-1">
                  Max Requests Per Minute
                </label>
                <input
                  type="number"
                  id="rateLimitRequestsPerMinute"
                  name="rateLimitRequestsPerMinute"
                  min="10"
                  max="1000"
                  value={formValues.rateLimitRequestsPerMinute}
                  onChange={(e) => setFormValues({ ...formValues, rateLimitRequestsPerMinute: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable IP Whitelist</p>
                <p className="text-sm text-gray-500">Only allow access from specific IP addresses</p>
              </div>
              <ToggleSwitch
                name="enableIpWhitelist"
                checked={formValues.enableIpWhitelist}
                onChange={(checked) => setFormValues({ ...formValues, enableIpWhitelist: checked })}
              />
            </div>

            {formValues.enableIpWhitelist && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <label htmlFor="ipWhitelist" className="block text-sm font-medium text-gray-700 mb-1">
                  Whitelisted IPs (one per line)
                </label>
                <textarea
                  id="ipWhitelist"
                  name="ipWhitelist"
                  rows={4}
                  value={formValues.ipWhitelist.join("\n")}
                  onChange={(e) => setFormValues({ ...formValues, ipWhitelist: e.target.value.split("\n") })}
                  placeholder="192.168.1.1&#10;10.0.0.0/8"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Audit Settings */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold text-gray-900">Audit & Logging</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable Audit Log</p>
                <p className="text-sm text-gray-500">Track all admin and security-related actions</p>
              </div>
              <ToggleSwitch
                name="enableAuditLog"
                checked={formValues.enableAuditLog}
                onChange={(checked) => setFormValues({ ...formValues, enableAuditLog: checked })}
              />
            </div>

            {formValues.enableAuditLog && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <label htmlFor="auditLogRetentionDays" className="block text-sm font-medium text-gray-700 mb-1">
                  Audit Log Retention (days)
                </label>
                <input
                  type="number"
                  id="auditLogRetentionDays"
                  name="auditLogRetentionDays"
                  min="30"
                  max="365"
                  value={formValues.auditLogRetentionDays}
                  onChange={(e) => setFormValues({ ...formValues, auditLogRetentionDays: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <UnifiedButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Security Settings
              </>
            )}
          </UnifiedButton>
        </div>
      </Form>
    </div>
  );
}
