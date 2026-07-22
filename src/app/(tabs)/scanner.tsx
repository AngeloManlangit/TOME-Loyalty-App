import { Image, View, StyleSheet, Text, ScrollView, StatusBar } from "react-native";
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { SlideInRight } from 'react-native-reanimated';

export default function HomeScreen() {
  // entry animations
  const [animationKey, setAnimationKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimationKey((prev) => prev + 1);
    }, [])
  );

  return (
    <View style={styles.container}>
        <Image style={styles.mainView} source={{ uri: "https://media.tenor.com/bDmyKRMnKMcAAAAM/like-cat.gif" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fdff6f",
    flex: 1,
  },
  mainView: {
    flex: 1,
  }
});
