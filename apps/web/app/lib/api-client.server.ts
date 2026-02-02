import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

const DEFAULT_API_URL = "http://localhost:3400/api";

function getServerApiBaseUrl(): string {
  const apiUrl = process.env.API_URL || DEFAULT_API_URL;
  return apiUrl.replace(/\/$/, "");
}

class ServerApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getServerApiBaseUrl(),
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const serverApi = new ServerApiClient();
