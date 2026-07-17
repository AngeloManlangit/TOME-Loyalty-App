import { Tabs } from "expo-router";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import CustomHeader from "../components/header"

export default function RootLayout() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.header} barStyle={"light-content"} />

      <Tabs
        screenOptions={{
          header: (props) => <CustomHeader {...props} />,
          tabBarStyle: {
            height: 70,
            paddingBottom: 10,
          },
          animation: "shift"
        }}
      >
        <Tabs.Screen 
          name="index" 
          options={{ title: 'Home', tabBarActiveTintColor: '#D61967' }} 
        />
        <Tabs.Screen 
          name="collection" 
          options={{ title: 'Collection', tabBarActiveTintColor: '#44AD4E' }} 
        />
        <Tabs.Screen
          name="scanner"
          options={{
            headerShown: false,
            title: "Scanner", 
            tabBarIcon: () => null, 
          }}
        />

        <Tabs.Screen 
          name="map" 
          options={{ title: 'Map', tabBarActiveTintColor: '#24A8E0' }} 
        />
        <Tabs.Screen 
          name="others" 
          options={{ title: 'Others', tabBarActiveTintColor: '#FD7033' }} 
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