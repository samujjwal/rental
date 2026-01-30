/**
 * Material-UI Theme Configuration
 * Enhanced theme with design tokens integration
 */

import { createTheme, ThemeOptions } from "@mui/material/styles";
import designTokens from "./designTokens";

const themeOptions: ThemeOptions = {
  palette: {
    mode: "light",
    primary: {
      main: designTokens.colors.primary.main,
      light: designTokens.colors.primary.light,
      dark: designTokens.colors.primary.dark,
      contrastText: designTokens.colors.primary.contrastText,
    },
    secondary: {
      main: designTokens.colors.secondary.main,
      light: designTokens.colors.secondary.light,
      dark: designTokens.colors.secondary.dark,
      contrastText: designTokens.colors.secondary.contrastText,
    },
    success: {
      main: designTokens.colors.success.main,
      light: designTokens.colors.success.light,
      dark: designTokens.colors.success.dark,
      contrastText: designTokens.colors.success.contrastText,
    },
    warning: {
      main: designTokens.colors.warning.main,
      light: designTokens.colors.warning.light,
      dark: designTokens.colors.warning.dark,
      contrastText: designTokens.colors.warning.contrastText,
    },
    error: {
      main: designTokens.colors.error.main,
      light: designTokens.colors.error.light,
      dark: designTokens.colors.error.dark,
      contrastText: designTokens.colors.error.contrastText,
    },
    info: {
      main: designTokens.colors.info.main,
      light: designTokens.colors.info.light,
      dark: designTokens.colors.info.dark,
      contrastText: designTokens.colors.info.contrastText,
    },
    background: {
      default: designTokens.colors.background.default,
      paper: designTokens.colors.background.paper,
    },
    text: {
      primary: designTokens.colors.text.primary,
      secondary: designTokens.colors.text.secondary,
      disabled: designTokens.colors.text.disabled,
    },
    divider: designTokens.colors.border.main,
    action: {
      active: designTokens.colors.action.active,
      hover: designTokens.colors.action.hover,
      selected: designTokens.colors.action.selected,
      disabled: designTokens.colors.action.disabled,
      disabledBackground: designTokens.colors.action.disabledBackground,
      focus: designTokens.colors.action.focus,
    },
  },
  typography: {
    fontFamily: designTokens.typography.fontFamily,
    fontSize: 16,
    fontWeightLight: designTokens.typography.fontWeight.light,
    fontWeightRegular: designTokens.typography.fontWeight.normal,
    fontWeightMedium: designTokens.typography.fontWeight.medium,
    fontWeightBold: designTokens.typography.fontWeight.bold,
    h1: {
      fontSize: "2.5rem",
      fontWeight: designTokens.typography.fontWeight.bold,
      lineHeight: designTokens.typography.lineHeight.tight,
    },
    h2: {
      fontSize: "2rem",
      fontWeight: designTokens.typography.fontWeight.bold,
      lineHeight: designTokens.typography.lineHeight.tight,
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: designTokens.typography.fontWeight.semibold,
      lineHeight: designTokens.typography.lineHeight.tight,
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: designTokens.typography.fontWeight.semibold,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: designTokens.typography.fontWeight.medium,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: designTokens.typography.fontWeight.medium,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
    body1: {
      fontSize: designTokens.typography.fontSize.md,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
    body2: {
      fontSize: designTokens.typography.fontSize.sm,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
    button: {
      fontSize: designTokens.typography.fontSize.sm,
      fontWeight: designTokens.typography.fontWeight.medium,
      textTransform: "none",
    },
    caption: {
      fontSize: designTokens.typography.fontSize.xs,
      lineHeight: designTokens.typography.lineHeight.normal,
    },
  },
  spacing: designTokens.spacing.md / 4, // MUI uses 8px as base, we use 4px multiplier
  shape: {
    borderRadius: designTokens.borderRadius.md,
  },
  shadows: [
    "none",
    designTokens.shadows.subtle,
    designTokens.shadows.subtle,
    designTokens.shadows.medium,
    designTokens.shadows.medium,
    designTokens.shadows.medium,
    designTokens.shadows.strong,
    designTokens.shadows.strong,
    designTokens.shadows.strong,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
    designTokens.shadows.elevated,
  ],
  transitions: {
    duration: {
      shortest: designTokens.transitions.duration.shortest,
      shorter: designTokens.transitions.duration.shorter,
      short: designTokens.transitions.duration.short,
      standard: designTokens.transitions.duration.standard,
      complex: designTokens.transitions.duration.complex,
      enteringScreen: designTokens.transitions.duration.enteringScreen,
      leavingScreen: designTokens.transitions.duration.leavingScreen,
    },
    easing: {
      easeInOut: designTokens.transitions.easing.easeInOut,
      easeOut: designTokens.transitions.easing.easeOut,
      easeIn: designTokens.transitions.easing.easeIn,
      sharp: designTokens.transitions.easing.sharp,
    },
  },
  breakpoints: {
    values: designTokens.breakpoints.values,
  },
  zIndex: designTokens.zIndex,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.md,
          padding: `${designTokens.spacing.sm}px ${designTokens.spacing.md}px`,
          minHeight: 40,
          transition: `all ${designTokens.transitions.duration.short}ms ${designTokens.transitions.easing.easeInOut}`,
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: designTokens.shadows.medium,
          },
        },
        sizeLarge: {
          minHeight: 48,
          padding: `${designTokens.spacing.md}px ${designTokens.spacing.lg}px`,
        },
        sizeSmall: {
          minHeight: 32,
          padding: `${designTokens.spacing.xs}px ${designTokens.spacing.sm}px`,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.md,
          transition: `all ${designTokens.transitions.duration.short}ms ${designTokens.transitions.easing.easeInOut}`,
          "&:hover": {
            backgroundColor: designTokens.colors.action.hover,
          },
        },
        sizeLarge: {
          width: 48,
          height: 48,
        },
        sizeMedium: {
          width: 40,
          height: 40,
        },
        sizeSmall: {
          width: 32,
          height: 32,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: designTokens.borderRadius.md,
            transition: `all ${designTokens.transitions.duration.short}ms ${designTokens.transitions.easing.easeInOut}`,
            "&:hover": {
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: designTokens.colors.primary.light,
              },
            },
            "&.Mui-focused": {
              "& .MuiOutlinedInput-notchedOutline": {
                borderWidth: 2,
              },
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.lg,
          boxShadow: designTokens.shadows.subtle,
          transition: `all ${designTokens.transitions.duration.short}ms ${designTokens.transitions.easing.easeInOut}`,
          "&:hover": {
            boxShadow: designTokens.shadows.medium,
            transform: "translateY(-2px)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.lg,
        },
        elevation1: {
          boxShadow: designTokens.shadows.subtle,
        },
        elevation2: {
          boxShadow: designTokens.shadows.medium,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.md,
          fontWeight: designTokens.typography.fontWeight.medium,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${designTokens.colors.border.light}`,
        },
        head: {
          fontWeight: designTokens.typography.fontWeight.semibold,
          backgroundColor: designTokens.colors.background.elevated,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${designTokens.transitions.duration.short}ms ${designTokens.transitions.easing.easeInOut}`,
          "&:hover": {
            backgroundColor: designTokens.colors.action.hover,
          },
          "&.Mui-selected": {
            backgroundColor: designTokens.colors.action.selected,
            "&:hover": {
              backgroundColor: designTokens.colors.action.selected,
            },
          },
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);

export default theme;
