import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Plus, Eye, EyeOff, Copy, Trash2, Edit, RefreshCw } from "lucide-react";

interface APIKey {
    id: string;
    name: string;
    key: string;
    service: string;
    permissions: string[];
    createdAt: string;
    lastUsed?: string;
    isActive: boolean;
}

interface APIKeysProps {
    apiKeys: APIKey[];
}

export function APIKeys({ apiKeys }: APIKeysProps) {
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [isCreating, setIsCreating] = useState(false);

    const toggleKeyVisibility = (keyId: string) => {
        setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const generateNewKey = async (service: string) => {
        // API call to generate new key
        console.log(`Generating new key for ${service}`);
    };

    const deleteKey = async (keyId: string) => {
        // API call to delete key
        console.log(`Deleting key ${keyId}`);
    };

    return (
        <div className="space-y-6">
            {/* Add New Key */}
            <div className="bg-white rounded-lg border p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
                    <Button onClick={() => setIsCreating(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Generate New Key
                    </Button>
                </div>

                {/* Existing Keys */}
                <div className="space-y-4">
                    {apiKeys.map((apiKey) => (
                        <div key={apiKey.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${apiKey.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {apiKey.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                            {apiKey.service}
                                        </span>
                                    </div>

                                    <div className="flex items-center space-x-2 mb-3">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                                            {showKeys[apiKey.id] ? apiKey.key : '•'.repeat(32)}
                                        </code>
                                        <button
                                            onClick={() => toggleKeyVisibility(apiKey.id)}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            {showKeys[apiKey.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard(apiKey.key)}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <div>
                                            Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                                            {apiKey.lastUsed && (
                                                <span className="ml-4">
                                                    Last used: {new Date(apiKey.lastUsed).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button className="text-blue-600 hover:text-blue-800">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => generateNewKey(apiKey.service)}
                                                className="text-green-600 hover:text-green-800"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteKey(apiKey.id)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {apiKeys.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <p>No API keys configured</p>
                            <p className="text-sm">Generate your first API key to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Service-Specific Keys */}
            <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Service Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Stripe */}
                    <div className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Stripe</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Publishable Key</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="password"
                                        defaultValue="pk_test_..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                    />
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="password"
                                        defaultValue="sk_test_..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                    />
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SendGrid */}
                    <div className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">SendGrid (Email)</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="password"
                                        defaultValue="SG.xxxxx..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                    />
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                                <input
                                    type="email"
                                    defaultValue="noreply@rental-portal.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>

                    {/* Twilio */}
                    <div className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Twilio (SMS)</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="password"
                                        defaultValue="ACxxxx..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                    />
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="password"
                                        defaultValue="..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                    />
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AWS S3 */}
                    <div className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">AWS S3 (Storage)</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Access Key ID</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="password"
                                        defaultValue="AKIAxxxx..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                    />
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Secret Access Key</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="password"
                                        defaultValue="..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                        readOnly
                                    />
                                    <button className="text-blue-600 hover:text-blue-800">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
