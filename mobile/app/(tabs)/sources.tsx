import { useEffect, useState } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Database, RefreshCw } from "lucide-react-native";
import { callTool } from "@/lib/api";

interface Source {
  name?: string;
  url?: string;
  field?: string;
  description?: string;
  last_scraped?: string;
  pages_indexed?: number;
}

interface Section {
  title: string;
  data: Source[];
}

interface ToolResult {
  content?: Array<{ text?: string }>;
}

function parseSources(result: unknown): Source[] {
  try {
    const r = result as ToolResult;
    const text = r?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed
      : parsed?.sources ?? parsed?.data ?? [];
  } catch {
    return [];
  }
}

function groupByField(sources: Source[]): Section[] {
  const map = new Map<string, Source[]>();
  sources.forEach((s) => {
    const field = s.field ?? "Other";
    if (!map.has(field)) map.set(field, []);
    map.get(field)!.push(s);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

export default function SourcesScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [totalSources, setTotalSources] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await callTool("list_sources", {});
      const sources = parseSources(result);
      const grouped = groupByField(sources);
      setSections(grouped);
      setTotalSources(sources.length);
      setTotalPages(
        sources.reduce((sum, s) => sum + (s.pages_indexed ?? 0), 0),
      );
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to load sources",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center" edges={["bottom"]}>
        <ActivityIndicator color="#7C3AED" size="large" />
        <Text className="text-text-muted text-sm mt-3">Loading sources…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      <SectionList
        sections={sections}
        keyExtractor={(item, i) => `${item.name ?? i}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#7C3AED"
          />
        }
        ListHeaderComponent={
          <View>
            {/* KB Stats header */}
            <View className="mx-4 mt-4 mb-4 bg-surface rounded-md p-4 border border-border">
              <Text className="text-text-secondary text-xs font-medium uppercase tracking-widest mb-3">
                Knowledge Base
              </Text>
              <View className="flex-row gap-4">
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-primary">
                    {totalSources}
                  </Text>
                  <Text className="text-text-muted text-xs mt-1">Sources</Text>
                </View>
                <View className="w-px bg-border" />
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-primary">
                    {sections.length}
                  </Text>
                  <Text className="text-text-muted text-xs mt-1">Fields</Text>
                </View>
                <View className="w-px bg-border" />
                <View className="flex-1 items-center">
                  <Text className="text-2xl font-bold text-primary">
                    {totalPages.toLocaleString()}
                  </Text>
                  <Text className="text-text-muted text-xs mt-1">Pages</Text>
                </View>
              </View>
            </View>

            {error && (
              <View className="mx-4 mb-4 p-3 bg-error/10 rounded-md">
                <Text className="text-error text-sm">{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-12 px-4">
            <Database size={40} color="#2A2A3C" />
            <Text className="text-text-muted text-sm mt-4 text-center">
              No sources available.{"\n"}Scrape a source to populate the KB.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="px-4 py-2 bg-bg">
            <Text className="text-text-muted text-xs font-semibold uppercase tracking-widest capitalize">
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View className="mx-4 mb-2 bg-surface rounded-md p-3 border border-border">
            <View className="flex-row items-start justify-between">
              <Text className="text-text-primary font-medium text-sm flex-1">
                {item.name ?? "Unknown"}
              </Text>
              {item.pages_indexed != null && (
                <Text className="text-text-muted text-xs">
                  {item.pages_indexed} pages
                </Text>
              )}
            </View>
            {item.description && (
              <Text
                className="text-text-secondary text-xs mt-1 leading-4"
                numberOfLines={2}
              >
                {item.description}
              </Text>
            )}
            {item.last_scraped && (
              <Text className="text-text-muted text-xs mt-1">
                Last scraped:{" "}
                {new Date(item.last_scraped).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
