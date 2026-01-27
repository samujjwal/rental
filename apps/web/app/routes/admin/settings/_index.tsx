import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireAdmin, getUserToken } from "~/utils/auth.server";
import { SettingsTabs } from "~/components/admin/SettingsTabs";
import { SystemSettings } from "~/components/admin/SystemSettings";
import { APIKeys } from "~/components/admin/APIKeys";
import { ServiceConfig } from "~/components/admin/ServiceConfig";
import { EnvironmentConfig } from "~/components/admin/EnvironmentConfig";

export async function loader({ request }: LoaderFunctionArgs) {
    const user = await requireAdmin(request);
    const token = await getUserToken(request);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };

    const API_BASE_URL = process.env.API_URL || "http://localhost:3400/api/v1";

    // Fetch all configuration data
    const [settings, apiKeys, services, environment] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/settings`, { headers }).then(res =>
            res.ok ? res.json() : { data: {} }
        ),
        fetch(`${API_BASE_URL}/admin/api-keys`, { headers }).then(res =>
            res.ok ? res.json() : { data: [] }
        ),
        fetch(`${API_BASE_URL}/admin/services`, { headers }).then(res =>
            res.ok ? res.json() : { data: {} }
        ),
        fetch(`${API_BASE_URL}/admin/environment`, { headers }).then(res =>
            res.ok ? res.json() : { data: {} }
        ),
    ]);

    return {
        settings: settings.data || {},
        apiKeys: apiKeys.data || [],
        services: services.data || {},
        environment: environment.data || {},
    };
}

export default function AdminSettings() {
    const { settings, apiKeys, services, environment } = useLoaderData<typeof loader>();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
                <p className="text-gray-600">Manage application configuration, API keys, and service settings</p>
            </div>

            {/* Settings Tabs */}
            <SettingsTabs />

            {/* Tab Content */}
            <div className="space-y-6">
                {/* System Settings */}
                <section id="system" className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-900">System Configuration</h2>
                    <SystemSettings settings={settings} />
                </section>

                {/* API Keys */}
                <section id="api-keys" className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-900">API Keys & Secrets</h2>
                    <APIKeys apiKeys={apiKeys} />
                </section>

                {/* Service Configuration */}
                <section id="services" className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-900">Service Configuration</h2>
                    <ServiceConfig services={services} />
                </section>

                {/* Environment Variables */}
                <section id="environment" className="space-y-6">
                    <h2 className="text-xl font-semibold text-gray-900">Environment Configuration</h2>
                    <EnvironmentConfig environment={environment} />
                </section>
            </div>
        </div>
    );
}
