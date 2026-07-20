import { View, StyleSheet, Text, Image, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Fonts, bgTransparency } from "../constants/theme";
import BrandsList from "../components/mapPage/brands";

export default function MapsScreen() {
  return (
    <View style={styles.container}>
        <LinearGradient
            colors={['#fff', `${Colors.outlets.blue}${bgTransparency}`]}
            style={styles.gradient}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Image style={styles.image} source={{uri: 'https://miro.medium.com/v2/resize:fit:1200/1*zCw9YQICYZzozYZsqeIiYA.png'}} />

            <Text style={styles.brandsTitle}>Available Brands</Text>

            <BrandsList />
          </ScrollView>
        </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 30,
    flexGrow: 1,
    alignItems: 'center'
  },
  image: {
    width: "100%",
    height: 400, // Give the image a concrete height or aspect ratio
  },
  brandsTitle: {
    fontSize: 28,
    fontFamily: Fonts.Montserrat,
    textTransform: 'uppercase',
    marginTop: 40,
  }
});
