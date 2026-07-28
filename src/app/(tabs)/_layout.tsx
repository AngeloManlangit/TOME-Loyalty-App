import { Tabs, useSegments } from "expo-router";
import { EllipsisIcon, HouseIcon, MapIcon, ShapesIcon } from "lucide-react-native";
import { StatusBar, StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from 'expo-constants'
import CustomHeader from "@src/components/header";
import { Colors } from "@src/constants/theme";

import { ShutterTabBarButton } from "@src/components/custom/noRippleButton";
import ScannerButton from "@src/components/scannerPage/scannerButton";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from "react";

import { UserProvider } from "@src/contexts/userContext";
import { StampProvider } from "@src/contexts/stampContext";
import { ScannerUiProvider, useScannerUi } from "@src/features/receipts/scannerUiContext";

export default function RootLayout() {
  // Providers wrap the tabs so the FAB — which lives in the tab bar, above the scanner screen —
  // can reach the camera, and so the header can read the stamp balance.
  return (
    <UserProvider>
      <StampProvider>
        <ScannerUiProvider>
          <TabsLayout />
        </ScannerUiProvider>
      </StampProvider>
    </UserProvider>
  );
}

function TabsLayout() {

  // so that the notif bar is ourple
  const statusBarHeight = Constants.statusBarHeight;
  const { height } =  useWindowDimensions();

  const statusBarHeightPercentage = statusBarHeight / height;

  const segments = useSegments();
  const title = segments[1] ?? '';
  const hideHeader = title === "scanner" || title === "others";
  const onScanner = title === "scanner";

  const { fireShutter } = useScannerUi();

  // shared value for the top spacing (125 is the approximate height of your header)
  const headerSpace = useSharedValue(hideHeader ? 0 : 125);

  useEffect(() => {
    headerSpace.value = withTiming(hideHeader ? 0 : 120, {duration: 300});
  }, [hideHeader]);

  // animated style that only applies to the top of the container so that whenever the header disappears, it adjusts properly
  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      paddingTop: headerSpace.value,
    };
  });

  return (
      <LinearGradient
        colors={[Colors.outlets.purple, '#fff']}
        style={{flex: 1}}
        locations={[statusBarHeightPercentage, statusBarHeightPercentage]}
      >
        <SafeAreaView style={styles.container}>

          <StatusBar backgroundColor={Colors.outlets.purple} barStyle={"light-content"} />

          <CustomHeader />

          <Animated.View style={[{ flex: 1 }, animatedContainerStyle]}>

            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarStyle: {
                  position: 'absolute',
                  height: 62,
                  paddingBottom: 10
                },
                animation: "shift",
              }}
              >
              <Tabs.Screen
                name="home"
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
                  ),
                  tabBarItemStyle: { paddingRight: 10 }
                }}
              />
              <Tabs.Screen
                name="scanner"
                options={{
                  headerShown: false,
                  title: "",
                  tabBarButton: (props) => (
                    <ShutterTabBarButton
                      {...props}
                      accessibilityLabel={onScanner ? "Take photo of receipt" : "Open receipt scanner"}
                      // Already on the scanner: the FAB IS the shutter, so pressing must capture
                      // rather than re-navigate to the screen the user is looking at.
                      onPress={onScanner ? fireShutter : props.onPress}
                    />
                  ),
                  tabBarIcon: () => (
                    <ScannerButton />
                  )
                }}
              />

              <Tabs.Screen
                name="map"
                options={{
                  title: 'Map',
                  tabBarActiveTintColor: Colors.outlets.blue,
                  tabBarIcon: ({color, size}) => (
                    <MapIcon color={color} size={size} />
                  ),
                  tabBarItemStyle: { paddingLeft: 10 }
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

          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center"
  }
});
