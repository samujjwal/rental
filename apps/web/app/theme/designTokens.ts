/**
 * Design Tokens System
 * Centralized design system for consistent UI/UX across the application
 */

export const designTokens = {
  colors: {
    primary: {
      main: "#4f46e5", // Indigo 600
      light: "#818cf8", // Indigo 400
      dark: "#3730a3", // Indigo 800
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#f8fafc", // Slate 50 (Surface)
      light: "#ffffff", 
      dark: "#e2e8f0", // Slate 200
      contrastText: "#0f172a", // Slate 900
    },
    success: {
      main: "#10b981", // Emerald 500
      light: "#34d399",
      dark: "#059669",
      contrastText: "#ffffff",
    },
    warning: {
      main: "#f59e0b", // Amber 500
      light: "#fbbf24",
      dark: "#d97706",
      contrastText: "#ffffff",
    },
    error: {
      main: "#ef4444", // Red 500
      light: "#f87171",
      dark: "#b91c1c",
      contrastText: "#ffffff",
    },
    info: {
      main: "#3b82f6", // Blue 500
      light: "#60a5fa",
      dark: "#2563eb",
      contrastText: "#ffffff",
    },
    surface: {
      main: "#ffffff",
      paper: "#ffffff",
      elevated: "#ffffff",
    },
    background: {
      default: "#ffffff", // Clean consistent white
      paper: "#ffffff",
      elevated: "#ffffff",
    },
    text: {
      primary: "#0f172a", // Slate 900
      secondary: "#64748b", // Slate 500
      disabled: "#cbd5e1", // Slate 300
      hint: "#94a3b8", // Slate 400
    },
    border: {
      main: "#e2e8f0", // Slate 200
      light: "#f1f5f9", // Slate 100
      dark: "#cbd5e1", // Slate 300
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
