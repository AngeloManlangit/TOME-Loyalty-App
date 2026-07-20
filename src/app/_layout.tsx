import { useEffect } from "react";
import { Tabs } from "expo-router";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../constants/theme";
import CustomHeader from "../components/header"
import { EllipsisIcon, HouseIcon, MapIcon, ShapesIcon } from "lucide-react-native";

import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat'

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Montserrat_600SemiBold
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.outlets.purple} barStyle={"light-content"} />

      <Tabs
        screenOptions={{
          header: (props) => <CustomHeader {...props} />,
          tabBarStyle: {
            position: 'absolute',
            height: 62,
            paddingBottom: 10
          },
          animation: "shift"
        }}
      >
        <Tabs.Screen 
          name="index" 
          options={{ 
            title: 'Home', 
            tabBarActiveTintColor: Colors.outlets.pink,
            tabBarIcon: ({color, size}) => (
              <HouseIcon color={color} size={size} />
            )
          }} 
        />
        <Tabs.Screen 
          name="collection" 
          options={{ 
            title: 'Collection', 
            tabBarActiveTintColor: Colors.outlets.green,
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
            tabBarActiveTintColor: Colors.outlets.blue,
            tabBarIcon: ({color, size}) => (
              <MapIcon color={color} size={size} />
            )
          }}
        />
        <Tabs.Screen 
          name="others" 
          options={{ 
            title: 'Others', 
            tabBarActiveTintColor: Colors.outlets.orange,
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
    backgroundColor: Colors.outlets.purple,
    flex: 1,
    justifyContent: "center"
  }
});