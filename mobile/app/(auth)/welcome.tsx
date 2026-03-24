import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

type Provider = "claude" | "openai" | "gemini";

const PROVIDERS: {
  id: Provider;
  label: string;
  description: string;
  color: string;
  borderColor: string;
}[] = [
  {
    id: "claude",
    label: "Claude",
    description: "Anthropic's Claude — reasoning & analysis",
    color: "#D97706",
    borderColor: "border-accent-claude",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT models — versatile & fast",
    color: "#10B981",
    borderColor: "border-accent-openai",
  },
  {
    id: "gemini",
    label: "Gemini",
    description: "Google's Gemini — multimodal",
    color: "#3B82F6",
    borderColor: "border-accent-gemini",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Provider>("claude");

  const handleSelect = (id: Provider) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelected(id);
  };

  const handleContinue = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({ pathname: "/(auth)/connect", params: { provider: selected } });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-12 pb-8">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-3xl font-bold text-text-primary mb-2">
              Oh My Gauss
            </Text>
            <Text className="text-text-secondary text-base leading-6">
              AI-powered research assistant. Choose your AI provider to get
              started.
            </Text>
          </View>

          {/* Provider picker */}
          <Text className="text-text-secondary text-sm font-medium uppercase tracking-widest mb-4">
            Select Provider
          </Text>

          <View className="gap-3">
            {PROVIDERS.map((p) => {
              const isSelected = selected === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleSelect(p.id)}
                  activeOpacity={0.7}
                  className={[
                    "rounded-md p-4 border-2",
                    isSelected ? "bg-surface-2" : "bg-surface",
                    isSelected ? p.borderColor : "border-border",
                  ].join(" ")}
                >
                  <View className="flex-row items-center gap-3">
                    {/* Radio indicator */}
                    <View
                      className="w-5 h-5 rounded-full border-2 items-center justify-center"
                      style={{
                        borderColor: isSelected ? p.color : "#2A2A3C",
                      }}
                    >
                      {isSelected && (
                        <View
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                      )}
                    </View>

                    <View className="flex-1">
                      <Text
                        className="font-semibold text-base"
                        style={{ color: isSelected ? p.color : "#F0F0F5" }}
                      >
                        {p.label}
                      </Text>
                      <Text className="text-text-muted text-sm mt-0.5">
                        {p.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="flex-1" />

          {/* Continue button */}
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.8}
            className="bg-primary rounded-full py-4 items-center mt-8"
          >
            <Text className="text-white font-semibold text-base">
              Continue with{" "}
              {PROVIDERS.find((p) => p.id === selected)?.label}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
