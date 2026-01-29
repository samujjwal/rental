import { cn } from "~/lib/utils";

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
    className?: string;
}

/**
 * Standardized page header with title, optional description, and action slot.
 * Use this component at the top of pages for consistent header styling.
 * 
 * @example
 * <PageHeader 
 *   title="Dashboard" 
 *   description="Welcome back to your dashboard"
 * >
 *   <Button>Create New</Button>
 * </PageHeader>
 */
export function PageHeader({ title, description, children, className }: PageHeaderProps) {
    return (
        <div className={cn("mb-8", className)}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-2 text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {children && (
                    <div className="flex shrink-0 gap-3">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
