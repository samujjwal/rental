import { ApiErrorType, getActionableErrorMessage } from "~/lib/api-error";

export function getListingImageUploadError(
  error: unknown,
  fallbackMessage = "Image upload failed. Please try again."
): string {
  if (!error) {
    return fallbackMessage;
  }

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
    return "You appear to be offline. Reconnect and try uploading the images again.";
  }

  return getActionableErrorMessage(error, fallbackMessage, {
    [ApiErrorType.OFFLINE]: "You appear to be offline. Reconnect and try uploading the images again.",
    [ApiErrorType.TIMEOUT_ERROR]: "Uploading the images timed out. Try again.",
    [ApiErrorType.NETWORK_ERROR]: "We could not upload the images right now. Try again in a moment.",
  });
}