import type { MetaFunction } from "react-router";
import { useLoaderData, Link, Form, useNavigation, useActionData } from "react-router";
import { useState, useEffect } from "react";
import {
  Mail,
  Server,
  Lock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Save,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { adminApi } from "~/lib/api/admin";
import { UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Email Settings | Admin" },
    { name: "description", content: "Configure email service and SMTP settings" },
  ];
};

interface EmailSettings {
  provider: "smtp" | "sendgrid" | "ses" | "mailgun";
  // SMTP settings
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  // API-based provider settings
  apiKey: string;
  apiRegion: string;
  // Common settings
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  // Templates
  templateEngine: "handlebars" | "ejs" | "mjml";
  // Test settings
  testEmailRecipient: string;
}

const defaultSettings: EmailSettings = {
  provider: "smtp",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: true,
  smtpUser: "",
  smtpPassword: "",
  apiKey: "",
  apiRegion: "us-east-1",
  fromEmail: "noreply@example.com",
  fromName: "RentalPortal",
  replyToEmail: "support@example.com",
  templateEngine: "handlebars",
  testEmailRecipient: "",
};

export async function clientLoader() {
  try {
    const settingsRes = await adminApi.getSettings();
    return {
      settings: (settingsRes.email as unknown as EmailSettings) || defaultSettings,
      error: null,
    };
  } catch (error: any) {
    return {
      settings: defaultSettings,
      error: error?.message || "Failed to load email settings",
    };
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "test") {
    const testEmail = formData.get("testEmailRecipient") as string;
    try {
      await adminApi.sendTestEmail(testEmail);
      return { success: true, message: `Test email sent to ${testEmail}` };
    } catch (error: any) {
      return {
        success: false,
        error: error?.response?.data?.message || "Failed to send test email",
      };
    }
  }

  // Save settings
  const settings: Partial<EmailSettings> = {
    provider: formData.get("provider") as EmailSettings["provider"],
    smtpHost: formData.get("smtpHost") as string,
    smtpPort: parseInt(formData.get("smtpPort") as string, 10),
    smtpSecure: formData.get("smtpSecure") === "true",
    smtpUser: formData.get("smtpUser") as string,
    smtpPassword: formData.get("smtpPassword") as string,
    apiKey: formData.get("apiKey") as string,
    apiRegion: formData.get("apiRegion") as string,
    fromEmail: formData.get("fromEmail") as string,
    fromName: formData.get("fromName") as string,
    replyToEmail: formData.get("replyToEmail") as string,
    templateEngine: formData.get("templateEngine") as EmailSettings["templateEngine"],
  };

  try {
    await adminApi.updateSettings({ email: settings });
    return { success: true, message: "Email settings updated successfully" };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.message || "Failed to update settings",
    };
  }
}

export default function EmailSettingsPage() {
  const { settings, error } = useLoaderData<typeof clientLoader>();
  const actionData = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const formIntent = navigation.formData?.get("intent");

  const [formValues, setFormValues] = useState<EmailSettings>(settings);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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
        <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure email service provider and SMTP settings
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
        <input type="hidden" name="intent" value="save" />

        {/* Email Provider */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">Email Provider</h2>
          </div>

          <div className="mb-4">
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-1">
              Provider
            </label>
            <select
              id="provider"
              name="provider"
              value={formValues.provider}
              onChange={(e) => setFormValues({ ...formValues, provider: e.target.value as EmailSettings["provider"] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="smtp">SMTP Server</option>
              <option value="sendgrid">SendGrid</option>
              <option value="ses">Amazon SES</option>
              <option value="mailgun">Mailgun</option>
            </select>
          </div>

          {/* SMTP Settings */}
          {formValues.provider === "smtp" && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">SMTP Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    id="smtpHost"
                    name="smtpHost"
                    value={formValues.smtpHost}
                    onChange={(e) => setFormValues({ ...formValues, smtpHost: e.target.value })}
                    placeholder="smtp.example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    id="smtpPort"
                    name="smtpPort"
                    value={formValues.smtpPort}
                    onChange={(e) => setFormValues({ ...formValues, smtpPort: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    id="smtpUser"
                    name="smtpUser"
                    value={formValues.smtpUser}
                    onChange={(e) => setFormValues({ ...formValues, smtpUser: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="smtpPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="smtpPassword"
                      name="smtpPassword"
                      value={formValues.smtpPassword}
                      onChange={(e) => setFormValues({ ...formValues, smtpPassword: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Use TLS/SSL</p>
                  <p className="text-sm text-gray-500">Enable secure connection</p>
                </div>
                <ToggleSwitch
                  name="smtpSecure"
                  checked={formValues.smtpSecure}
                  onChange={(checked) => setFormValues({ ...formValues, smtpSecure: checked })}
                />
              </div>
            </div>
          )}

          {/* API-based Provider Settings */}
          {formValues.provider !== "smtp" && (
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {formValues.provider === "sendgrid" && "SendGrid Configuration"}
                {formValues.provider === "ses" && "Amazon SES Configuration"}
                {formValues.provider === "mailgun" && "Mailgun Configuration"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      id="apiKey"
                      name="apiKey"
                      value={formValues.apiKey}
                      onChange={(e) => setFormValues({ ...formValues, apiKey: e.target.value })}
                      placeholder="Enter API key"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {formValues.provider === "ses" && (
                  <div>
                    <label htmlFor="apiRegion" className="block text-sm font-medium text-gray-700 mb-1">
                      AWS Region
                    </label>
                    <select
                      id="apiRegion"
                      name="apiRegion"
                      value={formValues.apiRegion}
                      onChange={(e) => setFormValues({ ...formValues, apiRegion: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="eu-west-1">EU (Ireland)</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sender Settings */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-900">Sender Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700 mb-1">
                From Email
              </label>
              <input
                type="email"
                id="fromEmail"
                name="fromEmail"
                value={formValues.fromEmail}
                onChange={(e) => setFormValues({ ...formValues, fromEmail: e.target.value })}
                placeholder="noreply@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="fromName" className="block text-sm font-medium text-gray-700 mb-1">
                From Name
              </label>
              <input
                type="text"
                id="fromName"
                name="fromName"
                value={formValues.fromName}
                onChange={(e) => setFormValues({ ...formValues, fromName: e.target.value })}
                placeholder="RentalPortal"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="replyToEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Reply-To Email
              </label>
              <input
                type="email"
                id="replyToEmail"
                name="replyToEmail"
                value={formValues.replyToEmail}
                onChange={(e) => setFormValues({ ...formValues, replyToEmail: e.target.value })}
                placeholder="support@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="templateEngine" className="block text-sm font-medium text-gray-700 mb-1">
                Template Engine
              </label>
              <select
                id="templateEngine"
                name="templateEngine"
                value={formValues.templateEngine}
                onChange={(e) => setFormValues({ ...formValues, templateEngine: e.target.value as EmailSettings["templateEngine"] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="handlebars">Handlebars</option>
                <option value="ejs">EJS</option>
                <option value="mjml">MJML</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end mb-6">
          <UnifiedButton type="submit" disabled={isSubmitting && formIntent === "save"}>
            {isSubmitting && formIntent === "save" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Email Settings
              </>
            )}
          </UnifiedButton>
        </div>
      </Form>

      {/* Test Email */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Send className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-semibold text-gray-900">Test Email</h2>
        </div>

        <Form method="post" className="flex items-end gap-4">
          <input type="hidden" name="intent" value="test" />
          <div className="flex-1">
            <label htmlFor="testEmailRecipient" className="block text-sm font-medium text-gray-700 mb-1">
              Send test email to
            </label>
            <input
              type="email"
              id="testEmailRecipient"
              name="testEmailRecipient"
              placeholder="test@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <UnifiedButton type="submit" variant="outline" disabled={isSubmitting && formIntent === "test"}>
            {isSubmitting && formIntent === "test" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Test
              </>
            )}
          </UnifiedButton>
        </Form>
      </div>
    </div>
  );
}
