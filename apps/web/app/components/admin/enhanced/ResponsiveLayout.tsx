/**
 * Responsive Layout Components
 * Adaptive layouts for mobile, tablet, and desktop — pure Tailwind
 */

import React, { useState, useEffect } from "react";

export type ViewMode = "mobile" | "tablet" | "desktop" | "wide";

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  mobileComponent?: React.ReactNode;
  tabletComponent?: React.ReactNode;
  desktopComponent?: React.ReactNode;
}

export const useResponsiveMode = (): ViewMode => {
  const [mode, setMode] = useState<ViewMode>("desktop");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 640) setMode("mobile");
      else if (w < 768) setMode("tablet");
      else if (w >= 1280) setMode("wide");
      else setMode("desktop");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return mode;
};

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  mobileComponent,
  tabletComponent,
  desktopComponent,
}) => {
  const mode = useResponsiveMode();

  if (mode === "mobile" && mobileComponent) return <>{mobileComponent}</>;
  if (mode === "tablet" && tabletComponent) return <>{tabletComponent}</>;
  if ((mode === "desktop" || mode === "wide") && desktopComponent)
    return <>{desktopComponent}</>;

  return <>{children}</>;
};

interface LayoutProps {
  children: React.ReactNode;
}

export const MobileLayout: React.FC<LayoutProps> = ({ children }) => (
  <div className="w-full px-2 py-2 flex flex-col gap-2">{children}</div>
);

export const TabletLayout: React.FC<LayoutProps> = ({ children }) => (
  <div className="w-full px-3 py-2 flex flex-col gap-2">{children}</div>
);

export const DesktopLayout: React.FC<LayoutProps> = ({ children }) => (
  <div className="w-full px-4 py-3 flex flex-col gap-3">{children}</div>
);

interface AdaptiveContainerProps {
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | false;
}

const maxWidthMap: Record<string, string> = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
};

export const AdaptiveContainer: React.FC<AdaptiveContainerProps> = ({
  children,
  maxWidth = "xl",
}) => (
  <div
    className={`w-full mx-auto px-2 sm:px-3 md:px-4 py-2 sm:py-2 md:py-3 ${
      maxWidth ? maxWidthMap[maxWidth] || "" : ""
    }`}
  >
    {children}
  </div>
);

export default ResponsiveLayout;
