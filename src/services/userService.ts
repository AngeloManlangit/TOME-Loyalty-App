import { type UserDetails } from "@/assets/classes/users";
import { db } from "@/firebase/firebaseConfig";
import { getDownloadURL, getStorage, ref, uploadBytes } from "@firebase/storage";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, getDoc, collection, addDoc, setDoc } from "firebase/firestore";

const auth = getAuth();

export const userService = {

    // fetching user's details and configs
    async fetchUserDetails(): Promise<UserDetails | null> {
        const user = auth.currentUser;

        if (user) {
            try {
                const d = doc(db, "users", user.uid);
                const docSnap = await getDoc(d);
                if (docSnap.exists()) {
                    const docData = docSnap.data();

                    const rawDate = docData.birth_date && typeof docData.birth_date.toDate === 'function' 
                        ? docData.birth_date.toDate() 
                        : new Date(docData.birth_date);

                    const formattedBirthDate = rawDate.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                    });

                    const fetchedUser = {
                        id: docSnap.id,
                        ...docData,
                        birth_date: formattedBirthDate
                    } as unknown as UserDetails;

                    return fetchedUser;
                } else {
                    console.log("No such user document!");
                    return null;
                }
            } catch (error: any) {
                console.error("Error fetching user's details:", error);
                alert('Could not fetch user: ' + error.message);
                return null;
            }
        } else {
            console.log('No user logged in!')
            return null;
        }
    },

    async uploadProfileImage(uri: string) {
        const user = auth.currentUser;
        if (user) {
            try {
                const blob: Blob = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.onload = function() {
                        resolve(xhr.response);
                    };
                    xhr.onerror = function(e) {
                        console.log(e);
                        reject(new TypeError('Network request failed'));
                    };
                    xhr.responseType = 'blob';
                    xhr.open('GET', uri, true);
                    xhr.send(null);
                });
        
                const storage = getStorage();
                const filename = `userPfps/${user.uid}_${Date.now()}.jpg`;
                const storageRef = ref(storage, filename);
        
                await uploadBytes(storageRef, blob);
        
                const downloadURL = await getDownloadURL(storageRef);
                return downloadURL;
            } catch (error: any) {
                console.error("Error uploading stamp background: ", error);
                return null;
            }
        } else {
            console.log('No user logged in!');
            return null;
        }
    },

    async uploadUserDetails(profile: UserDetails, userID: string | undefined) {
        try {
            if (!userID) throw new Error("No user ID provided.");

            // Point to the specific document using the Auth UID
            const docRef = doc(db, "users", userID);

            // writes a document to that specific userID (makes a new one if DNE)
            await setDoc(docRef, profile, { merge: true });

            console.log("User added with ID: ", userID);
        } catch (error) {
            console.error("Error uploading user details: ", error);
        }
    }
}