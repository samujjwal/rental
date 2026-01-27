import { Activity, Clock, Server, Zap, AlertTriangle, CheckCircle, TrendingUp, Cpu, HardDrive } from "lucide-react";

interface PerformanceAnalyticsProps {
    data: {
        averageResponseTime?: number;
        uptimePercentage?: number;
        errorRate?: number;
        totalRequests?: number;
        throughput?: number;
        serverMetrics?: {
            cpuUsage?: number;
            memoryUsage?: number;
            diskUsage?: number;
            networkLatency?: number;
        };
        apiEndpoints?: Array<{
            endpoint: string;
            avgResponseTime: number;
            requestCount: number;
            errorRate: number;
        }>;
        performanceTrend?: Array<{
            timestamp: string;
            responseTime: number;
            throughput: number;
            errorRate: number;
        }>;
    };
    period: string;
}

export function PerformanceAnalytics({ data, period }: PerformanceAnalyticsProps) {
    const getHealthStatus = (value: number, thresholds: { good: number; warning: number }) => {
        if (value <= thresholds.good) return { status: 'good', color: 'text-green-600', bg: 'bg-green-100' };
        if (value <= thresholds.warning) return { status: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100' };
        return { status: 'critical', color: 'text-red-600', bg: 'bg-red-100' };
    };

    const responseTimeStatus = getHealthStatus(data.averageResponseTime || 0, { good: 200, warning: 500 });
    const errorRateStatus = getHealthStatus((data.errorRate || 0) * 100, { good: 1, warning: 5 });
    const cpuStatus = getHealthStatus(data.serverMetrics?.cpuUsage || 0, { good: 50, warning: 80 });
    const memoryStatus = getHealthStatus(data.serverMetrics?.memoryUsage || 0, { good: 70, warning: 90 });

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium text-gray-900">Performance Analytics</h2>
                <p className="text-sm text-gray-600">System performance, response times, and health metrics</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Core Performance Metrics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Core Metrics</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Clock className="w-5 h-5 text-blue-500 mr-2" />
                                <span className="text-sm text-gray-600">Avg Response Time</span>
                            </div>
                            <div className="text-right">
                                <span className={`text-lg font-bold ${responseTimeStatus.color}`}>
                                    {data.averageResponseTime || 0}ms
                                </span>
                                <div className={`text-xs ${responseTimeStatus.color}`}>
                                    {responseTimeStatus.status}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                                <span className="text-sm text-gray-600">Uptime</span>
                            </div>
                            <span className="text-lg font-bold text-green-600">
                                {(data.uptimePercentage || 0).toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                                <span className="text-sm text-gray-600">Error Rate</span>
                            </div>
                            <div className="text-right">
                                <span className={`text-lg font-bold ${errorRateStatus.color}`}>
                                    {((data.errorRate || 0) * 100).toFixed(2)}%
                                </span>
                                <div className={`text-xs ${errorRateStatus.color}`}>
                                    {errorRateStatus.status}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Activity className="w-5 h-5 text-purple-500 mr-2" />
                                <span className="text-sm text-gray-600">Total Requests</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                                {(data.totalRequests || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Zap className="w-5 h-5 text-yellow-500 mr-2" />
                                <span className="text-sm text-gray-600">Throughput</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                                {Math.round(data.throughput || 0)} req/s
                            </span>
                        </div>
                    </div>
                </div>

                {/* Server Metrics */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Server Resources</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center">
                                    <Cpu className="w-4 h-4 text-gray-500 mr-2" />
                                    <span className="text-sm text-gray-600">CPU Usage</span>
                                </div>
                                <span className={`text-sm font-medium ${cpuStatus.color}`}>
                                    {data.serverMetrics?.cpuUsage || 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full ${cpuStatus.status === 'good' ? 'bg-green-500' :
                                            cpuStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${data.serverMetrics?.cpuUsage || 0}%` }}
                                ></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center">
                                    <Server className="w-4 h-4 text-gray-500 mr-2" />
                                    <span className="text-sm text-gray-600">Memory Usage</span>
                                </div>
                                <span className={`text-sm font-medium ${memoryStatus.color}`}>
                                    {data.serverMetrics?.memoryUsage || 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full ${memoryStatus.status === 'good' ? 'bg-green-500' :
                                            memoryStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${data.serverMetrics?.memoryUsage || 0}%` }}
                                ></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center">
                                    <HardDrive className="w-4 h-4 text-gray-500 mr-2" />
                                    <span className="text-sm text-gray-600">Disk Usage</span>
                                </div>
                                <span className="text-sm font-medium text-gray-600">
                                    {data.serverMetrics?.diskUsage || 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full"
                                    style={{ width: `${data.serverMetrics?.diskUsage || 0}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Clock className="w-4 h-4 text-gray-500 mr-2" />
                                <span className="text-sm text-gray-600">Network Latency</span>
                            </div>
                            <span className="text-sm font-medium text-gray-600">
                                {data.serverMetrics?.networkLatency || 0}ms
                            </span>
                        </div>
                    </div>
                </div>

                {/* API Endpoints Performance */}
                <div className="bg-white rounded-lg border p-6 lg:col-span-2">
                    <h3 className="text-base font-medium text-gray-900 mb-4">API Endpoints Performance</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 text-gray-600">Endpoint</th>
                                    <th className="text-right py-2 text-gray-600">Avg Response</th>
                                    <th className="text-right py-2 text-gray-600">Requests</th>
                                    <th className="text-right py-2 text-gray-600">Error Rate</th>
                                    <th className="text-center py-2 text-gray-600">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.apiEndpoints || []).map((endpoint, index) => {
                                    const status = getHealthStatus(endpoint.avgResponseTime, { good: 200, warning: 500 });
                                    return (
                                        <tr key={index} className="border-b">
                                            <td className="py-2 font-mono text-xs">{endpoint.endpoint}</td>
                                            <td className="text-right py-2">{endpoint.avgResponseTime}ms</td>
                                            <td className="text-right py-2">{endpoint.requestCount.toLocaleString()}</td>
                                            <td className="text-right py-2">{(endpoint.errorRate * 100).toFixed(2)}%</td>
                                            <td className="text-center py-2">
                                                <span className={`px-2 py-1 rounded text-xs ${status.bg} ${status.color}`}>
                                                    {status.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Performance Trend Chart */}
                <div className="bg-white rounded-lg border p-6 lg:col-span-2">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Performance Trend</h3>
                    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                            <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Performance trend visualization</p>
                            <p className="text-xs text-gray-400 mt-1">Response time, throughput, and error rate over {period}</p>
                        </div>
                    </div>
                </div>

                {/* Performance Alerts */}
                <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">Performance Alerts</h3>
                    <div className="space-y-3">
                        {(errorRateStatus.status === 'critical' || responseTimeStatus.status === 'critical' || cpuStatus.status === 'critical') ? (
                            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                                <div>
                                    <p className="text-sm font-medium text-red-800">Critical Performance Issues</p>
                                    <p className="text-xs text-red-600 mt-1">
                                        One or more metrics require immediate attention
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                                <div>
                                    <p className="text-sm font-medium text-green-800">All Systems Operational</p>
                                    <p className="text-xs text-green-600 mt-1">
                                        Performance metrics are within acceptable ranges
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="text-xs text-gray-500 space-y-1">
                            <p>• Response time target: &lt;200ms (good), &lt;500ms (warning)</p>
                            <p>• Error rate target: &lt;1% (good), &lt;5% (warning)</p>
                            <p>• CPU usage target: &lt;50% (good), &lt;80% (warning)</p>
                            <p>• Memory usage target: &lt;70% (good), &lt;90% (warning)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
