import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/lib/store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/** Attach JWT bearer token from SecureStore before every request */
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const token = await SecureStore.getItemAsync("jwt_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // SecureStore unavailable — continue unauthenticated
    if (__DEV__) console.warn("[api] request interceptor SecureStore error:", err);
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

/** Auto-refresh JWT on 401 */
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync("refresh_token");
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      await Promise.all([
        SecureStore.setItemAsync("jwt_token", data.token),
        SecureStore.setItemAsync("refresh_token", data.refreshToken),
      ]);

      processQueue(null, data.token);
      originalRequest.headers.Authorization = `Bearer ${data.token}`;
      return api(originalRequest);
    } catch (err) {
      processQueue(err, null);
      // Clear session on refresh failure — update Zustand store and SecureStore
      await useAuthStore.getState().clearAuth();
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─── Typed API helpers ────────────────────────────────────────────────────────

export interface AuthValidateResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  provider: string;
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
): Promise<AuthValidateResponse> {
  const { data } = await axios.post<AuthValidateResponse>(
    `${BASE_URL}/auth/validate`,
    { provider, apiKey },
  );
  return data;
}

export async function callTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data } = await api.post<{ result: T }>(`/tools/${toolName}`, args);
  return data.result;
}

export async function logout(): Promise<void> {
  await api.delete("/auth/session").catch(() => {});
}
