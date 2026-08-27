import { auth } from '@/firebase/firebaseConfig'
import { createUserWithEmailAndPassword } from "@firebase/auth";
import { router } from "expo-router";
import { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Fonts } from '@src/constants/theme';

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
    const [birthdate, setBirthdate] = useState(new Date);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [contactNo, setContactNo] = useState('');

    const [username, setUsername] = useState('');

    const [loading, setLoading] = useState(false);

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

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.push('/')}>
                <Text>Back</Text>
            </TouchableOpacity>

            <Text>CREATE ACCOUNT</Text>

            <View style={[styles.loginContainer, styles.signContainer]}>
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
            </View>

            <TouchableOpacity>
                <Text>NEXT</Text>
            </TouchableOpacity>
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
    topHalfImage: {
        width: '100%',
        height: 'auto',
        aspectRatio: 9 / 8
    },
    loginContainer: {
        width: '100%',
        flex: 1,
        alignItems: 'center',
    },
    baseLoginContainer: {
        gap: 20,
        paddingTop: 50,
    },
    baseButton: {
        width: '70%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 50,
        borderColor: Colors.outlets.purple,
        borderWidth: 2,
        padding: 10,
    },
    buttonText: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 18,
        color: Colors.outlets.purple
    },
    textInputContainer: {
        width: '80%',
        height: 50,
        alignItems: 'flex-start',
        borderRadius: 10,
        borderColor: Colors.outlets.purple,
        borderWidth: 1
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
    }
})