/**
 * AI Override Dashboard Component
 * 
 * Admin dashboard for reviewing and overriding AI suggestions:
 * - View pending AI suggestions
 * - Review and approve/override/reject suggestions
 * - View audit trail of overrides
 * - View statistics
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Textarea } from '~/components/ui/textarea';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Brain, History, BarChart3 } from 'lucide-react';

interface AISuggestion {
  id: string;
  type: 'FRAUD_DETECTION' | 'DISPUTE_RESOLUTION' | 'PRICING_RECOMMENDATION' | 'RISK_ASSESSMENT';
  entityId: string;
  entityType: 'BOOKING' | 'USER' | 'LISTING' | 'DISPUTE';
  suggestion: string;
  confidence: number;
  reasoning: string;
  data: any;
  status: 'PENDING' | 'APPROVED' | 'OVERRIDDEN' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  overrideReason?: string;
}

export function AIOverrideDashboard() {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/ai-override/suggestions/pending', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      const data = await response.json();
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/ai-override/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/admin/ai-override/overrides/history?limit=50', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const reviewSuggestion = async (action: 'APPROVE' | 'OVERRIDE' | 'REJECT') => {
    if (!selectedSuggestion) return;
    if (action === 'OVERRIDE' && !overrideReason.trim()) {
      setError('Override reason is required');
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/admin/ai-override/suggestions/${selectedSuggestion.id}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          overrideReason: action === 'OVERRIDE' ? overrideReason : undefined,
        }),
      });
      if (!response.ok) throw new Error('Failed to review suggestion');
      await fetchSuggestions();
      await fetchStats();
      await fetchHistory();
      setSelectedSuggestion(null);
      setOverrideReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review suggestion');
    }
  };

  useEffect(() => {
    fetchSuggestions();
    fetchStats();
    fetchHistory();
  }, []);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-500';
      case 'OVERRIDDEN':
        return 'bg-orange-500';
      case 'REJECTED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Override Dashboard</h2>
          <p className="text-muted-foreground">Review and manage AI-powered suggestions</p>
        </div>
        <Button onClick={fetchSuggestions} variant="outline" size="sm">
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

      {/* Statistics Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overridden</CardTitle>
              <XCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overridden}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">
            <Brain className="mr-2 h-4 w-4" />
            Pending Suggestions
            {suggestions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {suggestions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Override History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
            </Card>
          ) : suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No pending suggestions</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {suggestions.map((suggestion) => (
                <Card
                  key={suggestion.id}
                  className={`cursor-pointer transition-colors ${
                    selectedSuggestion?.id === suggestion.id ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base capitalize">{suggestion.type.replace('_', ' ')}</CardTitle>
                        <CardDescription className="text-xs">
                          {suggestion.entityType}:{suggestion.entityId}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={getConfidenceColor(suggestion.confidence)}>
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{suggestion.suggestion}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(suggestion.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {history.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No override history</CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base capitalize">{item.type.replace('_', ' ')}</CardTitle>
                        <CardDescription className="text-xs">
                          {item.entityType}:{item.entityId}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{item.suggestion}</p>
                    {item.overrideReason && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        <span className="font-medium">Override Reason:</span> {item.overrideReason}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                      <span>Reviewed by: {item.reviewedBy}</span>
                      <span>{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      {selectedSuggestion && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-xl capitalize">{selectedSuggestion.type.replace('_', ' ')}</CardTitle>
            <CardDescription>
              {selectedSuggestion.entityType}:{selectedSuggestion.entityId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Suggestion</p>
              <p className="text-sm">{selectedSuggestion.suggestion}</p>
            </div>
            <div>
              <p className="text-sm font-medium">AI Reasoning</p>
              <p className="text-sm text-muted-foreground">{selectedSuggestion.reasoning}</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Confidence:</p>
              <Badge className={getConfidenceColor(selectedSuggestion.confidence)}>
                {Math.round(selectedSuggestion.confidence * 100)}%
              </Badge>
            </div>
            <details className="cursor-pointer">
              <summary className="text-sm font-medium">View Data</summary>
              <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                {JSON.stringify(selectedSuggestion.data, null, 2)}
              </pre>
            </details>

            <div className="space-y-2">
              <label className="text-sm font-medium">Override Reason (required for override)</label>
              <Textarea
                placeholder="Provide reasoning for overriding this suggestion..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => reviewSuggestion('APPROVE')} className="flex-1">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button onClick={() => reviewSuggestion('OVERRIDE')} variant="outline" className="flex-1">
                <XCircle className="mr-2 h-4 w-4" />
                Override
              </Button>
              <Button onClick={() => reviewSuggestion('REJECT')} variant="destructive" className="flex-1">
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => setSelectedSuggestion(null)} variant="ghost">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
