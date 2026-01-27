import type { ReactNode } from "react";

export function AdminPageShell({
    title,
    description,
    actions,
    children,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    {description ? (
                        <p className="text-gray-600">{description}</p>
                    ) : null}
                </div>
                {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
            </div>
            {children}
        </div>
    );
}
