export type NavigationRequest = {
  to: string;
  replace?: boolean;
};

export function requestNavigation(to: string, options?: { replace?: boolean }) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<NavigationRequest>("app:navigate", {
      detail: {
        to,
        replace: options?.replace ?? false,
      },
    })
  );
}

export function requestRevalidate() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("app:revalidate"));
}
