import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type Provider = "claude" | "openai" | "gemini";

interface AuthState {
  isAuthenticated: boolean;
  provider: Provider | null;
  /** Load JWT + provider from SecureStore on app boot */
  hydrate: () => Promise<void>;
  setAuth: (provider: Provider) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
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
    } catch {
      // SecureStore unavailable (web/emulator fallback)
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
    } catch {
      // ignore
    }
    set({ isAuthenticated: false, provider: null });
  },
}));
