import { createMobileClient } from "@rental-portal/mobile-sdk";
import { authStore } from "./authStore";
import { API_BASE_URL } from "../config";

export const mobileClient = createMobileClient({
  baseUrl: API_BASE_URL,
  getAuthToken: authStore.getToken,
});
