import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, LogOut, RotateCcw } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { validateApiKey, logout } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const PROVIDER_LABELS = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  gemini: "Google Gemini",
};

const PROVIDER_COLORS = {
  claude: "#D97706",
  openai: "#10B981",
  gemini: "#3B82F6",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { provider, clearAuth } = useAuthStore();
  const [newKey, setNewKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState(false);

  const providerKey = provider ?? "claude";
  const accentColor = PROVIDER_COLORS[providerKey];

  const handleRotateKey = async () => {
    if (!newKey.trim()) {
      setRotateError("New API key is required");
      return;
    }
    setRotateError(null);
    setRotateSuccess(false);
    setRotating(true);

    try {
      const result = await validateApiKey(providerKey, newKey.trim());
      await Promise.all([
        SecureStore.setItemAsync("jwt_token", result.token),
        SecureStore.setItemAsync("refresh_token", result.refreshToken),
      ]);
      setNewKey("");
      setRotateSuccess(true);
      setTimeout(() => setRotateSuccess(false), 3000);
    } catch (err: unknown) {
      setRotateError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to validate new key",
      );
    } finally {
      setRotating(false);
    }
  };

  const handleSignOut = () => {
    if (Platform.OS === "web") {
      confirmSignOut();
      return;
    }
    Alert.alert("Sign Out", "This will end your current session.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: confirmSignOut },
    ]);
  };

  const confirmSignOut = async () => {
    await logout();
    await clearAuth();
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {/* Provider badge */}
        <View className="mb-6">
          <Text className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-3">
            Current Provider
          </Text>
          <View
            className="rounded-md p-4 border"
            style={{
              backgroundColor: `${accentColor}11`,
              borderColor: `${accentColor}33`,
            }}
          >
            <Text
              className="font-semibold text-base"
              style={{ color: accentColor }}
            >
              {PROVIDER_LABELS[providerKey]}
            </Text>
            <Text className="text-text-muted text-xs mt-1">
              Active session · JWT auto-refreshes
            </Text>
          </View>
        </View>

        {/* Rotate API key */}
        <View className="mb-6">
          <Text className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-3">
            Rotate API Key
          </Text>
          <View
            className={[
              "flex-row items-center rounded-md border bg-surface px-3 mb-2",
              rotateError ? "border-error" : "border-border",
            ].join(" ")}
          >
            <TextInput
              className="flex-1 py-3 text-text-primary text-base"
              value={newKey}
              onChangeText={(t) => {
                setNewKey(t);
                if (rotateError) setRotateError(null);
                if (rotateSuccess) setRotateSuccess(false);
              }}
              placeholder="New API key"
              placeholderTextColor="#5A5A6E"
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowKey((v) => !v)}
              className="ml-2 p-1"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showKey ? (
                <EyeOff size={18} color="#9090A8" />
              ) : (
                <Eye size={18} color="#9090A8" />
              )}
            </TouchableOpacity>
          </View>

          {rotateError && (
            <Text className="text-error text-xs mb-2">{rotateError}</Text>
          )}
          {rotateSuccess && (
            <Text className="text-success text-xs mb-2">
              API key updated successfully
            </Text>
          )}

          <TouchableOpacity
            onPress={handleRotateKey}
            disabled={rotating || !newKey.trim()}
            className={[
              "flex-row items-center justify-center gap-2 rounded-md py-3",
              rotating || !newKey.trim() ? "bg-surface-2" : "bg-surface",
              "border border-border",
            ].join(" ")}
          >
            {rotating ? (
              <ActivityIndicator color="#9090A8" size="small" />
            ) : (
              <>
                <RotateCcw size={16} color="#9090A8" />
                <Text className="text-text-secondary font-medium text-sm">
                  Rotate Key
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <View>
          <Text className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-3">
            Session
          </Text>
          <TouchableOpacity
            onPress={handleSignOut}
            className="flex-row items-center justify-center gap-2 rounded-md py-3 border border-error/50 bg-error/10"
          >
            <LogOut size={16} color="#EF4444" />
            <Text className="text-error font-medium text-sm">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App info */}
        <View className="mt-12 items-center">
          <Text className="text-text-muted text-xs">Oh My Gauss v1.0.0</Text>
          <Text className="text-text-muted text-xs mt-1">
            AI-powered research assistant
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
