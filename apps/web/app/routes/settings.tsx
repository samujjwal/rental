
import { redirect } from "react-router";
import { RouteErrorBoundary } from "~/components/ui";

export function clientLoader() {
  return redirect("/settings/profile");
}

export default function SettingsIndex() {
  return null;
}
export { RouteErrorBoundary as ErrorBoundary };
