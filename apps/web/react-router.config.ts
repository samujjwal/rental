import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  basename: "/",
  appDirectory: "app",
  routeFile: "app/routes.ts",
  async prerender() {
    return ["/"];
  },
} satisfies Config;
