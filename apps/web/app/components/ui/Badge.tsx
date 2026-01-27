import { HTMLAttributes, forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "info";
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
    ({ className = "", variant = "default", children, ...props }, ref) => {
        const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

        const variants = {
            default: "border-transparent bg-gray-900 text-white hover:bg-gray-800",
            secondary: "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-200",
            outline: "text-gray-900 border-gray-200",
            destructive: "border-transparent bg-red-100 text-red-700 hover:bg-red-200",
            success: "border-transparent bg-green-100 text-green-700 hover:bg-green-200",
            warning: "border-transparent bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
            info: "border-transparent bg-blue-100 text-blue-700 hover:bg-blue-200"
        };

        return (
            <div
                className={`${baseStyles} ${variants[variant]} ${className}`}
                ref={ref}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Badge.displayName = "Badge";
