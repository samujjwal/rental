import { useState } from "react";
import { Settings, Key, Zap, Globe } from "lucide-react";

const tabs = [
    { id: 'system', label: 'System Settings', icon: Settings },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'services', label: 'Services', icon: Zap },
    { id: 'environment', label: 'Environment', icon: Globe },
];

export function SettingsTabs() {
    const [activeTab, setActiveTab] = useState('system');

    return (
        <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                const element = document.getElementById(tab.id);
                                element?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${isActive
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <Icon className="w-4 h-4 mr-2" />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
