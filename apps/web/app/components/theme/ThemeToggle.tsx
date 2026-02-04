import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '~/lib/utils';
import { prefersReducedMotion, prefersDarkMode } from '~/lib/accessibility';

export type Theme = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'theme-preference';

/**
 * Get the initial theme from localStorage or system preference
 */
function getInitialTheme(): Theme {
    if (typeof window === 'undefined') return 'system';

    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
        return stored;
    }
    return 'system';
}

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme) {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDarkMode());

    root.classList.remove('light', 'dark');
    root.classList.add(isDark ? 'dark' : 'light');
}

/**
 * useTheme - Hook for managing theme state
 */
export function useTheme() {
    const [theme, setThemeState] = useState<Theme>('system');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const initialTheme = getInitialTheme();
        setThemeState(initialTheme);
        applyTheme(initialTheme);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                applyTheme('system');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        applyTheme(newTheme);
    };

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    };

    const isDark = mounted && (theme === 'dark' || (theme === 'system' && prefersDarkMode()));

    return { theme, setTheme, toggleTheme, isDark, mounted };
}

/**
 * ThemeToggle - Animated toggle switch for light/dark mode
 */
export interface ThemeToggleProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
    sm: { track: 'w-12 h-6', thumb: 'w-5 h-5', icon: 'w-3 h-3', translate: 24 },
    md: { track: 'w-16 h-8', thumb: 'w-6 h-6', icon: 'w-3.5 h-3.5', translate: 32 },
    lg: { track: 'w-20 h-10', thumb: 'w-8 h-8', icon: 'w-4 h-4', translate: 40 },
};

export function ThemeToggle({ className, size = 'md' }: ThemeToggleProps) {
    const { toggleTheme, isDark, mounted } = useTheme();
    const shouldReduceMotion = prefersReducedMotion();
    const sizeStyle = sizeClasses[size];

    if (!mounted) {
        return (
            <div className={cn('rounded-full bg-muted', sizeStyle.track, className)} />
        );
    }

    return (
        <motion.button
            onClick={toggleTheme}
            className={cn(
                'relative rounded-full p-1 transition-colors',
                isDark ? 'bg-slate-700' : 'bg-slate-200',
                sizeStyle.track,
                className
            )}
            whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            role="switch"
            aria-checked={isDark}
        >
            <motion.div
                className={cn(
                    'flex items-center justify-center rounded-full shadow-md',
                    isDark ? 'bg-slate-900' : 'bg-white',
                    sizeStyle.thumb
                )}
                animate={{ x: isDark ? sizeStyle.translate : 0 }}
                transition={
                    shouldReduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 500, damping: 30 }
                }
            >
                {isDark ? (
                    <Moon className={cn('text-yellow-400', sizeStyle.icon)} />
                ) : (
                    <Sun className={cn('text-yellow-500', sizeStyle.icon)} />
                )}
            </motion.div>
        </motion.button>
    );
}

/**
 * ThemeSelector - Dropdown/segmented control for theme selection
 */
export interface ThemeSelectorProps {
    className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
    const { theme, setTheme, mounted } = useTheme();
    const shouldReduceMotion = prefersReducedMotion();

    if (!mounted) {
        return <div className={cn('h-10 w-32 rounded-lg bg-muted', className)} />;
    }

    const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
        { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
        { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
        { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
    ];

    return (
        <div
            className={cn(
                'inline-flex rounded-lg bg-muted p-1 gap-1',
                className
            )}
            role="radiogroup"
            aria-label="Theme selection"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                        'relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                        theme === option.value
                            ? 'text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                    role="radio"
                    aria-checked={theme === option.value}
                >
                    {theme === option.value && (
                        <motion.div
                            className="absolute inset-0 bg-background rounded-md shadow-sm"
                            layoutId="theme-selector-active"
                            transition={
                                shouldReduceMotion
                                    ? { duration: 0 }
                                    : { type: 'spring', stiffness: 500, damping: 30 }
                            }
                        />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                        {option.icon}
                        <span className="hidden sm:inline">{option.label}</span>
                    </span>
                </button>
            ))}
        </div>
    );
}

/**
 * ThemeProvider - Context provider for theme (optional, useTheme works standalone)
 */
export interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
    useEffect(() => {
        const stored = getInitialTheme();
        applyTheme(stored || defaultTheme);
    }, [defaultTheme]);

    return <>{children}</>;
}

export default ThemeToggle;
