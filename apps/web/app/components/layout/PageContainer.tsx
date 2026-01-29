import { cn } from "~/lib/utils";

interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
    size?: "default" | "small" | "large" | "full";
}

const sizeClasses = {
    default: "max-w-7xl",
    small: "max-w-4xl",
    large: "max-w-screen-2xl",
    full: "max-w-none",
};

/**
 * Standardized page container with consistent padding and max-width.
 * Use this component to wrap page content for consistent layout.
 * 
 * @example
 * <PageContainer>
 *   <h1>Page Title</h1>
 *   <p>Content...</p>
 * </PageContainer>
 * 
 * @example
 * <PageContainer size="small">
 *   <Form>...</Form>
 * </PageContainer>
 */
export function PageContainer({
    children,
    className,
    size = "default"
}: PageContainerProps) {
    return (
        <div className={cn(
            "mx-auto px-4 sm:px-6 lg:px-8 py-8",
            sizeClasses[size],
            className
        )}>
            {children}
        </div>
    );
}
