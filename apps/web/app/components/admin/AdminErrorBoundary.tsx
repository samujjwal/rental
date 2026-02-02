import React from "react";
import { Box, Typography, Button, Paper, Alert } from "@mui/material";
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
} from "@mui/icons-material";
import { Link, useRouteError, isRouteErrorResponse, useRevalidator } from "react-router";

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary?: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        p: 3,
        bgcolor: "grey.50",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 600,
          width: "100%",
          p: 4,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            bgcolor: "error.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <ErrorIcon sx={{ fontSize: 32, color: "error.main" }} />
        </Box>

        <Typography variant="h4" gutterBottom color="error">
          Something went wrong
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          An error occurred in the admin panel. Please try refreshing the page
          or contact support if the problem persists.
        </Typography>

        <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
          <Typography
            variant="caption"
            component="pre"
            sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}
          >
            {error.message}
          </Typography>
        </Alert>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          {resetErrorBoundary && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={resetErrorBoundary}
            >
              Try Again
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            component={Link}
            to="/admin"
          >
            Back to Dashboard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export function AdminErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();

  let errorMessage = "An unexpected error occurred";
  let errorStack = "";

  if (isRouteErrorResponse(error)) {
    errorMessage = error.statusText || `Error ${error.status}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorStack = error.stack || "";
  } else if (typeof error === "string") {
    errorMessage = error;
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        p: 3,
        bgcolor: "grey.50",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 600,
          width: "100%",
          p: 4,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            bgcolor: "error.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <ErrorIcon sx={{ fontSize: 32, color: "error.main" }} />
        </Box>

        <Typography variant="h4" gutterBottom color="error">
          Something went wrong
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          An error occurred in the admin panel. Please try refreshing the page
          or contact support if the problem persists.
        </Typography>

        {process.env.NODE_ENV === "development" && (
          <Alert
            severity="error"
            sx={{ mb: 3, textAlign: "left", overflow: "auto" }}
          >
            <Typography
              variant="caption"
              component="pre"
              sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}
            >
              {errorMessage}
              {errorStack && `\n\n${errorStack}`}
            </Typography>
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => revalidator.revalidate()}
          >
            Refresh Page
          </Button>
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            component={Link}
            to="/admin"
          >
            Back to Dashboard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default AdminErrorBoundary;
