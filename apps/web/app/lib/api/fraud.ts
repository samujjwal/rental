import { api } from "~/lib/api-client";

export const fraudApi = {
  getHighRiskUsers: async (limit = 20) => {
    return api.get<unknown>(`/fraud/high-risk-users?limit=${limit}`);
  },
};
