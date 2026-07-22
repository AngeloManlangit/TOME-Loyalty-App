import { router, Tabs, withLayoutContext } from "expo-router";
import { EllipsisIcon, HouseIcon, MapIcon, ShapesIcon } from "lucide-react-native";
import { Pressable, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomHeader from "../../components/header";
import { Colors } from "../../constants/theme";

import { NoRippleTabBarButton } from "../../components/custom/noRippleButton";
import ScannerButton from "../../components/scannerPage/scannerButton";

import { createMaterialTopTabNavigator } from 'expo-router/js-top-tabs';
const { Navigator } = createMaterialTopTabNavigator();
export const SlidingTabs = withLayoutContext(Navigator);

export default function RootLayout() {
  interface iconParameters {
    color: string;
    size: number;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.outlets.purple} barStyle={"light-content"} />

      <CustomHeader />

      <SlidingTabs
        tabBarPosition="bottom"
        screenOptions={{
          animationEnabled: true,
          swipeEnabled: true,
          tabBarIndicatorStyle: {
            backgroundColor: Colors.outlets.purple,
          },
          tabBarLabelStyle: { fontSize: 8 },
          tabBarInactiveTintColor: '#0000005b'
        }}
      >
        <SlidingTabs.Screen 
          name="home" 
          options={{ 
            title: 'Home', 
            tabBarActiveTintColor: Colors.outlets.pink,
            tabBarIcon: ({color, size}: iconParameters) => (
              <HouseIcon color={color} size={size} />
            )
          }} 
        />
        <SlidingTabs.Screen 
          name="collection" 
          options={{ 
            title: 'Collection', 
            tabBarActiveTintColor: Colors.outlets.green,
            tabBarIcon: ({color, size}: iconParameters) => (
              <ShapesIcon color={color} size={size} />
            )
          }} 
        />
        <SlidingTabs.Screen
          name="scanner"
          options={{
            headerShown: false,
            title: "", 
            tabBarButton: (props: any) => (
              <NoRippleTabBarButton {...props} />
            ),
            tabBarIcon: () => (
              <View style={{ width: 60 }} />
            )
          }}
        />

        <SlidingTabs.Screen 
          name="map" 
          options={{ 
            title: 'Map', 
            tabBarActiveTintColor: Colors.outlets.blue,
            tabBarIcon: ({color, size}: iconParameters) => (
              <MapIcon color={color} size={size} />
            )
          }}
        />
        <SlidingTabs.Screen 
          name="others" 
          options={{ 
            title: 'Others', 
            tabBarActiveTintColor: Colors.outlets.orange,
            tabBarIcon: ({color, size}: iconParameters) => (
              <EllipsisIcon color={color} size={size} />
            )
          }} 
        />
      </SlidingTabs>

      <View
        pointerEvents="box-none" // Ensures this transparent container doesn't block touches to the tabs behind it
        style={{

          bottom: 5000, // Adjust this upward to match the overlap height you want
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 9999, // Forces it above the tab bar on iOS
          elevation: 10, // Forces it above the tab bar on Android
        }}
      >
        <Pressable onPress={() => router.push('/scanner')}>
          <ScannerButton />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.outlets.purple,
    flex: 1,
  }
});