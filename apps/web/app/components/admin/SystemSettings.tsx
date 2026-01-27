import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Save, RotateCcw } from "lucide-react";

interface SystemSettingsProps {
    settings: Record<string, any>;
}

export function SystemSettings({ settings }: SystemSettingsProps) {
    const [formData, setFormData] = useState({
        siteName: settings.siteName || "Rental Portal",
        siteUrl: settings.siteUrl || "https://rental-portal.com",
        supportEmail: settings.supportEmail || "support@rental-portal.com",
        maxFileUploadSize: settings.maxFileUploadSize || 10,
        allowedFileTypes: settings.allowedFileTypes || ["jpg", "jpeg", "png", "pdf"],
        enableRegistration: settings.enableRegistration ?? true,
        enableEmailVerification: settings.enableEmailVerification ?? true,
        enablePhoneVerification: settings.enablePhoneVerification ?? false,
        defaultLanguage: settings.defaultLanguage || "en",
        defaultCurrency: settings.defaultCurrency || "USD",
        timezone: settings.timezone || "UTC",
        maintenanceMode: settings.maintenanceMode ?? false,
        debugMode: settings.debugMode ?? false,
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // API call to save settings
            console.log("Saving settings:", formData);
            // await fetch('/api/admin/settings', { method: 'POST', body: JSON.stringify(formData) });
        } catch (error) {
            console.error("Failed to save settings:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setFormData({
            siteName: settings.siteName || "Rental Portal",
            siteUrl: settings.siteUrl || "https://rental-portal.com",
            supportEmail: settings.supportEmail || "support@rental-portal.com",
            maxFileUploadSize: settings.maxFileUploadSize || 10,
            allowedFileTypes: settings.allowedFileTypes || ["jpg", "jpeg", "png", "pdf"],
            enableRegistration: settings.enableRegistration ?? true,
            enableEmailVerification: settings.enableEmailVerification ?? true,
            enablePhoneVerification: settings.enablePhoneVerification ?? false,
            defaultLanguage: settings.defaultLanguage || "en",
            defaultCurrency: settings.defaultCurrency || "USD",
            timezone: settings.timezone || "UTC",
            maintenanceMode: settings.maintenanceMode ?? false,
            debugMode: settings.debugMode ?? false,
        });
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="space-y-6">
                {/* General Settings */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">General Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Site Name
                            </label>
                            <input
                                type="text"
                                value={formData.siteName}
                                onChange={(e) => handleInputChange('siteName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Site URL
                            </label>
                            <input
                                type="url"
                                value={formData.siteUrl}
                                onChange={(e) => handleInputChange('siteUrl', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Support Email
                            </label>
                            <input
                                type="email"
                                value={formData.supportEmail}
                                onChange={(e) => handleInputChange('supportEmail', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Default Language
                            </label>
                            <select
                                value={formData.defaultLanguage}
                                onChange={(e) => handleInputChange('defaultLanguage', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* File Upload Settings */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">File Upload Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max File Upload Size (MB)
                            </label>
                            <input
                                type="number"
                                value={formData.maxFileUploadSize}
                                onChange={(e) => handleInputChange('maxFileUploadSize', parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Allowed File Types
                            </label>
                            <input
                                type="text"
                                value={formData.allowedFileTypes.join(', ')}
                                onChange={(e) => handleInputChange('allowedFileTypes', e.target.value.split(', ').filter(Boolean))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="jpg, jpeg, png, pdf"
                            />
                        </div>
                    </div>
                </div>

                {/* User Registration Settings */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">User Registration</h3>
                    <div className="space-y-3">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.enableRegistration}
                                onChange={(e) => handleInputChange('enableRegistration', e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Enable user registration</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.enableEmailVerification}
                                onChange={(e) => handleInputChange('enableEmailVerification', e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Require email verification</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.enablePhoneVerification}
                                onChange={(e) => handleInputChange('enablePhoneVerification', e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Require phone verification</span>
                        </label>
                    </div>
                </div>

                {/* System Mode Settings */}
                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">System Mode</h3>
                    <div className="space-y-3">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.maintenanceMode}
                                onChange={(e) => handleInputChange('maintenanceMode', e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Maintenance Mode (disables user access)</span>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.debugMode}
                                onChange={(e) => handleInputChange('debugMode', e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-sm text-gray-700">Debug Mode (enables detailed logging)</span>
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button variant="outline" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
