/**
 * Skip to Main Content Link
 * WCAG 2.1 Success Criterion 2.4.1 (Level A)
 */

export interface SkipLinkProps {
    targetId?: string;
    label?: string;
    className?: string;
}

export function SkipLink({
    targetId = 'main-content',
    label = 'Skip to main content',
    className = '',
}: SkipLinkProps) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const target = document.getElementById(targetId);
        if (target) {
            target.focus();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <a
            href={`#${targetId}`}
            onClick={handleClick}
            className={`
        sr-only
        focus:not-sr-only
        focus:absolute
        focus:top-4
        focus:left-4
        focus:z-[9999]
        focus:bg-blue-600
        focus:text-white
        focus:px-4
        focus:py-2
        focus:rounded-lg
        focus:shadow-lg
        focus:outline-none
        focus:ring-2
        focus:ring-blue-400
        focus:ring-offset-2
        ${className}
      `}
        >
            {label}
        </a>
    );
}

/**
 * Multiple Skip Links for complex pages
 */
export interface SkipLinksProps {
    links: Array<{
        targetId: string;
        label: string;
    }>;
}

export function SkipLinks({ links }: SkipLinksProps) {
    return (
        <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
            <ul className="focus-within:absolute focus-within:top-4 focus-within:left-4 focus-within:z-[9999] focus-within:flex focus-within:flex-col focus-within:gap-2">
                {links.map((link) => (
                    <li key={link.targetId}>
                        <SkipLink targetId={link.targetId} label={link.label} />
                    </li>
                ))}
            </ul>
        </nav>
    );
}
