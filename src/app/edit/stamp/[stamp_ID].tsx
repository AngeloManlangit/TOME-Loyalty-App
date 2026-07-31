import { View, Text, useWindowDimensions, TextInput, Button, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StampCardDetails, StampCardConfigs } from '@/assets/classes/stamps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserProvider } from '@/src/contexts/userContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/src/constants/theme';
import Constants from 'expo-constants';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { stampService } from '@/src/services/stampService';
import StampCard from '@/src/components/stamps/stampCard';

export default function EditStampScreen() {
  const { details } = useLocalSearchParams();
  const parsedDetails = details ? JSON.parse(details as string) : null;
  const [stampDetails, setStampDetails] = useState<StampCardDetails | null>(parsedDetails);

  const statusBarHeight = Constants.statusBarHeight;
  const { height } =  useWindowDimensions();
  const statusBarHeightPercentage = statusBarHeight / height;

  // 1. Function to handle NESTED state updates for stampCard_configs
  const handleConfigChange = (field: keyof StampCardConfigs, value: string | null) => {
    if (stampDetails) {
      setStampDetails({
        ...stampDetails,
        stampCard_configs: {
          ...stampDetails.stampCard_configs, 
          [field]: value                 
        }
      });
    }
  };

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
      handleConfigChange('bgImage', result.assets[0].uri);
    }
  };

  const handleSaveToFirebase = async () => {
    if (!stampDetails) return;
    
    try {
      // Start with the current bgImage value
      let finalBgImageUrl = stampDetails.stampCard_configs.bgImage;

      // Only upload if it's a new local image (starts with file://)
      if (finalBgImageUrl && finalBgImageUrl.startsWith('file://')) {
        console.log("Uploading new image to Firebase Storage...");
        finalBgImageUrl = await stampService.uploadBgImage(finalBgImageUrl);
      }

      // Create the final object with the public URL
      const finalStampDetails = {
        ...stampDetails,
        stampCard_configs: {
          ...stampDetails.stampCard_configs,
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
  
  return (
    <UserProvider>
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

                
                { stampDetails && (
                    <ScrollView style={styles.formContainer}>
                        
                        <View style={styles.cardHolder}>
                            <StampCard cardDetails={stampDetails} />
                        </View>
                      
                      {/* Title Input */}
                      <Text style={styles.label}>Card Title</Text>
                      <TextInput 
                        style={styles.input}
                        value={stampDetails.stampCard_configs.title} // Bind to nested title[cite: 3]
                        onChangeText={(text) => handleConfigChange('title', text)}
                        placeholder="Enter card title"
                      />

                      {/* Background Color Input */}
                      <Text style={styles.label}>Background Color (Hex Code)</Text>
                      <TextInput 
                        style={styles.input}
                        value={stampDetails.stampCard_configs.bgColor} // Bind to nested bgColor[cite: 3]
                        onChangeText={(text) => handleConfigChange('bgColor', text)}
                        placeholder="#F3BDFF"
                        autoCapitalize="characters"
                      />

                      {/* Background Image Upload */}
                      <Text style={styles.label}>Background Image</Text>
                      <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                        <Text style={styles.uploadButtonText}>Upload Image</Text>
                      </TouchableOpacity>
                      
                      {/* Display the selected image if it exists */}
                      {stampDetails.stampCard_configs.bgImage && (
                        <Image 
                          source={{ uri: stampDetails.stampCard_configs.bgImage }} 
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
        alignItems: 'center'
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        fontWeight: '600',
        color: '#333'
    },
    input: {
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
    }
});