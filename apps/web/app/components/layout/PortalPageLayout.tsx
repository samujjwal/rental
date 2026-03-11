import type { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import type { SidebarSection } from "./DashboardSidebar";
import { PageContainer } from "./PageContainer";
import { PageHeader } from "./PageHeader";
import { cn } from "~/lib/utils";

interface PortalPageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  sidebarSections?: SidebarSection[];
  actions?: ReactNode;
  banner?: ReactNode;
  className?: string;
  containerClassName?: string;
  contentClassName?: string;
  containerSize?: "default" | "small" | "large" | "full";
}

export function PortalPageLayout({
  title,
  description,
  children,
  sidebarSections,
  actions,
  banner,
  className,
  containerClassName,
  contentClassName,
  containerSize = "default",
}: PortalPageLayoutProps) {
  const hasSidebar = Boolean(sidebarSections?.length);

  return (
    <div className={cn("min-h-screen bg-background py-8", className)}>
      <PageContainer size={containerSize} className={containerClassName}>
        {banner ? <div className="mb-6">{banner}</div> : null}
        <PageHeader title={title} description={description}>
          {actions}
        </PageHeader>

        {hasSidebar ? (
          <div className="flex flex-col gap-8 lg:flex-row">
            <DashboardSidebar sections={sidebarSections ?? []} />
            <div className={cn("min-w-0 flex-1", contentClassName)}>
              {children}
            </div>
          </div>
        ) : (
          <div className={contentClassName}>{children}</div>
        )}
      </PageContainer>
    </div>
  );
}
