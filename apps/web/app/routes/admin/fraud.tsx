import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { fraudApi } from "~/lib/api/fraud";
import { Badge, UnifiedButton, RouteErrorBoundary } from "~/components/ui";
import { requireAdmin } from "~/utils/auth";

export const meta: MetaFunction = () => {
  return [
    { title: "Fraud Detection | Admin" },
    { name: "description", content: "Monitor high risk users and transactions" },
  ];
};

interface RiskFlag {
  type: string;
}

interface RiskCheck {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  flags: RiskFlag[];
}

interface RiskUser {
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
  check: RiskCheck;
}

export async function clientLoader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  try {
    const riskUsers = (await fraudApi.getHighRiskUsers(50)) as RiskUser[];
    return { riskUsers, error: null };
  } catch {
    return { riskUsers: [], error: "Failed to load fraud data" };
  }
}

export default function FraudDashboard() {
  const { t } = useTranslation();
  const { riskUsers, error } = useLoaderData<typeof clientLoader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("admin.fraud")}
        </h1>
        <p className="text-muted-foreground">
          {t("admin.monitorHighRisk")}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid gap-6">
        <div className="bg-card border rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              {t("admin.highRiskUsers")}
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">{t("admin.user")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("admin.riskScore")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("admin.level")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("admin.flags")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {riskUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      {t("admin.noHighRiskUsers")}
                    </td>
                  </tr>
                ) : (
                  riskUsers.map((item) => (
                    <tr key={item.user.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {item.user.firstName} {item.user.lastName}
                        </div>
                        <div className="text-muted-foreground text-xs">{item.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${item.check.riskScore > 80 ? 'text-destructive' : 'text-warning'}`}>
                          {item.check.riskScore}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.check.riskLevel === 'CRITICAL' ? 'destructive' : 'warning'}>
                          {item.check.riskLevel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {item.check.flags.slice(0, 3).map((flag, i: number) => (
                            <span key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {flag.type}
                            </span>
                          ))}
                          {item.check.flags.length > 3 && (
                             <span className="text-xs text-muted-foreground">{t("admin.moreFlags", { count: item.check.flags.length - 3 })}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <UnifiedButton variant="outline" size="sm" asChild>
                           <Link to="/admin/entities/users">{t("admin.review")}</Link>
                        </UnifiedButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export { RouteErrorBoundary as ErrorBoundary };

