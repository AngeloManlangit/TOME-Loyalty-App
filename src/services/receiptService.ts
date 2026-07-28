import type {
    ClaimResult,
    ReceiptError,
    ReceiptFieldName,
    ReceiptRecord,
    RejectCode,
    ScanResult,
} from "@/assets/classes/receipts";
import { db, functions } from "@/firebase/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { collection, getCountFromServer, getDocs, orderBy, query, where } from "firebase/firestore";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const auth = getAuth();
const receiptsCollection = collection(db, "receipts");


const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;


function toReceiptError(error: unknown): ReceiptError {
    const code = (error as { code?: unknown } | null)?.code;
    const rawMessage = (error as { message?: unknown } | null)?.message;
    const message = typeof rawMessage === "string" ? rawMessage : String(error);

    if (typeof code === "string" && code.startsWith("functions/")) {
        const details = (error as { details?: { reject?: RejectCode } }).details;

        // 'unavailable' and 'deadline-exceeded' are the codes the SDK produces when the request could
        // not complete. 'internal' is deliberately NOT treated as offline: the server also returns it
        // for an unhandled exception, and calling a server crash "no connection" sends the user off
        // to check their wifi over a bug.
        const transportFailed =
            code === "functions/unavailable" || code === "functions/deadline-exceeded";

        return {
            code: details?.reject ?? null,
            message: details?.reject ? message : `${message} (${code})`,
            offline: transportFailed && !details?.reject,
        };
    }

    // Not a callable error at all — a device or client-side failure. Surface it verbatim.
    return { code: null, message, offline: false };
}

export const receiptService = {
    
    async prepareImage(imageUri: string): Promise<string> {
        const context = ImageManipulator.manipulate(imageUri).resize({ width: MAX_EDGE_PX });
        const rendered = await context.renderAsync();
        const saved = await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: JPEG_QUALITY,
            base64: true,
        });

        if (!saved.base64) throw new Error("Could not prepare the photo for upload.");
        return saved.base64;
    },

    
    async scanReceipt(imageUri: string): Promise<ScanResult> {
        const user = auth.currentUser;
        if (!user) {
            throw { code: null, message: "You must be signed in to scan.", offline: false } as ReceiptError;
        }

        try {
            const imageBase64 = await this.prepareImage(imageUri);
            const call = httpsCallable<{ imageBase64: string }, ScanResult>(functions, "scanReceipt");
            const response = await call({ imageBase64 });
            return response.data;
        } catch (error) {
            throw toReceiptError(error);
        }
    },

    
    async claimReceipt(
        sessionId: string,
        corrections?: Partial<Record<ReceiptFieldName, string>>,
    ): Promise<ClaimResult> {
        const user = auth.currentUser;
        if (!user) {
            throw { code: null, message: "You must be signed in to claim.", offline: false } as ReceiptError;
        }

        try {
            const call = httpsCallable<
                { sessionId: string; corrections?: Partial<Record<ReceiptFieldName, string>> },
                ClaimResult
            >(functions, "claimReceipt");
            const response = await call({ sessionId, corrections });
            return response.data;
        } catch (error) {
            throw toReceiptError(error);
        }
    },

    /**
     * The user's stamp balance: claimed receipts not yet spent on a card.
     *
     * An aggregate over the ledger rather than a stored counter — there is nothing to drift. Needs
     * the (owner_ID, is_used) composite index; the owner_ID filter is also what makes the query
     * satisfiable under firestore.rules.
     */
    async fetchStampBalance(): Promise<number> {
        const user = auth.currentUser;
        if (!user) return 0;

        try {
            const q = query(
                receiptsCollection,
                where("owner_ID", "==", user.uid),
                where("is_used", "==", false),
            );
            const snapshot = await getCountFromServer(q);
            return snapshot.data().count;
        } catch (error) {
            console.error("Error counting unused receipts:", error);
            return 0;
        }
    },

    /** Owner-scoped read of previously claimed receipts. Matches the existing service shape. */
    async fetchReceiptHistory(): Promise<ReceiptRecord[]> {
        const user = auth.currentUser;

        if (user) {
            try {
                // The owner_ID filter is what makes this satisfiable under firestore.rules — an
                // unfiltered query on receipts is denied.
                const q = query(
                    receiptsCollection,
                    where("owner_ID", "==", user.uid),
                    orderBy("claimed_at", "desc"),
                );
                const data = await getDocs(q);

                return data.docs.map((doc) => {
                    const docData = doc.data();

                    const toDate = (value: any): Date =>
                        value && typeof value.toDate === "function" ? value.toDate() : new Date(value);

                    return {
                        id: doc.id,
                        ...docData,
                        receipt_date: toDate(docData.receipt_date),
                        claimed_at: toDate(docData.claimed_at),
                    } as unknown as ReceiptRecord; // unknown because doc.data() is untyped
                });
            } catch (error: any) {
                console.error("Error fetching receipts:", error);
                return [];
            }
        } else {
            console.log("No user logged in!");
            return [];
        }
    },
};
