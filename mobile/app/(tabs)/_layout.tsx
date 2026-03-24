import { Tabs } from "expo-router";
import { Platform } from "react-native";
import {
  LayoutDashboard,
  BookOpen,
  FlaskConical,
  Database,
  Settings,
} from "lucide-react-native";

const TAB_BAR_STYLE = {
  backgroundColor: "#1A1A24",
  borderTopColor: "#2A2A3C",
  borderTopWidth: 1,
  paddingBottom: Platform.OS === "ios" ? 4 : 8,
  height: Platform.OS === "ios" ? 84 : 64,
};

const ACTIVE_COLOR = "#7C3AED";
const INACTIVE_COLOR = "#5A5A6E";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0F0F13" },
        headerTintColor: "#F0F0F5",
        headerShadowVisible: false,
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="papers"
        options={{
          title: "Papers",
          tabBarIcon: ({ color, size }) => (
            <BookOpen size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="science"
        options={{
          title: "Science",
          tabBarIcon: ({ color, size }) => (
            <FlaskConical size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sources"
        options={{
          title: "Sources",
          tabBarIcon: ({ color, size }) => (
            <Database size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
