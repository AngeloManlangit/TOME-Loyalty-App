import { Text, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { auth } from '../../firebase/firebaseConfig'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { router } from 'expo-router';

export default function Index() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const signIn = async () => {
        try {
            const user = await signInWithEmailAndPassword(auth, email, password);
            if (user) router.replace('/home');
            
        } catch (error: any) {
            console.log(error);
            alert('Sign in failed: ' + error.message)
        }
    }

    const signUp = async () => {
        try {
            const user = await createUserWithEmailAndPassword(auth, email, password);
            if (user) router.replace('/home');
        } catch (error: any) {
            console.log(error);
            alert('Sign in failed: ' + error.message)
        }
    }

    return (
        <SafeAreaView style={{backgroundColor: '#237474', flex: 1}}>
            <Text>Hi</Text>
            <TextInput placeholder='email' value={email} onChangeText={setEmail} />
            <TextInput placeholder='password' value={password} onChangeText={setPassword} />

            <TouchableOpacity onPress={signIn}>
                <Text>LOGIN BABY</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={signUp}>
                <Text>MAKE ACCOUNT BABY</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}