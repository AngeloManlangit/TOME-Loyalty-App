import { type UserDetails } from "@/assets/classes/users";
import { db } from "@/firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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
    }
}