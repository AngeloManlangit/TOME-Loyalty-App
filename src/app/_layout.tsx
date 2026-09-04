import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";

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
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 1500);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center"
  }
});