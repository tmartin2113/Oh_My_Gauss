import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CheckCircle } from "lucide-react-native";
import { useAuthStore } from "@/lib/store";

type Provider = "claude" | "openai" | "gemini";

const PROVIDER_COLORS: Record<Provider, string> = {
  claude: "#D97706",
  openai: "#10B981",
  gemini: "#3B82F6",
};

export default function VerifyingScreen() {
  const router = useRouter();
  const { provider } = useLocalSearchParams<{ provider: Provider }>();
  const { setAuth } = useAuthStore();

  const providerKey = (provider ?? "claude") as Provider;
  const color = PROVIDER_COLORS[providerKey];

  useEffect(() => {
    // Brief delay to show success state before navigating
    const timer = setTimeout(() => {
      setAuth(providerKey);
      router.replace("/(tabs)");
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6">
      <View className="items-center gap-6">
        <View
          className="w-20 h-20 rounded-full items-center justify-center"
          style={{ backgroundColor: `${color}22` }}
        >
          <CheckCircle size={40} color={color} />
        </View>

        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-text-primary">
            Connected!
          </Text>
          <Text className="text-text-secondary text-center">
            Verifying your session and loading tools…
          </Text>
        </View>

        <ActivityIndicator color={color} />
      </View>
    </SafeAreaView>
  );
}
