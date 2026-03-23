import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export function getListingCategoryLoadError(
  error: unknown,
  fallbackMessage = "Unable to load categories. Please try again later."
): string {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
      ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message)
      : null;

  if (responseMessage) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try loading categories again.";
  }

  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try loading categories again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Loading categories timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not reach the category service. Try again in a moment.",
  });
}