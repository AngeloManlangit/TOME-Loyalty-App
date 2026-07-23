import { View, Text, StyleSheet } from "react-native";
import { Fonts } from "../../constants/theme";
import { SmallCapsText } from "../custom/smallCapsText"
import StampCard from "../stamps/stampCard";
import { StampCardDetails } from "@/assets/classes/stamps";

const temp: StampCardDetails = {
  owner_ID: 'John Outlets',
  stamp_ID: 1,
  stampCard_configs: {
   bgColor: '#4cdf7d', 
   title: 'my card baby',
   bgImage: 'https://miro.medium.com/v2/resize:fit:1200/1*zCw9YQICYZzozYZsqeIiYA.png',
   seed: 1213
  }, 
  stamp_count: 4,
  stamp_total: 10,
  stamp_reward_index: [4, 9],
};

import { stampService } from "../../services/stampService";
import { useEffect, useState } from "react";

export default function StampSection() {
  const [stamps, setStamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadStamps = async () => {
      setLoading(true);
      const userStamps = await stampService.fetchStamps();
      if (userStamps) {
        console.log(userStamps)
        setStamps(userStamps);
      }
      setLoading(false);
    };

    loadStamps();
  }, []);

  return (
    <View style={styles.container}>
        <SmallCapsText baseSize={24} style={styles.headerText}>Stamp Cards</SmallCapsText>

        <StampCard cardDetails={temp} />

        <Text style={styles.collectedCaption}>{`${temp.stamp_count}/${temp.stamp_total} Collected`}</Text>
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