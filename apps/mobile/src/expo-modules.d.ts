/**
 * Module declarations for Expo packages that may not be installed
 * locally but are available in the Expo managed workflow at runtime.
 */

declare module 'expo-device' {
  export const isDevice: boolean;
  export const brand: string | null;
  export const modelName: string | null;
  export const osName: string | null;
  export const osVersion: string | null;
  export const deviceType: number | null;
}

declare module 'expo-linking' {
  export function createURL(path: string, params?: Record<string, string>): string;
  export function parse(url: string): { hostname: string | null; path: string | null; queryParams: Record<string, string> | null; scheme: string | null };
  export function openURL(url: string): Promise<void>;
  export function canOpenURL(url: string): Promise<boolean>;
  export function getInitialURL(): Promise<string | null>;
  export function addEventListener(type: string, handler: (event: { url: string }) => void): { remove: () => void };
}
