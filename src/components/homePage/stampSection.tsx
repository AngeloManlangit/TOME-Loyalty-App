import { defaultStampCard } from "@/assets/classes/stamps";
import { Fonts } from "@src/constants/theme";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SmallCapsText } from "../custom/smallCapsText";
import StampCard from "../stamps/stampCard";

import { stampService } from "@src/services/stampService";
import { useStamps } from "@src/contexts/stampContext";

export default function StampSection() {
  // Reads the shared context rather than fetching its own copy. The old local useEffect fetched
  // once on mount, so a stamp earned by a scan never appeared until the app restarted.
  const { stamps, loading } = useStamps();

  const currentStamp = stamps.length > 0 ? stamps[0] : defaultStampCard;

  return (
    <View style={styles.container}>
        <SmallCapsText baseSize={24} style={styles.headerText}>Stamp Cards</SmallCapsText>

        {
          loading ? (
            <Text style={{justifyContent: 'center'}}>Loading...</Text>
          ) : (
            <View style={styles.cardContainer}>
              <StampCard cardDetails={currentStamp} />
      
              <Text style={styles.collectedCaption}>{`${currentStamp.stamp_count}/${currentStamp.stamp_total} Collected`}</Text>
            </View>
          )
        }

        <TouchableOpacity onPress={() => stampService.addNewStamp()}>
          <Text>Make new stamp</Text>
        </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
    gap: 5,
  },
  headerText: {
    fontFamily: Fonts.Montserrat,
    alignSelf: 'flex-start'
  },
  cardContainer: {
    width: '100%',
    alignItems: 'center'
  },
  collectedCaption: {
    marginVertical: 12,
    fontFamily: Fonts.Lato,
    fontSize: 14,
    letterSpacing: 1.2
  }
});