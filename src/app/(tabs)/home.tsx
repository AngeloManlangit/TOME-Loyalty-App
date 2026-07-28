import { StampCardDetails } from "@/assets/classes/stamps";
import StampPopupDetails from "@/src/components/stamps/stampPopupDetails";
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import StampSection from "@src/components/homePage/stampSection";
import { bgTransparency, Colors } from "@src/constants/theme";
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Linking, Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function HomeScreen() {
  const handleAdPress = async () => {
    const url = 'https://www.facebook.com/TheOutletsMez2Estate';
    
    // Check if the device can handle the URL scheme
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(`Don't know how to open this URL: ${url}`);
    }
  };

  // stamp popup
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['90%', '100%'], []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop disappearsOnIndex={-1} appearsOnIndex={0} {...props} />, []
  );

  const [selectedStamp, setSelectedStamp] = useState<StampCardDetails | null>(null);
  function setCurrentStamp(s: StampCardDetails) {
    console.log(s.id)
    setSelectedStamp(s);
    bottomSheetRef.current?.snapToIndex(0);
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <LinearGradient
        colors={['#fff', `${Colors.outlets.pink}${bgTransparency}`]}
        style={styles.mainView}
      >
        <StampSection chosenStamp={setCurrentStamp} />

        <TouchableOpacity onPress={handleAdPress}>
          <Image 
            source={{ uri: 'https://scontent-mnl1-2.xx.fbcdn.net/v/t39.99422-6/738416341_1538276351173222_2955608102244361871_n.png?stp=dst-png&cstp=mx1702x630&ctp=s1702x630&_nc_cat=100&ccb=1-7&_nc_sid=cc71e4&_nc_eui2=AeEC8rJmVLFAEwKDAtxdntbFNCgo_bRzV8M0KCj9tHNXw0w40p4yPsq6CNMJVnvP6qxn5YYlhq08wL-egmzdOj0F&_nc_ohc=Pup_rDlQ-bEQ7kNvwE56WW9&_nc_oc=Adp_hD0VdJ0CBY6r5uJ_eM7VICgVBLrIBto8x887k7nGuQTL3w0U5DEau4wikxm8aVA&_nc_zt=14&_nc_ht=scontent-mnl1-2.xx&_nc_gid=PaC5kVXh7JG_jmdrv5tZlA&_nc_ss=7b2a8&oh=00_AQD1J9oeDmqBZdYug7URqq11RRzlwIrbgraLHmV3XPZH_A&oe=6A68A942' }} 
            style={styles.adImage}  
          />
        </TouchableOpacity>

        <BottomSheet
            ref={bottomSheetRef}
            index={-1} // -1 means it starts fully hidden off-screen
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
        >
            <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
                {selectedStamp && (
                    <StampPopupDetails stamp={selectedStamp} />
                )}
            </BottomSheetScrollView>
        </BottomSheet>
        
      </LinearGradient>
    </GestureHandlerRootView>
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
  },
  adImage: {
    width: '100%',
    height: 'auto',
    aspectRatio: 2.7 / 1
  },
  sheetContent: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
  },
});
