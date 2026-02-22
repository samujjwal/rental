/**
 * Keyboard Shortcuts System
 * Global keyboard shortcuts for power users — pure Tailwind
 */

import React, { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  category?: string;
}

interface KeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingShortcut = shortcuts.find((shortcut) => {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;
        const metaMatch = shortcut.metaKey ? event.metaKey : !event.metaKey;
        return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, enabled]);
};

export const KeyboardShortcutsHelp: React.FC<{
  shortcuts: KeyboardShortcut[];
}> = ({ shortcuts }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "?" && event.shiftKey) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>
  );

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys: string[] = [];
    if (shortcut.ctrlKey) keys.push("Ctrl");
    if (shortcut.metaKey) keys.push("\u2318");
    if (shortcut.altKey) keys.push("Alt");
    if (shortcut.shiftKey) keys.push("Shift");
    keys.push(shortcut.key.toUpperCase());
    return keys;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold mb-2">{category}</h3>
              <ul className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <li key={index} className="flex items-center justify-between py-1">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {formatShortcut(shortcut).map((key, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
                          <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 text-xs font-medium">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <hr className="mt-3" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Press Shift + ? to show this dialog
          </p>
        </div>
      </div>
    </div>
  );
};

export const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = ({
  shortcuts,
  enabled = true,
}) => {
  useKeyboardShortcuts(shortcuts, enabled);
  return <KeyboardShortcutsHelp shortcuts={shortcuts} />;
};

export default KeyboardShortcuts;
