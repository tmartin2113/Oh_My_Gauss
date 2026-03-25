import { useState } from "react";
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
import { Search, Globe } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { callTool } from "@/lib/api";

type Field =
  | "nanotechnology"
  | "physics"
  | "earth"
  | "astronomy_space"
  | "chemistry"
  | "biology"
  | "materials_science";

type Mode = "search" | "scrape";

const FIELDS: { id: Field; label: string }[] = [
  { id: "physics", label: "Physics" },
  { id: "biology", label: "Biology" },
  { id: "chemistry", label: "Chemistry" },
  { id: "astronomy_space", label: "Astronomy" },
  { id: "nanotechnology", label: "Nano" },
  { id: "earth", label: "Earth" },
  { id: "materials_science", label: "Materials" },
];

interface ScienceResult {
  title?: string;
  summary?: string;
  url?: string;
  source?: string;
  field?: string;
  date?: string;
  pages_scraped?: number;
  items_found?: number;
}

interface ToolResult {
  content?: Array<{ text?: string }>;
}

function parseResults(result: unknown): ScienceResult[] {
  try {
    const r = result as ToolResult;
    const text = r?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed?.results ?? [parsed];
  } catch (err) {
    if (__DEV__) console.warn("[science] parseResults failed:", err);
    return [];
  }
}

export default function ScienceScreen() {
  const [mode, setMode] = useState<Mode>("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [field, setField] = useState<Field | undefined>(undefined);
  const [numResults, setNumResults] = useState("5");

  // Scrape state
  const [sourceName, setSourceName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [maxPages, setMaxPages] = useState("10");

  const [results, setResults] = useState<ScienceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setError(null);
    setLoading(true);
    setResults(null);

    try {
      let result: unknown;
      if (mode === "search") {
        if (!searchQuery.trim()) {
          setError("Query is required");
          setLoading(false);
          return;
        }
        result = await callTool("search_science", {
          question: searchQuery.trim(),
          field: field ?? undefined,
          num_results: Math.min(20, Math.max(1, parseInt(numResults) || 5)),
        });
      } else {
        if (!sourceName.trim() && !customUrl.trim()) {
          setError("Either source name or custom URL is required");
          setLoading(false);
          return;
        }
        result = await callTool("scrape_science", {
          source_name: sourceName.trim() || undefined,
          custom_url: customUrl.trim() || undefined,
          max_pages: Math.min(50, Math.max(1, parseInt(maxPages) || 10)),
        });
      }
      setResults(parseResults(result));
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Tool execution failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["bottom"]}>
      {/* Mode toggle */}
      <View className="flex-row mx-4 mt-4 bg-surface rounded-md p-1 mb-4 border border-border">
        {(["search", "scrape"] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => {
              setMode(m);
              setResults(null);
              setError(null);
            }}
            className={[
              "flex-1 py-2 rounded-sm items-center",
              mode === m ? "bg-primary" : "",
            ].join(" ")}
          >
            <Text
              className={[
                "text-sm font-medium capitalize",
                mode === m ? "text-white" : "text-text-secondary",
              ].join(" ")}
            >
              {m === "search" ? "Search Science" : "Scrape Source"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="flex-1">
        <View className="px-4">
          {mode === "search" ? (
            <View className="gap-3">
              {/* Query */}
              <View className="flex-row items-center rounded-md border border-border bg-surface px-3">
                <Search size={16} color="#5A5A6E" />
                <TextInput
                  className="flex-1 py-3 pl-2 text-text-primary text-base"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="e.g. black hole imaging techniques"
                  placeholderTextColor="#5A5A6E"
                  returnKeyType="search"
                  onSubmitEditing={handleRun}
                  autoCapitalize="none"
                />
              </View>

              {/* Field filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setField(undefined)}
                    className={[
                      "px-3 py-1.5 rounded-full border",
                      field === undefined
                        ? "bg-primary border-primary"
                        : "bg-surface border-border",
                    ].join(" ")}
                  >
                    <Text
                      className={[
                        "text-sm font-medium",
                        field === undefined
                          ? "text-white"
                          : "text-text-secondary",
                      ].join(" ")}
                    >
                      All Fields
                    </Text>
                  </TouchableOpacity>
                  {FIELDS.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setField(f.id)}
                      className={[
                        "px-3 py-1.5 rounded-full border",
                        field === f.id
                          ? "bg-primary border-primary"
                          : "bg-surface border-border",
                      ].join(" ")}
                    >
                      <Text
                        className={[
                          "text-sm font-medium",
                          field === f.id ? "text-white" : "text-text-secondary",
                        ].join(" ")}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Num results */}
              <View className="flex-row items-center gap-3">
                <Text className="text-text-muted text-sm">Results:</Text>
                <TextInput
                  className="bg-surface border border-border rounded-sm px-2 py-1 text-text-primary text-sm w-12 text-center"
                  value={numResults}
                  onChangeText={setNumResults}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
          ) : (
            <View className="gap-3">
              {/* Source name */}
              <View>
                <Text className="text-text-muted text-sm mb-1">
                  Source Name
                </Text>
                <View className="flex-row items-center rounded-md border border-border bg-surface px-3">
                  <Globe size={16} color="#5A5A6E" />
                  <TextInput
                    className="flex-1 py-3 pl-2 text-text-primary text-base"
                    value={sourceName}
                    onChangeText={setSourceName}
                    placeholder="e.g. nasa, nature, arxiv"
                    placeholderTextColor="#5A5A6E"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Custom URL */}
              <View>
                <Text className="text-text-muted text-sm mb-1">
                  — or Custom URL
                </Text>
                <TextInput
                  className="rounded-md border border-border bg-surface px-3 py-3 text-text-primary text-base"
                  value={customUrl}
                  onChangeText={setCustomUrl}
                  placeholder="https://example.com/science"
                  placeholderTextColor="#5A5A6E"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>

              {/* Max pages */}
              <View className="flex-row items-center gap-3">
                <Text className="text-text-muted text-sm">Max pages:</Text>
                <TextInput
                  className="bg-surface border border-border rounded-sm px-2 py-1 text-text-primary text-sm w-12 text-center"
                  value={maxPages}
                  onChangeText={setMaxPages}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
          )}

          {/* Run button */}
          <TouchableOpacity
            onPress={handleRun}
            disabled={loading}
            className={[
              "py-3 rounded-md items-center mt-4",
              loading ? "bg-primary/50" : "bg-primary",
            ].join(" ")}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-semibold text-sm">
                {mode === "search" ? "Search" : "Scrape"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Error */}
          {error && (
            <View className="mt-3 p-3 bg-error/10 rounded-md">
              <Text className="text-error text-sm">{error}</Text>
            </View>
          )}

          {/* Results */}
          {results !== null && !loading && (
            <View className="mt-4">
              <Text className="text-text-secondary text-sm mb-3">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </Text>
              {results.length === 0 ? (
                <Text className="text-text-muted text-center py-8">
                  No results found
                </Text>
              ) : (
                results.map((item, i) => (
                  <View
                    key={i}
                    className="bg-surface rounded-md p-4 mb-3 border border-border"
                  >
                    <Text className="text-text-primary font-semibold text-sm leading-5 mb-1">
                      {item.title ?? `Result ${i + 1}`}
                    </Text>
                    {item.field && (
                      <View className="bg-primary/10 px-2 py-0.5 rounded-full self-start mb-2">
                        <Text className="text-primary text-xs capitalize">
                          {item.field}
                        </Text>
                      </View>
                    )}
                    {item.summary && (
                      <Text
                        className="text-text-secondary text-xs leading-5"
                        numberOfLines={5}
                      >
                        {item.summary}
                      </Text>
                    )}
                    {item.pages_scraped != null && (
                      <Text className="text-text-muted text-xs mt-2">
                        {item.pages_scraped} pages · {item.items_found ?? 0}{" "}
                        items
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          <View className="h-8" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
