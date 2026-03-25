import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";
import { Search, ExternalLink } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { callTool } from "@/lib/api";

type Source = "all" | "arxiv" | "semantic_scholar" | "biorxiv";

interface Paper {
  title?: string;
  authors?: string[];
  abstract?: string;
  score?: number;
  url?: string;
  year?: number;
  source?: string;
}

interface ToolResult {
  content?: Array<{ text?: string }>;
}

const SOURCES: { id: Source; label: string }[] = [
  { id: "all", label: "All" },
  { id: "arxiv", label: "arXiv" },
  { id: "semantic_scholar", label: "Semantic Scholar" },
  { id: "biorxiv", label: "bioRxiv" },
];

function parsePapers(result: unknown): Paper[] {
  try {
    const r = result as ToolResult;
    const text = r?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed?.papers ?? [];
  } catch (err) {
    if (__DEV__) console.warn("[papers] parsePapers failed:", err);
    return [];
  }
}

export default function PapersScreen() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source>("all");
  const [maxResults, setMaxResults] = useState("10");
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setError(null);
    setLoading(true);
    setPapers(null);

    try {
      const result = await callTool("search_papers", {
        query: query.trim(),
        source,
        max_results: Math.min(50, Math.max(1, parseInt(maxResults) || 10)),
      });
      setPapers(parsePapers(result));
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Search failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      {/* Search form */}
      <View className="px-4 pt-4 pb-3 border-b border-border">
        {/* Query input */}
        <View className="flex-row items-center rounded-md border border-border bg-surface px-3 mb-3">
          <Search size={16} color="#5A5A6E" />
          <TextInput
            className="flex-1 py-3 pl-2 text-text-primary text-base"
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. quantum entanglement"
            placeholderTextColor="#5A5A6E"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
          />
        </View>

        {/* Source filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
        >
          <View className="flex-row gap-2">
            {SOURCES.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSource(s.id)}
                className={[
                  "px-3 py-1.5 rounded-full border",
                  source === s.id
                    ? "bg-primary border-primary"
                    : "bg-surface border-border",
                ].join(" ")}
              >
                <Text
                  className={[
                    "text-sm font-medium",
                    source === s.id ? "text-white" : "text-text-secondary",
                  ].join(" ")}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Max results + search button */}
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-text-muted text-sm">Max:</Text>
            <TextInput
              className="bg-surface border border-border rounded-sm px-2 py-1 text-text-primary text-sm w-12 text-center"
              value={maxResults}
              onChangeText={setMaxResults}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <TouchableOpacity
            onPress={handleSearch}
            disabled={loading || !query.trim()}
            className={[
              "flex-1 py-2.5 rounded-md items-center",
              loading || !query.trim() ? "bg-primary/50" : "bg-primary",
            ].join(" ")}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-semibold text-sm">Search</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      {error && (
        <View className="mx-4 mt-4 p-3 bg-error/10 rounded-md">
          <Text className="text-error text-sm">{error}</Text>
        </View>
      )}

      {papers !== null && (
        <FlashList
          data={papers}
          estimatedItemSize={160}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-text-muted">No papers found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-surface rounded-md p-4 mb-3 border border-border">
              <View className="flex-row items-start justify-between gap-2 mb-2">
                <Text
                  className="text-text-primary font-semibold text-sm leading-5 flex-1"
                  numberOfLines={3}
                >
                  {item.title ?? "Untitled"}
                </Text>
                {item.score != null && (
                  <View className="bg-primary/20 px-2 py-0.5 rounded-full">
                    <Text className="text-primary text-xs font-medium">
                      {(item.score * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
              </View>

              {item.authors && item.authors.length > 0 && (
                <Text className="text-text-muted text-xs mb-2">
                  {item.authors.slice(0, 3).join(", ")}
                  {item.authors.length > 3 ? " et al." : ""}
                  {item.year ? ` · ${item.year}` : ""}
                </Text>
              )}

              {item.source && (
                <View className="flex-row items-center gap-1 mb-2">
                  <ExternalLink size={10} color="#5A5A6E" />
                  <Text className="text-text-muted text-xs capitalize">
                    {item.source.replace("_", " ")}
                  </Text>
                </View>
              )}

              {item.abstract && (
                <Text
                  className="text-text-secondary text-xs leading-5"
                  numberOfLines={4}
                >
                  {item.abstract}
                </Text>
              )}
            </View>
          )}
        />
      )}

      {!papers && !loading && !error && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-text-muted text-sm">
            Search for academic papers above
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
