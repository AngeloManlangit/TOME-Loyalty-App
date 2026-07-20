import { View, Text, StyleSheet } from "react-native";
import { Fonts } from "../../constants/theme";
import { SmallCapsText } from "../customTexts/smallCapsText";
import StampCard from "../stamps/stampCard";
import { StampCardDetails } from "@/assets/classes/stamps";

const temp: StampCardDetails = {
  owner: 'John Outlets',
  stamp_ID: 1,
  stampCard_color: '#4cdf7d',
  stampCard_title: 'my card baby',
  stamp_number: 4,
  stamp_total: 10
};

export default function StampSection() {
  return (
    <View style={styles.container}>
        <SmallCapsText baseSize={24} style={styles.headerText}>Stamp Cards</SmallCapsText>

        <StampCard cardDetails={temp} />

        <Text style={styles.collectedCaption}>{`${temp.stamp_number}/${temp.stamp_total} Collected`}</Text>
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
  },
  collectedCaption: {
    marginVertical: 12,
    fontFamily: Fonts.Lato,
    fontSize: 14,
    letterSpacing: 1.2
  }
});