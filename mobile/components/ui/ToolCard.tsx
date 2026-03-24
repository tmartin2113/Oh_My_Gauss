import { View, Text, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor?: string;
  onPress: () => void;
}

export function ToolCard({
  title,
  description,
  icon,
  accentColor = "#7C3AED",
  onPress,
}: ToolCardProps) {
  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      className="bg-surface rounded-md p-4 mb-3 border border-border"
    >
      <View className="flex-row items-start gap-3">
        <View
          className="w-10 h-10 rounded-sm items-center justify-center"
          style={{ backgroundColor: `${accentColor}22` }}
        >
          {icon}
        </View>

        <View className="flex-1">
          <Text className="text-text-primary font-semibold text-base mb-1">
            {title}
          </Text>
          <Text className="text-text-secondary text-sm leading-5">
            {description}
          </Text>
        </View>

        <View
          className="w-1.5 h-1.5 rounded-full mt-1.5"
          style={{ backgroundColor: accentColor }}
        />
      </View>
    </TouchableOpacity>
  );
}
