/**
 * Type compatibility shim for React Native packages.
 *
 * Root cause: this pnpm monorepo has @types/react@18 in mobile and @types/react@19
 * in the web app. pnpm hoists @types/react@19 into its virtual store
 * (node_modules/.pnpm/node_modules/@types/react), which TypeScript picks up when
 * resolving types for react-native-* packages in the pnpm store. This causes
 * TS2786 "cannot be used as a JSX component" errors because @types/react@19 adds
 * bigint to ReactNode, which is incompatible with the mobile's @types/react@18.
 *
 * NOTE: No top-level imports — this must remain an **ambient** declaration file
 * so that `declare module` blocks fully override each package's types rather
 * than being treated as module augmentations.
 */

// ── react-native-safe-area-context ─────────────────────────────────────────

declare module "react-native-safe-area-context" {
  import type { ComponentType, ReactNode } from "react";
  import type { ViewProps } from "react-native";

  export type Edge = "top" | "right" | "bottom" | "left";
  export interface EdgeInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }
  export interface SafeAreaViewProps extends ViewProps {
    edges?: ReadonlyArray<Edge>;
    children?: ReactNode;
  }
  export const SafeAreaView: ComponentType<SafeAreaViewProps>;
  export const SafeAreaProvider: ComponentType<{
    children?: ReactNode;
    initialMetrics?: {
      insets: EdgeInsets;
      frame: { x: number; y: number; width: number; height: number };
    } | null;
  }>;
  export function useSafeAreaInsets(): EdgeInsets;
  export function useSafeAreaFrame(): {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  export function withSafeAreaInsets<P>(
    WrappedComponent: ComponentType<P & { insets: EdgeInsets }>
  ): ComponentType<Omit<P, "insets">>;
}

// ── @react-navigation/native ───────────────────────────────────────────────

declare module "@react-navigation/native" {
  import type { ComponentType, ReactNode } from "react";

  export const NavigationContainer: ComponentType<{
    children?: ReactNode;
    theme?: object;
    linking?: object;
    fallback?: ReactNode;
    onReady?: () => void;
    onStateChange?: (state: object | undefined) => void;
  }>;

  export type LinkingOptions<
    ParamList extends Record<string, object | undefined> = Record<string, object | undefined>,
  > = {
    prefixes: string[];
    config?: object;
    enabled?: boolean;
    getInitialURL?: () => Promise<string | null>;
    subscribe?: (listener: (url: string) => void) => (() => void) | void;
    getStateFromPath?: (path: string, options?: object) => object | undefined;
    getPathFromState?: (state: object, options?: object) => string;
    getActionFromState?: (state: object, options?: object) => object | undefined;
  };

  export type CompositeScreenProps<A, B> = A & {
    navigation: A extends { navigation: infer N }
      ? B extends { navigation: infer M }
        ? N & M
        : N
      : never;
  };

  export function useFocusEffect(fn: () => void | (() => void)): void;
  export function useNavigation<T = object>(): T;
  export function useRoute<T = object>(): T;
  export function useIsFocused(): boolean;
  export function useNavigationState<T>(selector: (state: object) => T): T;
}

// ── @react-navigation/native-stack ────────────────────────────────────────

declare module "@react-navigation/native-stack" {
  import type { ComponentType, ReactNode } from "react";

  export type NativeStackScreenProps<
    ParamList extends Record<string, object | undefined>,
    RouteName extends keyof ParamList = keyof ParamList,
  > = {
    navigation: {
      navigate: <K extends keyof ParamList>(
        ...args: undefined extends ParamList[K]
          ? [screen: K] | [screen: K, params: ParamList[K]]
          : [screen: K, params: ParamList[K]]
      ) => void;
      goBack: () => void;
      replace: <K extends keyof ParamList>(
        screen: K,
        params?: ParamList[K]
      ) => void;
      push: <K extends keyof ParamList>(
        screen: K,
        params?: ParamList[K]
      ) => void;
      pop: (count?: number) => void;
      popToTop: () => void;
      reset: (state: object) => void;
      setOptions: (options: object) => void;
      canGoBack: () => boolean;
    };
    route: {
      key: string;
      name: RouteName;
      params: ParamList[RouteName];
    };
  };

  export function createNativeStackNavigator<
    ParamList extends Record<string, object | undefined>,
  >(): {
    Navigator: ComponentType<{
      children?: ReactNode;
      initialRouteName?: keyof ParamList;
      screenOptions?: object | ((opts: object) => object);
    }>;
    Screen: ComponentType<{
      name: keyof ParamList;
      component: ComponentType<any>;
      options?: object | ((opts: object) => object);
    }>;
    Group: ComponentType<{
      children?: ReactNode;
      screenOptions?: object | ((opts: object) => object);
    }>;
  };
}

// ── @react-navigation/bottom-tabs ─────────────────────────────────────────

declare module "@react-navigation/bottom-tabs" {
  import type { ComponentType, ReactNode } from "react";

  export type BottomTabScreenProps<
    ParamList extends Record<string, object | undefined>,
    RouteName extends keyof ParamList = keyof ParamList,
  > = {
    navigation: {
      navigate: <K extends keyof ParamList>(
        ...args: undefined extends ParamList[K]
          ? [screen: K] | [screen: K, params: ParamList[K]]
          : [screen: K, params: ParamList[K]]
      ) => void;
      goBack: () => void;
      setOptions: (options: object) => void;
      canGoBack: () => boolean;
      jumpTo: (screen: keyof ParamList, params?: object) => void;
    };
    route: {
      key: string;
      name: RouteName;
      params: ParamList[RouteName];
    };
  };

  export function createBottomTabNavigator<
    ParamList extends Record<string, object | undefined>,
  >(): {
    Navigator: ComponentType<{
      children?: ReactNode;
      initialRouteName?: keyof ParamList;
      screenOptions?:
        | object
        | ((opts: {
            route: { key: string; name: keyof ParamList; params?: object };
            navigation: object;
          }) => object);
    }>;
    Screen: ComponentType<{
      name: keyof ParamList;
      component: ComponentType<any>;
      options?: object | ((opts: object) => object);
      listeners?: object;
    }>;
    Group: ComponentType<{
      children?: ReactNode;
      screenOptions?: object | ((opts: object) => object);
    }>;
  };
}

// ── react-native-toast-message ────────────────────────────────────────────

declare module "react-native-toast-message" {
  import type { ComponentType } from "react";

  interface ToastShowParams {
    type?: string;
    text1?: string;
    text2?: string;
    position?: "top" | "bottom";
    visibilityTime?: number;
    autoHide?: boolean;
    topOffset?: number;
    bottomOffset?: number;
    onShow?: () => void;
    onHide?: () => void;
    onPress?: () => void;
    props?: object;
  }

  const Toast: ComponentType<{ config?: object; visibilityTime?: number }> & {
    show: (params: ToastShowParams) => void;
    hide: () => void;
  };
  export default Toast;
}

// ── @react-native-community/datetimepicker ────────────────────────────────

declare module "@react-native-community/datetimepicker" {
  import type { ComponentType } from "react";

  export type DateTimePickerEvent = {
    type: string;
    nativeEvent: { timestamp: number; utcOffset?: number };
  };

  export type AndroidMode = "date" | "time" | "datetime" | "countdown";
  export type IOSMode = "date" | "time" | "datetime" | "countdown";
  export type Display =
    | "default"
    | "spinner"
    | "calendar"
    | "clock"
    | "compact"
    | "inline";

  export interface DateTimePickerProps {
    value: Date;
    mode?: AndroidMode | IOSMode;
    display?: Display;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    minimumDate?: Date;
    maximumDate?: Date;
    timeZoneOffsetInMinutes?: number;
    locale?: string;
    is24Hour?: boolean;
    disabled?: boolean;
    testID?: string;
  }

  const DateTimePicker: ComponentType<DateTimePickerProps>;
  export default DateTimePicker;
}

// ── @expo/vector-icons ────────────────────────────────────────────────────

declare module "@expo/vector-icons" {
  import type { ComponentType } from "react";
  import type { TextStyle } from "react-native";

  export interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle;
    testID?: string;
  }
  export const Ionicons: ComponentType<IconProps>;
  export const MaterialIcons: ComponentType<IconProps>;
  export const MaterialCommunityIcons: ComponentType<IconProps>;
  export const FontAwesome: ComponentType<IconProps>;
  export const FontAwesome5: ComponentType<IconProps>;
  export const Feather: ComponentType<IconProps>;
  export const Entypo: ComponentType<IconProps>;
  export const AntDesign: ComponentType<IconProps>;
}


// ── react-native-safe-area-context ─────────────────────────────────────────

declare module "react-native-safe-area-context" {
  export type Edge = "top" | "right" | "bottom" | "left";
  export interface EdgeInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }
  export interface SafeAreaViewProps extends ViewProps {
    edges?: ReadonlyArray<Edge>;
    children?: ReactNode;
  }
  // ComponentType<any> is intentional: avoids React 18/19 ForwardRefExoticComponent mismatch
  export const SafeAreaView: ComponentType<SafeAreaViewProps>;
  export const SafeAreaProvider: ComponentType<{
    children?: ReactNode;
    initialMetrics?: {
      insets: EdgeInsets;
      frame: { x: number; y: number; width: number; height: number };
    } | null;
  }>;
  export function useSafeAreaInsets(): EdgeInsets;
  export function useSafeAreaFrame(): {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  export function withSafeAreaInsets<P>(
    WrappedComponent: ComponentType<P & { insets: EdgeInsets }>
  ): ComponentType<Omit<P, "insets">>;
}

// ── @react-navigation/native ───────────────────────────────────────────────

declare module "@react-navigation/native" {
  import type { ComponentType, ReactNode } from "react";

  export const NavigationContainer: ComponentType<{
    children?: ReactNode;
    theme?: object;
    linking?: object;
    fallback?: ReactNode;
    onReady?: () => void;
    onStateChange?: (state: object | undefined) => void;
  }>;

  export type CompositeScreenProps<A, B> = A & {
    navigation: A extends { navigation: infer N }
      ? B extends { navigation: infer M }
        ? N & M
        : N
      : never;
  };

  export function useFocusEffect(fn: () => void | (() => void)): void;
  export function useNavigation<T = object>(): T;
  export function useRoute<T = object>(): T;
  export function useIsFocused(): boolean;
  export function useNavigationState<T>(selector: (state: object) => T): T;
  export function useLinkingContext(): object;
}

// ── @react-navigation/native-stack ────────────────────────────────────────

declare module "@react-navigation/native-stack" {
  import type { ComponentType, ReactNode } from "react";

  export type NativeStackScreenProps<
    ParamList extends Record<string, object | undefined>,
    RouteName extends keyof ParamList = keyof ParamList,
  > = {
    navigation: {
      navigate: <K extends keyof ParamList>(
        ...args: undefined extends ParamList[K]
          ? [screen: K] | [screen: K, params: ParamList[K]]
          : [screen: K, params: ParamList[K]]
      ) => void;
      goBack: () => void;
      replace: <K extends keyof ParamList>(
        screen: K,
        params?: ParamList[K]
      ) => void;
      push: <K extends keyof ParamList>(
        screen: K,
        params?: ParamList[K]
      ) => void;
      pop: (count?: number) => void;
      popToTop: () => void;
      reset: (state: object) => void;
      setOptions: (options: object) => void;
      canGoBack: () => boolean;
    };
    route: {
      key: string;
      name: RouteName;
      params: ParamList[RouteName];
    };
  };

  export function createNativeStackNavigator<
    ParamList extends Record<string, object | undefined>,
  >(): {
    Navigator: ComponentType<{
      children?: ReactNode;
      initialRouteName?: keyof ParamList;
      screenOptions?: object;
    }>;
    Screen: ComponentType<{
      name: keyof ParamList;
      component: ComponentType<any>;
      options?: object | ((opts: object) => object);
    }>;
    Group: ComponentType<{
      children?: ReactNode;
      screenOptions?: object | ((opts: object) => object);
    }>;
  };
}

// ── @react-navigation/bottom-tabs ─────────────────────────────────────────

declare module "@react-navigation/bottom-tabs" {
  import type { ComponentType, ReactNode } from "react";

  export type BottomTabScreenProps<
    ParamList extends Record<string, object | undefined>,
    RouteName extends keyof ParamList = keyof ParamList,
  > = {
    navigation: {
      navigate: <K extends keyof ParamList>(
        ...args: undefined extends ParamList[K]
          ? [screen: K] | [screen: K, params: ParamList[K]]
          : [screen: K, params: ParamList[K]]
      ) => void;
      goBack: () => void;
      setOptions: (options: object) => void;
      canGoBack: () => boolean;
      jumpTo: (screen: keyof ParamList, params?: object) => void;
    };
    route: {
      key: string;
      name: RouteName;
      params: ParamList[RouteName];
    };
  };

  export function createBottomTabNavigator<
    ParamList extends Record<string, object | undefined>,
  >(): {
    Navigator: ComponentType<{
      children?: ReactNode;
      initialRouteName?: keyof ParamList;
      screenOptions?:
        | object
        | ((opts: {
            route: { key: string; name: keyof ParamList; params?: object };
            navigation: object;
          }) => object);
    }>;
    Screen: ComponentType<{
      name: keyof ParamList;
      component: ComponentType<any>;
      options?: object | ((opts: object) => object);
      listeners?: object;
    }>;
    Group: ComponentType<{
      children?: ReactNode;
      screenOptions?: object | ((opts: object) => object);
    }>;
  };
}

// ── react-native-toast-message ────────────────────────────────────────────

declare module "react-native-toast-message" {
  import type { ComponentType } from "react";

  const Toast: ComponentType<{ config?: object; visibilityTime?: number }> & {
    show: (options: {
      type?: string;
      text1?: string;
      text2?: string;
      position?: "top" | "bottom";
      visibilityTime?: number;
      autoHide?: boolean;
      topOffset?: number;
      bottomOffset?: number;
      onShow?: () => void;
      onHide?: () => void;
      onPress?: () => void;
      props?: object;
    }) => void;
    hide: () => void;
  };
  export default Toast;
}

// ── @react-native-community/datetimepicker ────────────────────────────────

declare module "@react-native-community/datetimepicker" {
  import type { ComponentType } from "react";

  export type DateTimePickerEvent = {
    type: string;
    nativeEvent: { timestamp: number; utcOffset?: number };
  };

  export type AndroidMode = "date" | "time" | "datetime" | "countdown";
  export type IOSMode = "date" | "time" | "datetime" | "countdown";
  export type Display =
    | "default"
    | "spinner"
    | "calendar"
    | "clock"
    | "compact"
    | "inline";

  export interface DateTimePickerProps {
    value: Date;
    mode?: AndroidMode | IOSMode;
    display?: Display;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    minimumDate?: Date;
    maximumDate?: Date;
    timeZoneOffsetInMinutes?: number;
    locale?: string;
    is24Hour?: boolean;
    disabled?: boolean;
    testID?: string;
  }

  const DateTimePicker: ComponentType<DateTimePickerProps>;
  export default DateTimePicker;
}
