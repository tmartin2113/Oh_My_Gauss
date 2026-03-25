import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type Provider = "claude" | "openai" | "gemini";

interface AuthState {
  isAuthenticated: boolean;
  hydrated: boolean;
  provider: Provider | null;
  /** Load JWT + provider from SecureStore on app boot */
  hydrate: () => Promise<void>;
  setAuth: (provider: Provider) => void;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  hydrated: false,
  provider: null,

  hydrate: async () => {
    try {
      const [jwt, provider] = await Promise.all([
        SecureStore.getItemAsync("jwt_token"),
        SecureStore.getItemAsync("ai_provider"),
      ]);
      if (jwt && provider) {
        set({ isAuthenticated: true, provider: provider as Provider });
      }
    } catch (err) {
      // SecureStore unavailable (web/emulator fallback)
      if (__DEV__) console.warn("[store] hydrate failed:", err);
    } finally {
      set({ hydrated: true });
    }
  },

  setAuth: (provider) => {
    set({ isAuthenticated: true, provider });
  },

  clearAuth: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync("jwt_token"),
        SecureStore.deleteItemAsync("refresh_token"),
        SecureStore.deleteItemAsync("ai_provider"),
      ]);
    } catch (err) {
      if (__DEV__) console.warn("[store] clearAuth SecureStore error:", err);
    }
    set({ isAuthenticated: false, provider: null });
  },
}));
