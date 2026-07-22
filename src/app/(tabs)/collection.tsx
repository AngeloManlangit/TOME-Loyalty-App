import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { Colors, bgTransparency } from "../../constants/theme";
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { SlideInRight } from 'react-native-reanimated';

export default function CollectionScreen() {
  // entry animations
  const [animationKey, setAnimationKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimationKey((prev) => prev + 1);
    }, [])
  );

  return (
    <View style={styles.container}>
        <LinearGradient
            colors={['#fff', `${Colors.outlets.green}${bgTransparency}`]}
            style={styles.mainView}
        >
            <Text>Colletion</Text>
        </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  mainView: {
    flex: 1,
  }
});
