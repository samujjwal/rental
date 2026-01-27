import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "@tailwindcss/postcss";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, path.resolve(__dirname, "../../"), "");

  return {
    plugins: [reactRouter(), tsconfigPaths()],
    css: {
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
    },
    server: {
      port: 3401,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:3400",
          changeOrigin: true,
        },
      },
    },
    define: {
      "process.env.SESSION_SECRET": JSON.stringify(env.SESSION_SECRET),
    },
  };
});
