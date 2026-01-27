import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Save, RotateCcw, Eye, EyeOff, Copy } from "lucide-react";

interface EnvironmentConfigProps {
    environment: Record<string, any>;
}

export function EnvironmentConfig({ environment }: EnvironmentConfigProps) {
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [formData, setFormData] = useState({
        NODE_ENV: environment.NODE_ENV || "development",
        PORT: environment.PORT || 3400,
        API_URL: environment.API_URL || "http://localhost:3400/api",
        WEB_URL: environment.WEB_URL || "http://localhost:3401",
        DATABASE_URL: environment.DATABASE_URL || "",
        REDIS_URL: environment.REDIS_URL || "",
        JWT_SECRET: environment.JWT_SECRET || "",
        JWT_REFRESH_SECRET: environment.JWT_REFRESH_SECRET || "",
        SESSION_SECRET: environment.SESSION_SECRET || "",
        STRIPE_SECRET_KEY: environment.STRIPE_SECRET_KEY || "",
        STRIPE_PUBLISHABLE_KEY: environment.STRIPE_PUBLISHABLE_KEY || "",
        SENDGRID_API_KEY: environment.SENDGRID_API_KEY || "",
        TWILIO_ACCOUNT_SID: environment.TWILIO_ACCOUNT_SID || "",
        TWILIO_AUTH_TOKEN: environment.TWILIO_AUTH_TOKEN || "",
        AWS_ACCESS_KEY_ID: environment.AWS_ACCESS_KEY_ID || "",
        AWS_SECRET_ACCESS_KEY: environment.AWS_SECRET_ACCESS_KEY || "",
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const toggleSecretVisibility = (key: string) => {
        setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            console.log("Saving environment config:", formData);
            // await fetch('/api/admin/environment', { method: 'POST', body: JSON.stringify(formData) });
        } catch (error) {
            console.error("Failed to save environment config:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const isSecret = (key: string) => {
        return key.includes('SECRET') || key.includes('TOKEN') || key.includes('KEY') || key.includes('PASSWORD');
    };

    const EnvironmentGroup = ({ title, keys }: { title: string; keys: string[] }) => (
        <div className="border rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-4">{title}</h3>
            <div className="space-y-3">
                {keys.map((key) => (
                    <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {key.replace(/_/g, ' ')}
                        </label>
                        <div className="flex items-center space-x-2">
                            <input
                                type={isSecret(key) && !showSecrets[key] ? "password" : "text"}
                                value={formData[key as keyof typeof formData] || ""}
                                onChange={(e) => handleInputChange(key, e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                placeholder={isSecret(key) ? "••••••••" : ""}
                            />
                            {isSecret(key) && (
                                <button
                                    onClick={() => toggleSecretVisibility(key)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    {showSecrets[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            )}
                            <button
                                onClick={() => copyToClipboard(formData[key as keyof typeof formData] || "")}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="space-y-6">
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                                Environment Variables Warning
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>
                                    These are sensitive configuration values. Be careful when modifying them as they can affect the entire application.
                                    Changes may require a restart to take effect.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <EnvironmentGroup
                        title="Application Configuration"
                        keys={["NODE_ENV", "PORT", "API_URL", "WEB_URL"]}
                    />

                    <EnvironmentGroup
                        title="Database & Cache"
                        keys={["DATABASE_URL", "REDIS_URL"]}
                    />

                    <EnvironmentGroup
                        title="Authentication & Security"
                        keys={["JWT_SECRET", "JWT_REFRESH_SECRET", "SESSION_SECRET"]}
                    />

                    <EnvironmentGroup
                        title="Payment Processing"
                        keys={["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"]}
                    />

                    <EnvironmentGroup
                        title="Communication Services"
                        keys={["SENDGRID_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]}
                    />

                    <EnvironmentGroup
                        title="Cloud Storage"
                        keys={["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]}
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t">
                    <div className="text-sm text-gray-500">
                        Last updated: {new Date().toLocaleString()}
                    </div>
                    <div className="flex space-x-3">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restart Services
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
