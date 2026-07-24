import { StampCardDetails, defaultStampCard } from "@/assets/classes/stamps";
import { Fonts } from "@src/constants/theme";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SmallCapsText } from "../custom/smallCapsText";
import StampCard from "../stamps/stampCard";

import { stampService } from "@src/services/stampService";
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

        <TouchableOpacity onPress={() => stampService.addNewDefaultStamp()}>
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