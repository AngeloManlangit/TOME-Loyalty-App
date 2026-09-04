import { auth } from '@/firebase/firebaseConfig'
import { createUserWithEmailAndPassword } from "@firebase/auth";

import { router } from "expo-router";
import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform, Pressable, StatusBar, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Fonts } from '@src/constants/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Eye, EyeOff, Mail, Phone } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import ProfileCard from '@src/components/profile/profileCard';
import { userService } from '@src/services/userService';

enum AccountCreationState {
    InfoDetails1, InfoDetails2, ProfileInfo, ProfileCard
}

/*
Info Details 1:
- First Name, Middle Name, Last Name, Birthday

Info Details 2:
- Email, Password, Confirm Password, Contact Number

Profile Info:
- Profile pfp, Custom Username

Profile Card
- Customize color of the profile card
*/

export default function CreateAcc() {
    const [firstName, setFirstName] = useState('');
    const [midName, setMidName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthdate, setBirthdate] = useState(new Date());

    const [email, setEmail] = useState('');
    const [contactNo, setContactNo] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showConPw, setShowConPw] = useState(false);

    const [profilePic, setProfilePic] = useState<string | null>(null);
    const [username, setUsername] = useState('');

    const [cardColor, setCardColor] = useState('');

    const [loading, setLoading] = useState(false);

    // sign UP functionality
    const signUp = async () => {
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCred.user;

            let uploadedPicUrl = '';

            if (profilePic) {
                const downloadUrl = await userService.uploadProfileImage(profilePic);
                if (downloadUrl) {
                    uploadedPicUrl = downloadUrl;
                }
            }

            const profile = {
                username,
                email,
                contact_no: contactNo,
                first_name: firstName,
                middle_name: midName,
                last_name: lastName,
                profile_img_url: uploadedPicUrl,
                birth_date: birthdate,
                cardBackgroundColor: cardColor
            };

            await userService.uploadUserDetails(profile as any, user.uid);
            
            router.replace('/home');
        } catch (error: any) {
            console.log(error);
            alert('Sign up failed: ' + error.message)
        } finally {
            const user = auth.currentUser
            console.log('Successfully signed up! Welcome new user +' + user?.uid);
            setLoading(false);
        }
    }

    // for the pfp
    const pickImage = async () => {
        // Request permission (optional but recommended)
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
            alert("You've refused to allow this app to access your photos!");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            setProfilePic(result.assets[0].uri);
        }
    };

    const [screenState, setScreenState] = useState(AccountCreationState.InfoDetails1);

    const [show, setShow] = useState(false);
    const [birthdayText, setBirthdayText] = useState('');
    const onChange = (event: any, selectedDate: any) => {
        // On Android, dismissing the picker returns an 'dismissed' event
        if (event.type === 'dismissed') {
            setShow(false);
            return;
        }

        const currentDate = selectedDate || birthdate;
        setShow(Platform.OS === 'ios'); // iOS keeps picker open, Android closes on select
        setBirthdate(currentDate);

        // Format the date for the text field display
        let tempDate = new Date(currentDate);
        let fDate = tempDate.getDate() + '/' + (tempDate.getMonth() + 1) + '/' + tempDate.getFullYear();
        setBirthdayText(fDate);
    };

    const showDatePicker = () => {
        setShow(true);
    };

    const handleSwitchForm = (nextIndex: number) => {
        setScreenState(screenState + nextIndex);
    }

    const renderContent = () => {
        if (screenState === AccountCreationState.InfoDetails1) {
            return (
                <View style={styles.formContainer}>
                    <View style={styles.innerFormContainer}>
                        <View>
                            <Text>First Name</Text>
                            <View style={styles.textInputContainer}>
                                <TextInput
                                    placeholder='e.g. Juan'
                                    placeholderTextColor='#797979'
                                    style={styles.textInput}
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    autoCapitalize="none"
                                    removeClippedSubviews={false} />
                            </View>
                        </View>

                        <View>
                            <Text>Middle Name (optional)</Text>
                            <View style={styles.textInputContainer}>
                                <TextInput
                                    placeholderTextColor='#797979'
                                    style={styles.textInput}
                                    value={midName}
                                    onChangeText={setMidName}
                                    autoCapitalize="none"
                                    removeClippedSubviews={false} />
                            </View>
                        </View>

                        <View>
                            <Text>Last Name</Text>
                            <View style={styles.textInputContainer}>
                                <TextInput
                                    placeholder='e.g. dela Cruz'
                                    placeholderTextColor='#797979'
                                    style={styles.textInput}
                                    value={lastName}
                                    onChangeText={setLastName}
                                    autoCapitalize="none"
                                    removeClippedSubviews={false} />
                            </View>
                        </View>

                        <View>
                            <Text>Birthdate</Text>
                            <Pressable onPress={showDatePicker} style={styles.textInputContainer}>
                                <View pointerEvents="none">
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="DD/MM/YYYY"
                                        placeholderTextColor='#797979'
                                        value={birthdayText}
                                        editable={false} // Prevents the system keyboard from popping up
                                    />
                                </View>
                            </Pressable>
                        </View>

                        {show && (
                            <DateTimePicker
                                value={birthdate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onValueChange={onChange}
                                maximumDate={new Date()} // Optional: Prevents picking future dates
                            />
                        )}
                    </View>

                    <TouchableOpacity onPress={() => handleSwitchForm(1)} style={styles.baseButton}>
                        <Text style={styles.buttonText}>NEXT</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        else if (screenState === AccountCreationState.InfoDetails2) {
            return (
                <View style={[styles.formContainer]}>
                    <View style={styles.innerFormContainer}>

                        <View style={styles.textInputContainer}>
                            <Mail color={Colors.outlets.purple} style={{marginLeft: 10}} />
                            <TextInput
                                placeholder='Email'
                                placeholderTextColor='#797979'
                                style={styles.textInput}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                removeClippedSubviews={false} />
                        </View>

                        <View style={styles.textInputContainer}>
                            <Phone color={Colors.outlets.purple} style={{ marginLeft: 10 }} />
                            <TextInput
                                placeholder='Contact no.'
                                placeholderTextColor='#797979'
                                style={styles.textInput}
                                value={contactNo}
                                onChangeText={setContactNo}
                                autoCapitalize="none"
                                removeClippedSubviews={false} />
                        </View>

                        <View style={styles.textInputContainer}>
                            <TextInput
                                placeholder='Password'
                                placeholderTextColor='#797979'
                                style={styles.textInput}
                                value={password}
                                onChangeText={setPassword}
                                autoCapitalize="none"
                                removeClippedSubviews={false}
                                secureTextEntry={!showPw} />
                            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={{ marginRight: 10 }}>
                                { 
                                    showPw ? (
                                        <EyeOff color={Colors.outlets.purple} /> 
                                    ) : (
                                        <Eye color={Colors.outlets.purple} /> 
                                    )
                                }
                            </TouchableOpacity>
                        </View>

                        <View style={styles.textInputContainer}>
                            <TextInput
                                placeholder='Confirm Password'
                                placeholderTextColor='#797979'
                                style={styles.textInput}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                autoCapitalize="none"
                                removeClippedSubviews={false}
                                secureTextEntry={!showConPw} />

                            <TouchableOpacity onPress={() => setShowConPw(!showConPw)} style={{ marginRight: 10 }}>
                                {
                                    showConPw ? (
                                        <EyeOff color={Colors.outlets.purple} />
                                    ) : (
                                        <Eye color={Colors.outlets.purple} />
                                    )
                                }
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.besideButtonsContainer}>
                        <TouchableOpacity onPress={() => handleSwitchForm(-1)} 
                            style={[styles.baseButton, { flex: 1, width: 'auto', borderColor: Colors.outlets.purple, backgroundColor: '#fff' }]}>
                            <Text style={[styles.buttonText, {color: Colors.outlets.purple}]}>BACK</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleSwitchForm(1)} style={[styles.baseButton, { flex: 1, width: 'auto' }]}>
                            <Text style={styles.buttonText}>NEXT</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
        else if (screenState === AccountCreationState.ProfileInfo) {
            return (
                <View style={styles.formContainer}>
                    <View style={styles.innerFormContainer}>
                        <View style={{ alignItems: 'center', marginBottom: 25 }}>
                            <TouchableOpacity onPress={pickImage} style={styles.imagePickerButton}>
                                {profilePic ? (
                                    <Image source={{ uri: profilePic }} style={styles.profileImage} />
                                ) : (
                                    <Text style={{ color: Colors.outlets.purple }}>Upload Photo</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View>
                            <Text>Username</Text>
                            <View style={styles.textInputContainer}>
                                <TextInput
                                    placeholder='e.g. juandelacruz99'
                                    placeholderTextColor='#797979'
                                    style={styles.textInput}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>
                    </View>

                    <View style={styles.besideButtonsContainer}>
                        <TouchableOpacity onPress={() => handleSwitchForm(-1)}
                            style={[styles.baseButton, { flex: 1, width: 'auto', borderColor: Colors.outlets.purple, backgroundColor: '#fff' }]}>
                            <Text style={[styles.buttonText, { color: Colors.outlets.purple }]}>BACK</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleSwitchForm(1)} style={[styles.baseButton, { flex: 1, width: 'auto' }]}>
                            <Text style={styles.buttonText}>NEXT</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
        else {
            return(
                <View style={[styles.formContainer, {paddingTop: 20}]}>
                    <ProfileCard
                        username={username}
                        email={email}
                        contact_no={contactNo}
                        first_name={firstName}
                        middle_name={midName}
                        last_name={lastName}
                        profile_img_url={profilePic || ''}
                        birth_date={birthdayText}
                        cardBackgroundColor={cardColor}
                    />

                    <View style={[styles.innerFormContainer, { gap: 10 }]}>
                        <Text>Choose your Profile Card Color</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15}}>
                            {Object.values(Colors.outlets).map((color, index) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => setCardColor(color)}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: color,
                                        borderWidth: cardColor === color ? 3 : 1,
                                        borderColor: cardColor === color ? '#000' : '#cacaca',
                                    }}
                                />
                            ))}
                        </View>
                    </View>

                    <View style={[styles.besideButtonsContainer, { marginTop: 20 }]}>
                        <TouchableOpacity onPress={() => handleSwitchForm(-1)}
                            style={[styles.baseButton, { flex: 1, width: 'auto', borderColor: Colors.outlets.purple, backgroundColor: '#fff' }]}>
                            <Text style={[styles.buttonText, { color: Colors.outlets.purple }]}>BACK</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={signUp} style={[styles.baseButton, { flex: 1, width: 'auto' }]}>
                            <Text style={styles.buttonText}>FINISH</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar
                barStyle="dark-content" // Options: 'default', 'light-content', 'dark-content'
            />
            
            <TouchableOpacity onPress={() => router.push('/')} style={styles.cancel}>
                <Text style={styles.back}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.header}>CREATE ACCOUNT</Text>

            { renderContent() }
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center'
    },
    cancel: {
        alignSelf: 'flex-start',
        padding: 10,
        paddingLeft: 15
    },
    header: {
        fontFamily: Fonts.Montserrat,
        color: Colors.outlets.pink,
        fontSize: 30
    },
    formContainer: {
        width: '85%',
        height: '60%', 
        justifyContent: 'space-between'
    },
    innerFormContainer: {
        padding: 15,
        borderWidth: 1,
        borderColor: '#cacaca',
        borderRadius: 20,
        justifyContent: 'center',
        gap: 20,
        marginTop: 20
    },
    baseLoginContainer: {
        gap: 20,
        paddingTop: 50,
    },
    baseButton: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 50,
        borderColor: Colors.outlets.purple,
        backgroundColor: Colors.outlets.purple,
        borderWidth: 2,
        padding: 10,
    },
    buttonText: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 18,
        color: '#fff'
    },
    textInputContainer: {
        width: '100%',
        height: 50,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: `${Colors.outlets.purple}${30}`,
        borderColor: Colors.outlets.purple,
        borderWidth: 1,
    },
    textInput: {
        color: '#000',
        flex: 1,
        width: '100%',
        paddingHorizontal: 10,
        fontFamily: Fonts.Lato,
    },
    signContainer: {
        gap: 15,
        paddingTop: 35,
    },
    back: {
        color: '#977390',
        fontFamily: Fonts.Lato
    },
    besideButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 12
    },
    imagePickerButton: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: `${Colors.outlets.purple}${30}`,
        borderColor: Colors.outlets.purple,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
    },
})