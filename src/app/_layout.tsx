import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View, StyleSheet } from "react-native";

import { Lato_400Regular, Lato_700Bold, useFonts } from '@expo-google-fonts/lato';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';

import { onAuthStateChanged } from "@firebase/auth";
import { auth } from '@/firebase/firebaseConfig'

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Lato_400Regular,
    Lato_700Bold,
    Montserrat_600SemiBold
  });

  // tracks Firebase auth initialization
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [hideSplash, setHideSplash] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("USER IS STILL LOGGED IN: ", user?.uid);
        router.replace('/home');
      }
      // Mark auth as ready once we get the initial user state
      setIsAuthReady(true);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Only hide the splash screen when BOTH fonts and auth are ready
    if ((loaded || error) && isAuthReady) {
      // Hide the native splash screen to reveal your custom Image component
      SplashScreen.hideAsync();

      // Continue with your custom 1.5s delay before showing the main app
      const timer = setTimeout(() => {
        setHideSplash(true);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [loaded, error, isAuthReady]);

  if (!loaded && !error) {
    return null;
  }

  return (
      <View style={styles.container}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="createAcc" />
        </Stack>

        {!hideSplash && (
          <View style={styles.splashOverlay}>
            <Image
              source={require('@/assets/images/TOME Splash Screen.png')}
              style={styles.splashImage}
            />
          </View>
        )}
      </View>
    );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center",
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999
  },
  splashImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  }
});