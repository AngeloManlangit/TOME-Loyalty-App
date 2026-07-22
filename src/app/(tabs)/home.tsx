import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from "react-native";
import StampSection from "../../components/homePage/stampSection";
import { bgTransparency, Colors } from "../../constants/theme";
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
      <Animated.View 
        key={animationKey} 
        entering={SlideInRight.duration(300)}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['#fff', `${Colors.outlets.pink}${bgTransparency}`]}
          style={styles.mainView}
        >
          <StampSection />
          
        </LinearGradient>
      </Animated.View>
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
    paddingVertical: 30,
    paddingHorizontal: 20
  }
});
