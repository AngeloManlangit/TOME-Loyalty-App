import { View, Text, StyleSheet } from "react-native";
import { Fonts } from "../../constants/theme";
import { SmallCapsText } from "../customTexts/smallCapsText";
import StampCard from "../stamps/stampCard";


export default function StampSection() {
  return (
    <View style={styles.container}>
        <SmallCapsText baseSize={24} style={styles.headerText}>Stamp Cards</SmallCapsText>

    </View>    
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    gap: 5
  },
  headerText: {
    fontFamily: Fonts.Montserrat,
    alignSelf: 'flex-start'
  }
});