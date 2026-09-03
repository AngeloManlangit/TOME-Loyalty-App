import { auth } from '@/firebase/firebaseConfig'
import { createUserWithEmailAndPassword } from "@firebase/auth";
import { router } from "expo-router";
import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Platform, Pressable, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Fonts } from '@src/constants/theme';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    const [password, setPassword] = useState('');
    const [contactNo, setContactNo] = useState('');

    const [username, setUsername] = useState('');

    const [loading, setLoading] = useState(false);

    // sign UP functionality
    const signUp = async () => {
        try {
            const user = await createUserWithEmailAndPassword(auth, email, password);
            if (user) router.replace('/home');
        } catch (error: any) {
            console.log(error);
            alert('Sign in failed: ' + error.message)
        } finally {
            const user = auth.currentUser
            console.log('Successfully signed up! Welcome new user +' + user?.uid);
            setLoading(false);
        }
    }

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


    const renderContent = () => {
        if (screenState === AccountCreationState.InfoDetails1) {
            return (
                <View style={styles.formContainer}>
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

                    <Text>Birthdate</Text>
                    <Pressable onPress={showDatePicker} style={styles.textInputContainer}>
                        <View pointerEvents="none">
                            <TextInput
                                style={styles.textInput}
                                placeholder="DD/MM/YYYY"
                                value={birthdayText}
                                editable={false} // Prevents the system keyboard from popping up
                            />
                        </View>
                    </Pressable>

                    {show && (
                        <DateTimePicker
                            value={birthdate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={onChange}
                            maximumDate={new Date()} // Optional: Prevents picking future dates
                        />
                    )}

                    <TouchableOpacity onPress={() => setScreenState(AccountCreationState.InfoDetails2)} style={styles.baseButton}>
                        <Text style={styles.buttonText}>NEXT</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        else if (screenState === AccountCreationState.InfoDetails2) {
            return (
                <View style={styles.formContainer}>
                    <View style={styles.textInputContainer}>
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
                        <TextInput
                            placeholder='Password'
                            placeholderTextColor='#797979'
                            style={styles.textInput}
                            value={password}
                            onChangeText={setPassword}
                            autoCapitalize="none"
                            removeClippedSubviews={false}
                            secureTextEntry />
                    </View>

                    <View style={styles.besideButtonsContainer}>
                        <TouchableOpacity onPress={() => setScreenState(AccountCreationState.InfoDetails1)} 
                            style={[styles.baseButton, { flex: 1, width: 'auto', borderColor: Colors.outlets.purple, backgroundColor: '#fff' }]}>
                            <Text style={[styles.buttonText, {color: Colors.outlets.purple}]}>BACK</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setScreenState(AccountCreationState.ProfileInfo)} style={[styles.baseButton, { flex: 1, width: 'auto' }]}>
                            <Text style={styles.buttonText}>NEXT</Text>
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
        padding: 10,
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
        alignItems: 'flex-start',
        borderRadius: 10,
        borderColor: Colors.outlets.purple,
        borderWidth: 1,
        marginBottom: 20
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
})