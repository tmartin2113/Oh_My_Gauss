import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import { X } from "lucide-react-native";

export interface ToolExecutorSheetHandle {
  open: () => void;
  close: () => void;
}

interface ToolExecutorSheetProps {
  title: string;
  children: React.ReactNode; // form content
  results: unknown[] | null;
  renderResult: (item: unknown, index: number) => React.ReactNode;
  loading: boolean;
  error: string | null;
  onClose?: () => void;
}

const SNAP_POINTS = ["50%", "90%"];

export const ToolExecutorSheet = forwardRef<
  ToolExecutorSheetHandle,
  ToolExecutorSheetProps
>(function ToolExecutorSheet(
  { title, children, results, renderResult, loading, error, onClose },
  ref,
) {
  const sheetRef = useRef<BottomSheet>(null);

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.snapToIndex(0),
    close: () => sheetRef.current?.close(),
  }));

  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    onClose?.();
  }, [onClose]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      {/* Header */}
      <BottomSheetView style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={handleClose} hitSlop={12}>
          <X size={20} color="#9090A8" />
        </TouchableOpacity>
      </BottomSheetView>

      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Form */}
        <View style={styles.form}>{children}</View>

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color="#7C3AED" size="large" />
            <Text style={styles.statusText}>Running tool…</Text>
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Results */}
        {results && !loading && results.length === 0 && (
          <View style={styles.centered}>
            <Text style={styles.statusText}>No results found</Text>
          </View>
        )}
      </BottomSheetScrollView>

      {/* Results list (FlashList outside scroll for perf) */}
      {results && results.length > 0 && !loading && (
        <FlashList
          data={results}
          renderItem={({ item, index }) => (
            <>{renderResult(item, index)}</>
          )}
          estimatedItemSize={100}
          contentContainerStyle={styles.listContent}
          keyExtractor={(_, i) => String(i)}
        />
      )}
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  background: { backgroundColor: "#1A1A24" },
  handle: { backgroundColor: "#5A5A6E" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A3C",
  },
  title: { color: "#F0F0F5", fontSize: 16, fontWeight: "600" },
  content: { padding: 16 },
  form: { marginBottom: 16 },
  centered: { alignItems: "center", paddingVertical: 24, gap: 8 },
  statusText: { color: "#9090A8", fontSize: 14 },
  errorBox: {
    backgroundColor: "#EF444420",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  errorText: { color: "#EF4444", fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
});
