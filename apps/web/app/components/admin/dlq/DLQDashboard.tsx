/**
 * DLQ Dashboard Component
 * 
 * Admin dashboard for managing dead letter queues:
 * - View queue statistics
 * - Inspect failed jobs
 * - Retry/delete jobs
 * - Purge old jobs
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Trash2, Play, AlertTriangle, CheckCircle } from 'lucide-react';

interface DLQStats {
  queueName: string;
  totalJobs: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface DLQMessage {
  id: string;
  name: string;
  data: any;
  opts: any;
  attemptsMade: number;
  failedReason?: string;
  stacktrace?: string[];
  timestamp: number;
  queueName: string;
}

export function DLQDashboard() {
  const [stats, setStats] = useState<DLQStats[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<string>('webhooks');
  const [failedJobs, setFailedJobs] = useState<DLQMessage[]>([]);
  const [selectedJob, setSelectedJob] = useState<DLQMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/dlq/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchFailedJobs = async (queueName: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/dlq/failed/${queueName}?limit=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch failed jobs');
      const data = await response.json();
      setFailedJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch failed jobs');
    } finally {
      setLoading(false);
    }
  };

  const retryJob = async (queueName: string, jobId: string) => {
    try {
      const response = await fetch(`/api/admin/dlq/retry/${queueName}/${jobId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to retry job');
      await fetchFailedJobs(queueName);
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    }
  };

  const deleteJob = async (queueName: string, jobId: string) => {
    try {
      const response = await fetch(`/api/admin/dlq/failed/${queueName}/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to delete job');
      await fetchFailedJobs(queueName);
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    }
  };

  const purgeQueue = async (queueName: string) => {
    if (!confirm(`Are you sure you want to purge all failed jobs from ${queueName}?`)) return;
    try {
      const response = await fetch(`/api/admin/dlq/purge/${queueName}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to purge queue');
      await fetchFailedJobs(queueName);
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge queue');
    }
  };

  useEffect(() => {
    fetchStats();
    fetchFailedJobs(selectedQueue);
  }, [selectedQueue]);

  const totalFailed = stats.reduce((sum, s) => sum + s.failed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dead Letter Queue Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and manage failed jobs across all queues
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Queue Statistics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.queueName}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium capitalize">{stat.queueName}</CardTitle>
              {stat.failed === 0 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.failed}</div>
              <p className="text-xs text-muted-foreground">failed jobs</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span>{stat.totalJobs}</span>
                </div>
                <div className="flex justify-between">
                  <span>Waiting:</span>
                  <span>{stat.waiting}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span>{stat.active}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed:</span>
                  <span>{stat.completed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Failed Jobs View */}
      <Tabs value={selectedQueue} onValueChange={setSelectedQueue} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {stats.map((stat) => (
            <TabsTrigger key={stat.queueName} value={stat.queueName} className="capitalize">
              {stat.queueName}
              {stat.failed > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stat.failed}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {stats.map((stat) => (
          <TabsContent key={stat.queueName} value={stat.queueName} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold capitalize">{stat.queueName} Queue</h3>
                <p className="text-sm text-muted-foreground">
                  {stat.failed} failed jobs out of {stat.totalJobs} total
                </p>
              </div>
              <Button
                onClick={() => purgeQueue(stat.queueName)}
                variant="destructive"
                size="sm"
                disabled={stat.failed === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Purge All
              </Button>
            </div>

            {failedJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No failed jobs in this queue
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {failedJobs.map((job) => (
                  <Card key={job.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{job.name}</CardTitle>
                          <CardDescription className="text-xs">
                            ID: {job.id} • Attempts: {job.attemptsMade} •{' '}
                            {new Date(job.timestamp).toLocaleString()}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => retryJob(stat.queueName, job.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Play className="mr-2 h-3 w-3" />
                            Retry
                          </Button>
                          <Button
                            onClick={() => deleteJob(stat.queueName, job.id)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {job.failedReason && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-red-500">Failed Reason:</p>
                          <p className="text-sm text-muted-foreground">{job.failedReason}</p>
                        </div>
                      )}
                      <details className="cursor-pointer">
                        <summary className="text-sm font-medium">View Job Data</summary>
                        <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                          {JSON.stringify(job.data, null, 2)}
                        </pre>
                      </details>
                      {job.stacktrace && job.stacktrace.length > 0 && (
                        <details className="mt-2 cursor-pointer">
                          <summary className="text-sm font-medium">View Stack Trace</summary>
                          <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                            {job.stacktrace.join('\n')}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
