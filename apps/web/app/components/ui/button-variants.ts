/**
 * Button Variants Configuration
 * Centralized button styling for consistent UI across the application
 */

export const buttonVariants = {
  primary: [
    "bg-primary text-primary-foreground",
    "hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-md",
    "focus-visible:ring-primary",
  ].join(" "),

  secondary: [
    "bg-secondary text-secondary-foreground",
    "hover:bg-secondary/80 hover:shadow-lg hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-md",
    "focus-visible:ring-secondary",
  ].join(" "),

  outline: [
    "border border-input bg-background text-foreground",
    "hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:-translate-y-0.5",
    "active:translate-y-0",
    "focus-visible:ring-ring",
  ].join(" "),

  ghost: [
    "bg-transparent text-foreground",
    "hover:bg-accent hover:text-accent-foreground",
    "active:bg-accent/80",
    "focus-visible:ring-ring",
  ].join(" "),

  destructive: [
    "bg-destructive text-destructive-foreground",
    "hover:bg-destructive/90 hover:shadow-lg hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-md",
    "focus-visible:ring-destructive",
  ].join(" "),

  success: [
    "bg-success text-success-foreground",
    "hover:bg-success-dark hover:shadow-lg hover:-translate-y-0.5",
    "active:translate-y-0 active:shadow-md",
    "focus-visible:ring-success",
  ].join(" "),

  link: [
    "text-primary underline-offset-4",
    "hover:underline",
    "focus-visible:ring-primary",
  ].join(" "),
} as const;

export const buttonSizes = {
  xs: "h-7 px-2 text-xs rounded",
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-md",
  lg: "h-11 px-6 text-base rounded-lg",
  xl: "h-12 px-8 text-lg rounded-lg",
  icon: "h-10 w-10 rounded-md",
  "icon-sm": "h-8 w-8 rounded-md",
  "icon-lg": "h-12 w-12 rounded-lg",
} as const;

export const buttonBase = [
  "inline-flex items-center justify-center gap-2",
  "font-medium whitespace-nowrap",
  "transition-all duration-200 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-50",
  "select-none",
].join(" ");

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;
