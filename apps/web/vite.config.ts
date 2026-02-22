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
    build: {
      // Target modern browsers for smaller output
      target: 'es2022',
      // Improve chunk splitting for vendor libraries
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Separate large vendor deps into their own chunks for long-term caching
            if (id.includes('node_modules')) {
              if (id.includes('date-fns')) return 'vendor-date-fns';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('react-router')) return 'vendor-router';
              if (id.includes('zod')) return 'vendor-zod';
              if (id.includes('zustand') || id.includes('immer')) return 'vendor-state';
            }
          },
        },
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
    test: {
      // Exclude e2e tests from vitest - those are run by Playwright
      exclude: ["**/node_modules/**", "**/e2e/**"],
      include: ["app/**/*.{test,spec}.{ts,tsx}"],
      // Allow test suite to pass when no tests exist
      passWithNoTests: true,
    },
  };
});
