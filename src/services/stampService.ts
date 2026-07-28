import { StampCardDetails, defaultStampCard } from "@/assets/classes/stamps";
import { db } from "@/firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import { addDoc, collection, deleteDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { genSeed } from "../utils/rng";

const auth = getAuth();
const stampsCollection = collection(db, 'stamps');

export const stampService = {

    // fetching the stamps of that user
    async fetchStamps(): Promise<StampCardDetails[]> {
        const user = auth.currentUser;

        if (user) {
            try {
                const q = query(stampsCollection, where("owner_ID", "==", user.uid), orderBy("stamp_count", "desc"));
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
                    
                    const rawDate = docData.date_created && typeof docData.date_created.toDate === 'function'
                                ? docData.date_created.toDate()
                                : new Date(docData.date_created)

                    return {
                        id: doc.id,
                        ...docData,
                        ...(formattedHistory ? { history: formattedHistory } : {}),
                        date_created: rawDate
                    } as unknown as StampCardDetails; // unknown because Typescript error can't trust the doc.data() return if empty smh
                });
                
                // console.log(fetchedStamps.length)
                if (fetchedStamps.length == 0) {
                    console.log('No stamps for this user, making new one');
                    await this.addNewStamp(); 
                    return await this.fetchStamps();
                }
                
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

    async addNewStamp() {
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
    },
    
    async deleteAllStampsByOwner() {
        console.log('Deleting all...')
        const user = auth.currentUser;

        if (user) {
            try {
                // 1. Query all documents belonging to the owner in the stamps collection
                const q = query(stampsCollection, where("owner_ID", "==", user.uid));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    console.log('No documents found to delete.');
                    return true;
                }

                // 2. Delete each document 
                // We use Promise.all to delete them concurrently for better performance
                const deletePromises = snapshot.docs.map((docSnapshot) => {
                    return deleteDoc(docSnapshot.ref);
                });

                await Promise.all(deletePromises);
                
                console.log(`Successfully deleted all stamps for owner: ${user.uid}`);
                return true;
            } catch (error: any) {
                console.error("Error deleting stamps: ", error);
                return false;
            }
        } else {
            console.log('No user logged in!');
            return false;
        }
    }
}