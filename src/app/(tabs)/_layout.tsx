import { Tabs, withLayoutContext } from "expo-router";
import { EllipsisIcon, HouseIcon, MapIcon, ShapesIcon } from "lucide-react-native";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomHeader from "../../components/header";
import { Colors } from "../../constants/theme";

import { NoRippleTabBarButton } from "../../components/custom/noRippleButton";
import ScannerButton from "../../components/scannerPage/scannerButton";
import { LinearGradient } from "expo-linear-gradient";

export default function RootLayout() {

  return (
    <LinearGradient
      colors={[Colors.outlets.purple, '#fff']}
      style={{flex: 1}}
      locations={[0.3, 0.6]}
    >
      <SafeAreaView style={styles.container}>
        
        <StatusBar backgroundColor={Colors.outlets.purple} barStyle={"light-content"} />

        <CustomHeader />

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
                <NoRippleTabBarButton {...props} />
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