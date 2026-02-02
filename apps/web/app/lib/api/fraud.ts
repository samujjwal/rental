import { api } from "~/lib/api-client";

export const fraudApi = {
  getHighRiskUsers: async (limit = 20) => {
    const response = await api.get(`/fraud/high-risk-users?limit=${limit}`);
    return response.data;
  },
};
