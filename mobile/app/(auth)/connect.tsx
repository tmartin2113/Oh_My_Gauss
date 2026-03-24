import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff, ChevronLeft } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { validateApiKey } from "@/lib/api";

type Provider = "claude" | "openai" | "gemini";

const PROVIDER_LABELS: Record<Provider, string> = {
  claude: "Claude (Anthropic)",
  openai: "OpenAI",
  gemini: "Google Gemini",
};

const PROVIDER_PLACEHOLDER: Record<Provider, string> = {
  claude: "sk-ant-api03-...",
  openai: "sk-proj-...",
  gemini: "AIza...",
};

export default function ConnectScreen() {
  const router = useRouter();
  const { provider } = useLocalSearchParams<{ provider: Provider }>();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const providerKey = (provider ?? "claude") as Provider;

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const result = await validateApiKey(providerKey, apiKey.trim());

      // Store JWT and metadata — raw API key stays server-side
      await Promise.all([
        SecureStore.setItemAsync("jwt_token", result.token),
        SecureStore.setItemAsync("refresh_token", result.refreshToken),
        SecureStore.setItemAsync("ai_provider", providerKey),
      ]);

      router.replace({
        pathname: "/(auth)/verifying",
        params: { provider: providerKey },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to validate API key";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-4 pb-8">
            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-row items-center mb-8 -ml-1"
              activeOpacity={0.7}
            >
              <ChevronLeft size={20} color="#9090A8" />
              <Text className="text-text-secondary ml-1">Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View className="mb-8">
              <Text className="text-2xl font-bold text-text-primary mb-2">
                Connect {PROVIDER_LABELS[providerKey]}
              </Text>
              <Text className="text-text-secondary text-base leading-6">
                Enter your API key. It will be validated server-side and never
                stored on this device.
              </Text>
            </View>

            {/* API key input */}
            <Text className="text-text-secondary text-sm font-medium mb-2">
              API Key
            </Text>
            <View
              className={[
                "flex-row items-center rounded-md border bg-surface px-4",
                error ? "border-error" : "border-border",
              ].join(" ")}
            >
              <TextInput
                className="flex-1 py-4 text-text-primary text-base"
                value={apiKey}
                onChangeText={(t) => {
                  setApiKey(t);
                  if (error) setError(null);
                }}
                placeholder={PROVIDER_PLACEHOLDER[providerKey]}
                placeholderTextColor="#5A5A6E"
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={handleConnect}
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

            {error && (
              <Text className="text-error text-sm mt-2">{error}</Text>
            )}

            <Text className="text-text-muted text-xs mt-3 leading-5">
              Your key is sent once to the server to create a session. All
              subsequent requests use a short-lived JWT token.
            </Text>

            <View className="flex-1" />

            {/* Connect button */}
            <TouchableOpacity
              onPress={handleConnect}
              disabled={loading || !apiKey.trim()}
              activeOpacity={0.8}
              className={[
                "rounded-full py-4 items-center mt-8",
                loading || !apiKey.trim() ? "bg-primary/50" : "bg-primary",
              ].join(" ")}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Connect
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
