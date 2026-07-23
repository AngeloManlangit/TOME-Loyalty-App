import { Image, Text, TextInput, TouchableOpacity, StyleSheet, View } from 'react-native'
import { useState, useEffect } from 'react'
import { auth } from '@/firebase/firebaseConfig'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth'
import { router } from 'expo-router';

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
                <View>
                    <TextInput placeholder='email' value={email} onChangeText={setEmail} autoCapitalize="none" />
                    <TextInput placeholder='password' value={password} onChangeText={setPassword} secureTextEntry />

                    <TouchableOpacity onPress={signIn}>
                        <Text>LOGIN BABY</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setScreenState(LoginScreenOptions.Base)}>
                        <Text>BACK</Text>
                    </TouchableOpacity>
                </View>
            );
        } else if (screenState === LoginScreenOptions.SignUp) {
            return (
                <View>
                    <TextInput placeholder='email' value={email} onChangeText={setEmail} autoCapitalize="none" />
                    <TextInput placeholder='password' value={password} onChangeText={setPassword} secureTextEntry />

                    <TouchableOpacity onPress={signUp}>
                        <Text>MAKE ACCOUNT BABY</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setScreenState(LoginScreenOptions.Base)}>
                        <Text>BACK</Text>
                    </TouchableOpacity>
                </View>
            );
        } else {
            return (
                <View>
                    <TouchableOpacity onPress={() => setScreenState(LoginScreenOptions.SignIn)}>
                        <Text>LOG IN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setScreenState(LoginScreenOptions.SignUp)}>
                        <Text>CREATE ACCOUNT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.replace('/home')}>
                        <Text>Touch me (Skip to Home)</Text>
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
    }
})