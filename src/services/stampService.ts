import { getAuth } from "firebase/auth"
import { db } from "../../firebase/firebaseConfig"
import { collection, getDocs, query, where } from "firebase/firestore";
import { useState } from "react";

const auth = getAuth();
const stampsCollection = collection(db, 'stamps');

export const stampService = {

    // fetching the stamps of that user
    async fetchStamps() {
        const user = auth.currentUser;

        if (user) {
            try {
                const q = query(stampsCollection, where("owner_ID", "==", user.uid));
                const data = await getDocs(q);
                const fetchedStamps = data.docs.map((doc) => ({ ...doc.data(), id: doc.id }));

                return fetchedStamps;
            } catch (error: any) {
                console.error("Error fetching stamps:", error);
                alert('Could not fetch stamps: ' + error.message);
                return [];
            }
        } else {
            console.log('No user logged in!')
            return [];
        }
    }

}