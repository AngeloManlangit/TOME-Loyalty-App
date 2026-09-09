import { View, Text, useWindowDimensions, TextInput, Button, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StampCardDetails } from '@/assets/classes/stamps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserProvider } from '@/src/contexts/userContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/src/constants/theme';
import Constants from 'expo-constants';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { stampService } from '@/src/services/stampService';
import StampCard from '@/src/components/stamps/stampCard';

import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import ColorPicker, { Swatches, Preview, ColorFormatsObject, Panel3, BrightnessSlider } from "reanimated-color-picker";


export default function EditStampScreen() {
  const { details } = useLocalSearchParams();
  const parsedDetails = details ? JSON.parse(details as string) : null;
  const stampCard = parsedDetails as StampCardDetails;

  const statusBarHeight = Constants.statusBarHeight;
  const { height } =  useWindowDimensions();
  const statusBarHeightPercentage = statusBarHeight / height;
  
  // config options
  const [titleInput, setTitleInput] = useState(stampCard.stampCard_configs.title);
  const [bgColorInput, setBgColor] = useState(stampCard.stampCard_configs.bgColor);
  const [bgImageLink, setBgImageLink] = useState(stampCard.stampCard_configs.bgImage);

  const dynamicStampCard = {
    ...stampCard,
    stampCard_configs: {
      ...stampCard.stampCard_configs,
      title: titleInput,
      bgColor: bgColorInput,
      bgImage: bgImageLink
    }
  };

  const ColorChoices: string[] = Object.values(Colors.outlets);

  // 2. Function to handle launching the image gallery
  const pickImage = async () => {
    // Request permission to access media library
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert("You've refused permission to allow this app to access your photos!");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 5], 
      quality: 0.8,
    });

    if (!result.canceled) {
      // Save the local image URI to the bgImage field
      setBgImageLink(result.assets[0].uri);
    }
  };

  const handleSaveToFirebase = async () => {
    if (!dynamicStampCard) return;
    
    try {
      // Start with the current bgImage value
      let finalBgImageUrl = dynamicStampCard.stampCard_configs.bgImage;

      // Only upload if it's a new local image (starts with file://)
      if (finalBgImageUrl && finalBgImageUrl.startsWith('file://')) {
        console.log("Uploading new image to Firebase Storage...");
        finalBgImageUrl = await stampService.uploadBgImage(finalBgImageUrl);
      }

      // Create the final object with the public URL
      const finalStampDetails = {
        ...dynamicStampCard,
        stampCard_configs: {
          ...dynamicStampCard.stampCard_configs,
          bgImage: finalBgImageUrl // This is now safe for Firestore
        }
      };

      console.log("Ready to save to Firestore:", finalStampDetails);
      
      // Execute your Firestore update here:
      const response = await stampService.updateStamp(finalStampDetails);

      if (response?.success) {
        alert("Stamp updated successfully!");
      }
      else {
        alert("Error in editing stamp. Please again later.\nError: " + response?.error);
      }

      return;

    } catch (error) {
      console.error("Error saving stamp details:", error);
      alert("Failed to save changes.");
    }

  };
  
  const onSelectColor = ({ hex }: ColorFormatsObject) => {
    setBgColor(hex);
  };

  return (
    <UserProvider>
      <GestureHandlerRootView>

        <LinearGradient
            colors={[Colors.outlets.purple, '#fff']}
            style={{flex: 1}}
            locations={[statusBarHeightPercentage, statusBarHeightPercentage]}
        >
            <SafeAreaView style={{ flex: 1, padding: 20 }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text>Back</Text>
                </TouchableOpacity>
                <Text style={styles.header}>EDIT STAMP</Text>

                
                { dynamicStampCard && (
                    <ScrollView style={styles.formContainer}>
                        
                        <View style={styles.cardHolder}>
                            <StampCard cardDetails={dynamicStampCard} />
                        </View>
                      
                          {/* Title Input */}
                        <View style={styles.titleSection}>
                          <Text style={styles.label}>Card Title</Text>
                          <TextInput 
                            style={styles.input}
                            value={titleInput} 
                            onChangeText={setTitleInput}
                            placeholder="Enter card title"
                          />
                        </View>

                          {/* Background Color Input */}
                        <View style={styles.bgColorSection}>
                          <Text style={[styles.label, { alignSelf: 'flex-start' }]}>Background Color</Text>
                          <ColorPicker style={{ width: "90%", gap: 5 }} value={bgColorInput} onCompleteJS={onSelectColor}>
                            <Preview />
                            <View style={styles.panelAndBar}>
                              <Panel3 />
                              <BrightnessSlider reverse={true} vertical={true} style={{borderRadius: 50}} adaptSpectrum={true} />
                            </View>
                            <Swatches colors={ColorChoices} style={styles.swatchesContainer} swatchStyle={styles.swatch} />
                          </ColorPicker>
                        </View>

                          {/* Background Image Upload */}
                          <Text style={styles.label}>Background Image</Text>
                          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                            <Text style={styles.uploadButtonText}>Upload Image</Text>
                          </TouchableOpacity>
                          
                          {/* Display the selected image if it exists */}
                          { bgImageLink && (
                            <Image 
                              source={{ uri: bgImageLink }} 
                              style={styles.previewImage}
                            />
                          )}

                          <View style={{ marginTop: 20 }}>
                            <Button title="Save Changes" onPress={handleSaveToFirebase} />
                          </View>
                      
                    </ScrollView>
                )}
            </SafeAreaView>
        </LinearGradient>
      </GestureHandlerRootView>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    formContainer: {
        marginTop: 10,
    },
    cardHolder: {
        marginBottom: 30,
        width: '100%',
        alignItems: 'center',
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        fontWeight: '600',
        color: '#333'
    },
    input: {
        width: '100%',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        fontSize: 16,
    },
    uploadButton: {
        backgroundColor: '#eee',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
        marginBottom: 15,
    },
    uploadButtonText: {
        fontSize: 16,
        color: '#333',
    },
    previewImage: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        resizeMode: 'cover',
        marginBottom: 15,
    },
    titleSection: {
      width: '100%',
      alignItems: 'flex-start'
    },
    bgColorSection: {
      width: '100%',
      alignItems: 'center'
    },
    panelAndBar: {
      width: '100%',
      height: 250,
      flexDirection: 'row',
      gap: 18,
      justifyContent: 'center',
      marginVertical: 15,
    },
  swatchesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  swatch: {
    width: '15%',
    aspectRatio: 1,
    borderRadius: 999,
    marginBottom: '2.5%',
    transform: [{ scale: 0.75 }]
  }
});