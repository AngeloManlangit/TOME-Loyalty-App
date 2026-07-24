import { StampCardDetails, defaultStampCard } from "@/assets/classes/stamps";
import { db } from "@/firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { genSeed } from "../utils/rng";

const auth = getAuth();
const stampsCollection = collection(db, 'stamps');

export const stampService = {

    // fetching the stamps of that user
    async fetchStamps(): Promise<StampCardDetails[]> {
        const user = auth.currentUser;

        if (user) {
            try {
                const q = query(stampsCollection, where("owner_ID", "==", user.uid));
                const data = await getDocs(q);
                const fetchedStamps = data.docs.map((doc) => {
                    const docData = doc.data();
                    
                    let formattedHistory = docData.history;
                    
                    if (Array.isArray(docData.history)) {
                        formattedHistory = docData.history.map((entry: any) => ({
                            ...entry,
                            // Convert Firestore Timestamp to JS Date using .toDate()
                            time_stamped: entry.time_stamped && typeof entry.time_stamped.toDate === 'function'
                                ? entry.time_stamped.toDate()
                                : entry.time_stamped
                        }));
                    }
                    
                    return {
                        id: doc.id,
                        ...docData,
                        ...(formattedHistory ? { history: formattedHistory } : {})
                    } as unknown as StampCardDetails; // unknown because Typescript error can't trust the doc.data() return if empty smh
                });

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
    },

    async addNewDefaultStamp() {
        const user = auth.currentUser;

        if (user) {
            try {
                const docRef = await addDoc(stampsCollection, {
                    ...defaultStampCard, 
                    owner_ID: user.uid,
                    stampCard_configs: { ...defaultStampCard.stampCard_configs, seed: genSeed() }
                });
                console.log('Successfully created a new stamp: ' + docRef.id);
                return true;
            } catch (error: any) {
                console.error("Error creating stamp: ", error);
                return false;
            }
        } else {
            console.log('No user logged in!')
            return false;
        }
    }
}