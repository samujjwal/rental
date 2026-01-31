/**
 * Responsive Layout Components
 * Adaptive layouts for mobile, tablet, and desktop
 */

import React from "react";
import { useTheme, useMediaQuery, Box } from "@mui/material";
import type { Breakpoint } from "@mui/material";

export type ViewMode = "mobile" | "tablet" | "desktop" | "wide";

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  mobileComponent?: React.ReactNode;
  tabletComponent?: React.ReactNode;
  desktopComponent?: React.ReactNode;
}

export const useResponsiveMode = (): ViewMode => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const isWide = useMediaQuery(theme.breakpoints.up("xl"));

  if (isMobile) return "mobile";
  if (isTablet) return "tablet";
  if (isWide) return "wide";
  return "desktop";
};

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  mobileComponent,
  tabletComponent,
  desktopComponent,
}) => {
  const mode = useResponsiveMode();

  if (mode === "mobile" && mobileComponent) {
    return <>{mobileComponent}</>;
  }

  if (mode === "tablet" && tabletComponent) {
    return <>{tabletComponent}</>;
  }

  if ((mode === "desktop" || mode === "wide") && desktopComponent) {
    return <>{desktopComponent}</>;
  }

  return <>{children}</>;
};

interface MobileLayoutProps {
  children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
  return (
    <Box
      sx={{
        width: "100%",
        px: 2,
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
};

interface TabletLayoutProps {
  children: React.ReactNode;
}

export const TabletLayout: React.FC<TabletLayoutProps> = ({ children }) => {
  return (
    <Box
      sx={{
        width: "100%",
        px: 3,
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
};

interface DesktopLayoutProps {
  children: React.ReactNode;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({ children }) => {
  return (
    <Box
      sx={{
        width: "100%",
        px: 4,
        py: 3,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {children}
    </Box>
  );
};

interface AdaptiveContainerProps {
  children: React.ReactNode;
  maxWidth?: Breakpoint | false;
}

export const AdaptiveContainer: React.FC<AdaptiveContainerProps> = ({
  children,
  maxWidth = "xl",
}) => {
  const mode = useResponsiveMode();

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: maxWidth ? `${maxWidth}` : undefined,
        mx: "auto",
        px: {
          xs: 2,
          sm: 3,
          md: 4,
        },
        py: {
          xs: 2,
          sm: 2,
          md: 3,
        },
      }}
    >
      {children}
    </Box>
  );
};

export default ResponsiveLayout;
