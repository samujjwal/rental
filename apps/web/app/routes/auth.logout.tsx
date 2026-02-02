import type { ActionFunctionArgs } from "react-router";
import { logout } from "~/utils/auth";

export async function clientAction({ request }: ActionFunctionArgs) {
  return logout(request);
}

export async function clientLoader({ request }: ActionFunctionArgs) {
  return logout(request);
}
