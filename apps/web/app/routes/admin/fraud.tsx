import type { MetaFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { AlertTriangle, ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import { fraudApi } from "~/lib/api/fraud";
import { Badge, UnifiedButton } from "~/components/ui";

export const meta: MetaFunction = () => {
  return [
    { title: "Fraud Detection | Admin" },
    { name: "description", content: "Monitor high risk users and transactions" },
  ];
};

export async function clientLoader() {
  try {
    const riskUsers = await fraudApi.getHighRiskUsers(50);
    return { riskUsers, error: null };
  } catch (error) {
    return { riskUsers: [], error: "Failed to load fraud data" };
  }
}

export default function FraudDashboard() {
  const { riskUsers, error } = useLoaderData<typeof clientLoader>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Fraud Detection
        </h1>
        <p className="text-muted-foreground">
          Monitor and action high-risk accounts and activities.
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
              High Risk Users
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Risk Score</th>
                  <th className="px-4 py-3 text-left font-medium">Level</th>
                  <th className="px-4 py-3 text-left font-medium">Flags</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {riskUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No high risk users detected.
                    </td>
                  </tr>
                ) : (
                  riskUsers.map((item: any) => (
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
                          {item.check.flags.slice(0, 3).map((flag: any, i: number) => (
                            <span key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {flag.type}
                            </span>
                          ))}
                          {item.check.flags.length > 3 && (
                             <span className="text-xs text-muted-foreground">+{item.check.flags.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <UnifiedButton variant="outline" size="small" asChild>
                           <Link to={`/admin/users/${item.user.id}`}>Review</Link>
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
