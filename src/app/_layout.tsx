import { Tabs } from "expo-router";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import CustomHeader from "../components/header"

export default function RootLayout() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.header} barStyle={"light-content"} />

      <CustomHeader />

      <Tabs screenOptions={{ animation: "shift", headerShown: false }}>
        <Tabs.Screen name="index" 
          options={{
            title: "Home"
          }}
        />
        <Tabs.Screen name="collection"
          options={{
            title: "Collection"
          }}
        />
        <Tabs.Screen name="map"
          options={{
            title: "Map"
          }}
        />
        <Tabs.Screen name="others"
          options={{
            title: "Others"
          }}
        />
      </Tabs>  
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.header,
    flex: 1,
    justifyContent: "center"
  }
});