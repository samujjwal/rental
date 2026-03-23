import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export function getListingDescriptionGenerationError(
  error: unknown,
  fallbackMessage = "Failed to generate description. Please write one manually."
): string {
  const responseMessage =
    error &&
    typeof error === "object" &&
    "response" in error
      ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
      : undefined;

  if (responseMessage) {
    return responseMessage;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect and try generating the description again.";
  }

  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try generating the description again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Description generation timed out. Try again.",
  });
}