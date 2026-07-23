import { View, Text, StyleSheet } from "react-native";
import { Fonts } from "../../constants/theme";
import { SmallCapsText } from "../custom/smallCapsText"
import StampCard from "../stamps/stampCard";
import { StampCardDetails, defaultStampCard } from "@/assets/classes/stamps";

import { stampService } from "../../services/stampService";
import { useEffect, useState } from "react";

export default function StampSection() {
  const [stamps, setStamps] = useState<StampCardDetails[]>([]);
  const [loading, setLoading] = useState(true);
  
  const currentStamp = stamps.length > 0 ? stamps[0] : defaultStampCard;
  
  useEffect(() => {
    const loadStamps = async () => {
      setLoading(true);
      const userStamps = await stampService.fetchStamps();
      if (userStamps) {
        // console.log(userStamps) // debug purposes
        setStamps(userStamps);
      }

      setLoading(false);
    };

    loadStamps();
  }, []);

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