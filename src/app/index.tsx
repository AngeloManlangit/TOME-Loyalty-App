import { Image, Text, TextInput, TouchableOpacity, StyleSheet, View } from 'react-native'
import { useState, useEffect } from 'react'
import { auth } from '@/firebase/firebaseConfig'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { router } from 'expo-router';
import { Colors, Fonts } from '@src/constants/theme';

enum LoginScreenOptions {
    Base, SignIn, SignUp
}

export default function Index() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // for account persistence, if user is still logged in
    useEffect(() => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("USER IS STILL LOGGED IN: " , user?.uid);
                router.replace('/home');
            }
        });
    }, []);

    const signIn = async () => {
        setLoading(true)
        try {
            const user = await signInWithEmailAndPassword(auth, email, password);
            if (user) router.replace('/home');
            
        } catch (error: any) {
            console.log(error);
            alert('Sign in failed: ' + error.message)
        } finally {
            const user = auth.currentUser
            console.log('Successfully signed in! Welcome user ' + user?.uid);
            setLoading(false);
        }
    }

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

    const [screenState, setScreenState] = useState(LoginScreenOptions.Base);

    const renderContent = () => {
        if (screenState === LoginScreenOptions.SignIn) {
            return (
                <View style={[styles.loginContainer, styles.signContainer]}>
                    <View style={styles.textInputContainer}>
                        <TextInput 
                            placeholder='Email' style={styles.textInput} 
                            value={email} 
                            onChangeText={setEmail} 
                            autoCapitalize="none"
                            removeClippedSubviews={false} />
                    </View>
                    <View style={styles.textInputContainer}>
                        <TextInput 
                            placeholder='Password' style={styles.textInput} 
                            value={password} 
                            onChangeText={setPassword} 
                            autoCapitalize="none"
                            removeClippedSubviews={false}
                            secureTextEntry />
                    </View>

                    <TouchableOpacity 
                        onPress={signIn} 
                        style={[styles.baseButton, {backgroundColor: Colors.outlets.purple}]}
                    >
                        <Text style={[styles.buttonText, {color: '#fff'}]}>LOG IN</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setScreenState(LoginScreenOptions.Base)}>
                        <Text style={styles.back}>BACK</Text>
                    </TouchableOpacity>
                </View>
            );
        } else if (screenState === LoginScreenOptions.SignUp) {
            return (
                <View style={[styles.loginContainer, styles.signContainer]}>
                    <View style={styles.textInputContainer}>
                        <TextInput 
                            placeholder='Email' style={styles.textInput} 
                            value={email} 
                            onChangeText={setEmail} 
                            autoCapitalize="none"
                            removeClippedSubviews={false} />
                    </View>
                    <View style={styles.textInputContainer}>
                        <TextInput 
                            placeholder='Password' style={styles.textInput} 
                            value={password} 
                            onChangeText={setPassword} 
                            autoCapitalize="none"
                            removeClippedSubviews={false}
                            secureTextEntry />
                    </View>

                    <TouchableOpacity 
                        onPress={signUp} 
                        style={[styles.baseButton, {backgroundColor: Colors.outlets.purple}]}
                    >
                        <Text style={[styles.buttonText, {color: '#fff'}]}>SIGN UP</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setScreenState(LoginScreenOptions.Base)}>
                        <Text style={styles.back}>BACK</Text>
                    </TouchableOpacity>
                </View>
            );
        } else {
            return (
                <View style={[styles.loginContainer, styles.baseLoginContainer]}>
                    <TouchableOpacity 
                        onPress={() => setScreenState(LoginScreenOptions.SignIn)}
                        style={[styles.baseButton, {backgroundColor: Colors.outlets.purple}]}
                    >
                        <Text style={[styles.buttonText, {color: '#fff'}]}>LOG IN</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setScreenState(LoginScreenOptions.SignUp)}
                        style={styles.baseButton}
                    >
                        <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
                    </TouchableOpacity>
                </View>
            );
        }
    }

    return (
        <View style={styles.container}>
            <Image source={require('@/assets/images/Top Half Sign Up.png')} style={styles.topHalfImage} />
            
            { renderContent() }
                {
                    loading ? 
                    (
                        <Text>LOADING...</Text>
                    ) : ('')
                }
        </View>
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