import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Save, RotateCcw, PowerOff, Power } from "lucide-react";

interface ServiceConfigProps {
    services: Record<string, any>;
}

export function ServiceConfig({ services }: ServiceConfigProps) {
    const [formData, setFormData] = useState({
        email: {
            enabled: services.email?.enabled ?? true,
            provider: services.email?.provider || "sendgrid",
            fromEmail: services.email?.fromEmail || "noreply@rental-portal.com",
            fromName: services.email?.fromName || "Rental Portal",
        },
        sms: {
            enabled: services.sms?.enabled ?? false,
            provider: services.sms?.provider || "twilio",
            fromNumber: services.sms?.fromNumber || "",
        },
        push: {
            enabled: services.push?.enabled ?? true,
            provider: services.push?.provider || "fcm",
            serverKey: services.push?.serverKey || "",
        },
        storage: {
            enabled: services.storage?.enabled ?? true,
            provider: services.storage?.provider || "s3",
            bucket: services.storage?.bucket || "rental-portal-uploads",
            region: services.storage?.region || "us-east-1",
        },
        cache: {
            enabled: services.cache?.enabled ?? true,
            provider: services.cache?.provider || "redis",
            ttl: services.cache?.ttl || 3600,
        },
        search: {
            enabled: services.search?.enabled ?? true,
            provider: services.search?.provider || "elasticsearch",
            host: services.search?.host || "localhost:9200",
            index: services.search?.index || "rental_portal",
        },
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleInputChange = (service: string, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [service]: {
                ...prev[service as keyof typeof prev],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            console.log("Saving service config:", formData);
            // await fetch('/api/admin/services', { method: 'POST', body: JSON.stringify(formData) });
        } catch (error) {
            console.error("Failed to save service config:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setFormData({
            email: {
                enabled: services.email?.enabled ?? true,
                provider: services.email?.provider || "sendgrid",
                fromEmail: services.email?.fromEmail || "noreply@rental-portal.com",
                fromName: services.email?.fromName || "Rental Portal",
            },
            sms: {
                enabled: services.sms?.enabled ?? false,
                provider: services.sms?.provider || "twilio",
                fromNumber: services.sms?.fromNumber || "",
            },
            push: {
                enabled: services.push?.enabled ?? true,
                provider: services.push?.provider || "fcm",
                serverKey: services.push?.serverKey || "",
            },
            storage: {
                enabled: services.storage?.enabled ?? true,
                provider: services.storage?.provider || "s3",
                bucket: services.storage?.bucket || "rental-portal-uploads",
                region: services.storage?.region || "us-east-1",
            },
            cache: {
                enabled: services.cache?.enabled ?? true,
                provider: services.cache?.provider || "redis",
                ttl: services.cache?.ttl || 3600,
            },
            search: {
                enabled: services.search?.enabled ?? true,
                provider: services.search?.provider || "elasticsearch",
                host: services.search?.host || "localhost:9200",
                index: services.search?.index || "rental_portal",
            },
        });
    };

    const ServiceCard = ({ service, data }: { service: string; data: any }) => (
        <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium text-gray-900 capitalize">{service}</h4>
                <button
                    onClick={() => handleInputChange(service, 'enabled', !data.enabled)}
                    className={`p-2 rounded-lg ${data.enabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                >
                    {data.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                </button>
            </div>

            <div className="space-y-3">
                {service === 'email' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                            <select
                                value={data.provider}
                                onChange={(e) => handleInputChange(service, 'provider', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            >
                                <option value="sendgrid">SendGrid</option>
                                <option value="ses">AWS SES</option>
                                <option value="mailgun">Mailgun</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                            <input
                                type="email"
                                value={data.fromEmail}
                                onChange={(e) => handleInputChange(service, 'fromEmail', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                            <input
                                type="text"
                                value={data.fromName}
                                onChange={(e) => handleInputChange(service, 'fromName', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                    </>
                )}

                {service === 'sms' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                            <select
                                value={data.provider}
                                onChange={(e) => handleInputChange(service, 'provider', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            >
                                <option value="twilio">Twilio</option>
                                <option value="sns">AWS SNS</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From Number</label>
                            <input
                                type="tel"
                                value={data.fromNumber}
                                onChange={(e) => handleInputChange(service, 'fromNumber', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                placeholder="+1234567890"
                            />
                        </div>
                    </>
                )}

                {service === 'storage' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                            <select
                                value={data.provider}
                                onChange={(e) => handleInputChange(service, 'provider', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            >
                                <option value="s3">AWS S3</option>
                                <option value="gcs">Google Cloud Storage</option>
                                <option value="azure">Azure Blob Storage</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bucket</label>
                            <input
                                type="text"
                                value={data.bucket}
                                onChange={(e) => handleInputChange(service, 'bucket', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                            <input
                                type="text"
                                value={data.region}
                                onChange={(e) => handleInputChange(service, 'region', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                    </>
                )}

                {service === 'cache' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                            <select
                                value={data.provider}
                                onChange={(e) => handleInputChange(service, 'provider', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            >
                                <option value="redis">Redis</option>
                                <option value="memcached">Memcached</option>
                                <option value="memory">In-Memory</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">TTL (seconds)</label>
                            <input
                                type="number"
                                value={data.ttl}
                                onChange={(e) => handleInputChange(service, 'ttl', parseInt(e.target.value))}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                    </>
                )}

                {service === 'search' && (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                            <select
                                value={data.provider}
                                onChange={(e) => handleInputChange(service, 'provider', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            >
                                <option value="elasticsearch">Elasticsearch</option>
                                <option value="algolia">Algolia</option>
                                <option value="typesense">TypeSense</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                            <input
                                type="text"
                                value={data.host}
                                onChange={(e) => handleInputChange(service, 'host', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Index</label>
                            <input
                                type="text"
                                value={data.index}
                                onChange={(e) => handleInputChange(service, 'index', e.target.value)}
                                disabled={!data.enabled}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-lg border p-6">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(formData).map(([service, data]) => (
                        <ServiceCard key={service} service={service} data={data} />
                    ))}
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
