import { Outlet } from "react-router";
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Link as MuiLink,
} from "@mui/material";
import AdminNavigation from "~/components/admin/AdminNavigation";
import AdminErrorBoundary from "~/components/admin/AdminErrorBoundary";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "@media (prefers-reduced-motion: reduce)": {
          "*": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
          },
        },
      },
    },
  },
});

export function ErrorBoundary() {
  return <AdminErrorBoundary />;
}

export default function AdminLayout() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Skip to main content link for accessibility */}
      <MuiLink
        href="#main-content"
        sx={{
          position: "absolute",
          left: -9999,
          zIndex: 9999,
          p: 2,
          bgcolor: "primary.main",
          color: "white",
          textDecoration: "none",
          "&:focus": {
            left: 16,
            top: 16,
          },
        }}
      >
        Skip to main content
      </MuiLink>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <AdminNavigation />
        <Box
          id="main-content"
          component="main"
          tabIndex={-1}
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - 280px)` },
            outline: "none",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </ThemeProvider>
  );
}
