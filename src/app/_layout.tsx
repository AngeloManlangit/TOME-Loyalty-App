import { Tabs } from "expo-router";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import CustomHeader from "../components/header"
import { EllipsisIcon, HouseIcon, MapIcon, ShapesIcon } from "lucide-react-native";

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
          options={{ 
            title: 'Home', 
            tabBarActiveTintColor: '#D61967',
            tabBarIcon: ({color, size}) => (
              <HouseIcon color={color} size={size} />
            )
          }} 
        />
        <Tabs.Screen 
          name="collection" 
          options={{ 
            title: 'Collection', 
            tabBarActiveTintColor: '#44AD4E',
            tabBarIcon: ({color, size}) => (
              <ShapesIcon color={color} size={size} />
            )
          }} 
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
          options={{ 
            title: 'Map', 
            tabBarActiveTintColor: '#24A8E0',
            tabBarIcon: ({color, size}) => (
              <MapIcon color={color} size={size} />
            )
          }}
        />
        <Tabs.Screen 
          name="others" 
          options={{ 
            title: 'Others', 
            tabBarActiveTintColor: '#FD7033',
            tabBarIcon: ({color, size}) => (
              <EllipsisIcon color={color} size={size} />
            )
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