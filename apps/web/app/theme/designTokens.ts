/**
 * Design Tokens System
 * Centralized design system for consistent UI/UX across the application
 */

export const designTokens = {
  colors: {
    primary: {
      main: "#1976d2",
      light: "#42a5f5",
      dark: "#1565c0",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#dc004e",
      light: "#f50057",
      dark: "#c51162",
      contrastText: "#ffffff",
    },
    success: {
      main: "#2e7d32",
      light: "#4caf50",
      dark: "#1b5e20",
      contrastText: "#ffffff",
    },
    warning: {
      main: "#ed6c02",
      light: "#ff9800",
      dark: "#e65100",
      contrastText: "#ffffff",
    },
    error: {
      main: "#d32f2f",
      light: "#ef5350",
      dark: "#c62828",
      contrastText: "#ffffff",
    },
    info: {
      main: "#0288d1",
      light: "#03a9f4",
      dark: "#01579b",
      contrastText: "#ffffff",
    },
    surface: {
      main: "#ffffff",
      paper: "#ffffff",
      elevated: "#f5f5f5",
    },
    background: {
      default: "#f8f9fa",
      paper: "#ffffff",
      elevated: "#f5f5f5",
    },
    text: {
      primary: "#212529",
      secondary: "#6c757d",
      disabled: "#adb5bd",
      hint: "#868e96",
    },
    border: {
      main: "#dee2e6",
      light: "#e9ecef",
      dark: "#ced4da",
    },
    action: {
      active: "rgba(0, 0, 0, 0.54)",
      hover: "rgba(0, 0, 0, 0.04)",
      selected: "rgba(0, 0, 0, 0.08)",
      disabled: "rgba(0, 0, 0, 0.26)",
      disabledBackground: "rgba(0, 0, 0, 0.12)",
      focus: "rgba(0, 0, 0, 0.12)",
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      md: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      xxl: "1.5rem", // 24px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  shadows: {
    none: "none",
    subtle: "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06)",
    medium: "0 4px 6px rgba(0, 0, 0, 0.16), 0 2px 4px rgba(0, 0, 0, 0.08)",
    strong: "0 10px 25px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.15)",
    elevated: "0 20px 40px rgba(0, 0, 0, 0.3), 0 10px 20px rgba(0, 0, 0, 0.2)",
  },
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195,
    },
    easing: {
      easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
      easeOut: "cubic-bezier(0.0, 0, 0.2, 1)",
      easeIn: "cubic-bezier(0.4, 0, 1, 1)",
      sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
  zIndex: {
    mobileStepper: 1000,
    speedDial: 1050,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500,
  },
};

// Helper function to get spacing value
export const spacing = (multiplier: number): number => {
  return designTokens.spacing.md * multiplier;
};

// Helper function to create responsive values
export const responsive = {
  mobile: `@media (max-width: ${designTokens.breakpoints.values.sm}px)`,
  tablet: `@media (min-width: ${designTokens.breakpoints.values.sm}px) and (max-width: ${designTokens.breakpoints.values.md}px)`,
  desktop: `@media (min-width: ${designTokens.breakpoints.values.md}px)`,
  wide: `@media (min-width: ${designTokens.breakpoints.values.lg}px)`,
};

export default designTokens;
