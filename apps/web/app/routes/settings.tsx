import { redirect } from "react-router";

export function loader() {
  return redirect("/settings/profile");
}

export default function SettingsIndex() {
  return null;
}
