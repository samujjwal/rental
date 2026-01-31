/**
 * Keyboard Shortcuts System
 * Global keyboard shortcuts for power users
 */

import React, { useEffect, useCallback, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
} from "@mui/icons-material";

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
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>
  );

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys: string[] = [];
    if (shortcut.ctrlKey) keys.push("Ctrl");
    if (shortcut.metaKey) keys.push("⌘");
    if (shortcut.altKey) keys.push("Alt");
    if (shortcut.shiftKey) keys.push("Shift");
    keys.push(shortcut.key.toUpperCase());
    return keys.join(" + ");
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <KeyboardIcon />
            <Typography variant="h6">Keyboard Shortcuts</Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {Object.entries(groupedShortcuts).map(
          ([category, categoryShortcuts]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                {category}
              </Typography>
              <List dense>
                {categoryShortcuts.map((shortcut, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={shortcut.description}
                      secondary={
                        <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                          {formatShortcut(shortcut)
                            .split(" + ")
                            .map((key, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && (
                                  <Typography variant="caption">+</Typography>
                                )}
                                <Chip
                                  label={key}
                                  size="small"
                                  variant="outlined"
                                />
                              </React.Fragment>
                            ))}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              <Divider />
            </Box>
          )
        )}
        <Typography variant="caption" color="text.secondary">
          Press Shift + ? to show this dialog
        </Typography>
      </DialogContent>
    </Dialog>
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
