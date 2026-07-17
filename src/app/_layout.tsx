import { Tabs } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CustomHeader from "../components/header"

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CustomHeader />

      <Tabs screenOptions={{ animation: "shift", headerShown: false }}>
        <Tabs.Screen name="index" 
          options={{
            title: "Home"
          }}
        />
        <Tabs.Screen name="cool"
          options={{
            title: "Cool"
          }}
        />
      </Tabs>  
    </SafeAreaProvider>
  );
}