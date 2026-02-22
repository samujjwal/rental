import type { MetaFunction } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, redirect } from "react-router";
import { useState } from "react";
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  BarChart2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  RouteErrorBoundary,
} from "~/components/ui";
import { cn } from "~/lib/utils";
import { analyticsApi, type InsightData } from "~/lib/api/analytics";
import { getUser } from "~/utils/auth";

export const meta: MetaFunction = () => {
  return [
    { title: "Business Insights | Owner Dashboard" },
    { name: "description", content: "Actionable insights to grow your rental business" },
  ];
};

const safeNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function clientLoader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (!user) {
    return redirect("/auth/login");
  }
  if (user.role !== "owner" && user.role !== "admin") {
    return redirect("/dashboard");
  }

  try {
    const rawData = await analyticsApi.getInsights();
    const data: InsightData = {
      score: safeNumber(rawData?.score),
      insights: Array.isArray(rawData?.insights) ? rawData.insights : [],
      seasonalTrends: Array.isArray(rawData?.seasonalTrends)
        ? rawData.seasonalTrends
        : [],
      competitorAnalysis: {
        averagePrice: safeNumber(rawData?.competitorAnalysis?.averagePrice),
        yourPrice: safeNumber(rawData?.competitorAnalysis?.yourPrice),
        pricePosition: rawData?.competitorAnalysis?.pricePosition || "at",
        recommendation: rawData?.competitorAnalysis?.recommendation || "",
      },
      customerSegments: Array.isArray(rawData?.customerSegments)
        ? rawData.customerSegments
        : [],
      optimizations: Array.isArray(rawData?.optimizations)
        ? rawData.optimizations
        : [],
    };
    return { data, error: null };
  } catch (error: unknown) {
    console.error("Failed to load insights:", error);
    return {
      data: null,
      error:
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message)
          : "Failed to load insights",
    };
  }
}

const tabs = [
  { id: "insights", label: "Key Insights", icon: Lightbulb },
  { id: "trends", label: "Market Trends", icon: TrendingUp },
  { id: "optimization", label: "Optimization", icon: Target },
] as const;

function InsightCard({ insight }: { insight: InsightData["insights"][0] }) {
  const configMap = {
    opportunity: { icon: Lightbulb, bg: "bg-info/10", border: "border-info/30", text: "text-info" },
    warning: { icon: AlertTriangle, bg: "bg-warning/10", border: "border-warning/30", text: "text-warning" },
    success: { icon: CheckCircle, bg: "bg-success/10", border: "border-success/30", text: "text-success" },
  } as const;
  const config = configMap[insight.type as keyof typeof configMap] || configMap.opportunity;

  const Icon = config.icon;

  return (
    <Card className={cn("border", config.border, config.bg)}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className={cn("p-2 rounded-lg h-fit", config.bg)}>
            <Icon className={cn("w-5 h-5", config.text)} />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-foreground mb-1">{insight.title}</h4>
            <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-medium", config.text)}>{insight.impact}</span>
              <Link
                to={insight.actionUrl}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
              >
                {insight.action}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OwnerInsightsPage() {
  const { data, error } = useLoaderData<typeof clientLoader>();
  const [selectedTab, setSelectedTab] = useState<"insights" | "trends" | "optimization">("insights");

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            {error || "Failed to load insights"}
          </div>
        </div>
      </div>
    );
  }

  const scoreColor = data.score >= 80 ? "text-success" : data.score >= 60 ? "text-warning" : "text-destructive";
  const scoreStrokeColor = data.score >= 80 ? "text-success" : data.score >= 60 ? "text-warning" : "text-destructive";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/owner" className="text-muted-foreground hover:text-foreground">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Business Insights</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Business Health Score */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Business Health Score</h2>
                <p className="text-muted-foreground">Based on your performance, listings, and customer feedback</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-muted"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${data.score}, 100`}
                      className={scoreStrokeColor}
                    />
                  </svg>
                  <span className={cn("absolute inset-0 flex items-center justify-center text-2xl font-bold", scoreColor)}>
                    {data.score}
                  </span>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-medium", scoreColor)}>
                    {data.score >= 80 ? "Excellent" : data.score >= 60 ? "Good" : "Needs Work"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {selectedTab === "insights" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}

        {selectedTab === "trends" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seasonal Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Seasonal Demand
                </CardTitle>
                <CardDescription>Plan your inventory and pricing based on seasonal trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.seasonalTrends.map((trend) => (
                    <div key={trend.period} className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
                      <div className={cn(
                        "w-3 h-3 rounded-full mt-1.5",
                        trend.demand === "high" ? "bg-success" : trend.demand === "medium" ? "bg-warning" : "bg-destructive"
                      )} />
                      <div>
                        <p className="font-medium text-foreground">{trend.period}</p>
                        <p className="text-sm text-muted-foreground">{trend.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Competitor Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5" />
                  Pricing Analysis
                </CardTitle>
                <CardDescription>How your pricing compares to competitors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Market Average</p>
                      <p className="text-2xl font-bold text-foreground">${data.competitorAnalysis.averagePrice}/day</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Your Average</p>
                      <p className="text-2xl font-bold text-primary">${data.competitorAnalysis.yourPrice}/day</p>
                    </div>
                  </div>
                  <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
                    <p className="text-sm text-info">{data.competitorAnalysis.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Segments */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Customer Segments
                </CardTitle>
                <CardDescription>Understand who's renting from you</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {data.customerSegments.map((segment) => (
                    <div key={segment.segment} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold text-foreground">{segment.percentage}%</span>
                        {segment.trend === "up" ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : segment.trend === "down" ? (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        ) : (
                          <span className="w-4 h-1 bg-muted-foreground rounded" />
                        )}
                      </div>
                      <p className="font-medium text-foreground text-sm">{segment.segment}</p>
                      <p className="text-xs text-muted-foreground mt-1">{segment.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTab === "optimization" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {data.optimizations.map((opt) => (
              <Card key={opt.area}>
                <CardHeader>
                  <CardTitle className="text-lg">{opt.area}</CardTitle>
                  <CardDescription>Current: {opt.current} / Target: {opt.target}</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const current = safeNumber(opt.current);
                    const target = safeNumber(opt.target);
                    const progressPct =
                      target > 0 ? Math.min((current / target) * 100, 100) : 0;
                    return (
                      <>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Progress</span>
                      <span className="text-sm font-medium">{Math.round(progressPct)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                      </>
                    );
                  })()}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Suggestions:</p>
                    <ul className="space-y-1">
                      {opt.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

