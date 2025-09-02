import "react-native-gesture-handler";
import "react-native-reanimated";

import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import useAuthListener from "./hooks/useAuthListener";
import AppNavigator from "./navigation/AppNavigator";
import AuthNavigator from "./navigation/AuthNavigator";

// Light romantic theme that matches tokens (no logic change)
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#F8F9FB",
    card: "#FFFFFF",
    text: "#12131A",
    border: "#ECECF1",
    primary: "#FF2E74",
  },
};

export default function App() {
  const { user } = useAuthListener();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
