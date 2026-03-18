import { useState } from "react";
import { LayoutGrid, Pin, PinOff, RotateCcw, Settings2, EyeOff, Eye } from "lucide-react";
import { cn } from "~/lib/utils";
import { UnifiedButton } from "~/components/ui";

export interface DashboardCustomizerSection {
  id: string;
  title: string;
  description?: string;
}

interface DashboardCustomizerProps {
  sections: DashboardCustomizerSection[];
  pinnedIds: Set<string>;
  hiddenIds: Set<string>;
  onTogglePinned: (sectionId: string) => void;
  onToggleHidden: (sectionId: string) => void;
  onReset: () => void;
  className?: string;
}

export function DashboardCustomizer({
  sections,
  pinnedIds,
  hiddenIds,
  onTogglePinned,
  onToggleHidden,
  onReset,
  className,
}: DashboardCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <UnifiedButton
        variant="outline"
        size="sm"
        onClick={() => setIsOpen((value) => !value)}
        leftIcon={<Settings2 className="h-4 w-4" />}
      >
        Customize
      </UnifiedButton>

      {isOpen ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[22rem] rounded-xl border border-border bg-card p-4 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Dashboard Layout
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Pin the sections you use most and hide the ones you do not need.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close dashboard customizer"
            >
              <EyeOff className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {sections.map((section) => {
              const isPinned = pinnedIds.has(section.id);
              const isHidden = hiddenIds.has(section.id);

              return (
                <div
                  key={section.id}
                  className="rounded-lg border border-border/70 bg-background/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {section.title}
                      </p>
                      {section.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {section.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onTogglePinned(section.id)}
                        className={cn(
                          "rounded-md p-2 transition-colors",
                          isPinned
                            ? "bg-primary/10 text-primary hover:bg-primary/20"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        aria-label={isPinned ? "Unpin section" : "Pin section"}
                      >
                        {isPinned ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleHidden(section.id)}
                        className={cn(
                          "rounded-md p-2 transition-colors",
                          isHidden
                            ? "bg-warning/10 text-warning hover:bg-warning/20"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        aria-label={isHidden ? "Show section" : "Hide section"}
                      >
                        {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Pinned sections appear first on your dashboard.
            </p>
            <UnifiedButton
              variant="ghost"
              size="sm"
              onClick={onReset}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Reset
            </UnifiedButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DashboardCustomizer;