import { ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  BookOpen,
  FlaskConical,
  Globe,
  Database,
} from "lucide-react-native";
import { ToolCard } from "@/components/ui/ToolCard";
import { useAuthStore } from "@/lib/store";

const PROVIDER_COLORS = {
  claude: "#D97706",
  openai: "#10B981",
  gemini: "#3B82F6",
};

const TOOLS = [
  {
    id: "papers",
    title: "Search Papers",
    description:
      "Search academic papers across arXiv, Semantic Scholar, and bioRxiv",
    icon: BookOpen,
    color: "#7C3AED",
    route: "/(tabs)/papers" as const,
  },
  {
    id: "search_science",
    title: "Search Science",
    description: "Find science news and discoveries across fields",
    icon: FlaskConical,
    color: "#10B981",
    route: "/(tabs)/science" as const,
  },
  {
    id: "scrape_science",
    title: "Scrape Science",
    description: "Extract and index content from science sources",
    icon: Globe,
    color: "#3B82F6",
    route: "/(tabs)/science" as const,
  },
  {
    id: "sources",
    title: "Browse Sources",
    description: "Explore available science sources and knowledge base stats",
    icon: Database,
    color: "#D97706",
    route: "/(tabs)/sources" as const,
  },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { provider } = useAuthStore();
  const accentColor =
    provider ? PROVIDER_COLORS[provider] : PROVIDER_COLORS.claude;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {/* Provider badge */}
        <View className="flex-row items-center mb-6">
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: `${accentColor}22` }}
          >
            <Text
              className="text-xs font-semibold capitalize"
              style={{ color: accentColor }}
            >
              {provider ?? "Unknown"} connected
            </Text>
          </View>
        </View>

        <Text className="text-2xl font-bold text-text-primary mb-1">
          Research Tools
        </Text>
        <Text className="text-text-secondary text-sm mb-6">
          Select a tool to begin
        </Text>

        {TOOLS.map((tool) => (
          <ToolCard
            key={tool.id}
            title={tool.title}
            description={tool.description}
            icon={<tool.icon size={20} color={tool.color} />}
            accentColor={tool.color}
            onPress={() => router.push(tool.route)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
