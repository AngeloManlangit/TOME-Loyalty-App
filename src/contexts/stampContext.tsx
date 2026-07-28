import { StampCardDetails } from '@/assets/classes/stamps';
import { receiptService } from '@src/services/receiptService';
import { stampService } from '@src/services/stampService';
import React, { createContext, useContext, useEffect, useState } from 'react';



interface StampContextType {
    stamps: StampCardDetails[];
    /**
     * Unspent stamps the user holds — the count of claimed receipts with is_used == false.
     *
     * This is the number shown in the header, and it is NOT the card's stamp_count. Scanning fills
     * the wallet; the card is filled later by the "stamp this card" press.
     */
    balance: number;
    loading: boolean;
    /** Refetch from Firestore. Safe to call from anywhere; errors are swallowed and logged. */
    refresh: () => Promise<void>;
}

const StampContext = createContext<StampContextType>({
    stamps: [],
    balance: 0,
    loading: true,
    refresh: async () => {},
});

/**
 * Returns data rather than setting state, so the caller decides whether the result is still wanted.
 * In parallel: the two reads are independent and the header should not wait on the cards.
 */
async function fetchWallet(): Promise<{ cards: StampCardDetails[]; balance: number }> {
    const [cards, balance] = await Promise.all([
        stampService.fetchStamps(),
        receiptService.fetchStampBalance(),
    ]);
    return { cards, balance };
}

export const StampProvider = ({ children }: { children: React.ReactNode }) => {
    const [stamps, setStamps] = useState<StampCardDetails[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // `active` guards against the fetch resolving after the provider has gone, which would
        // otherwise set state on an unmounted component.
        let active = true;

        const run = async () => {
            const result = await fetchWallet();
            if (!active) return;
            setStamps(result.cards);
            setBalance(result.balance);
            setLoading(false);
        };

        run();
        return () => {
            active = false;
        };
    }, []);

    return (
        <StampContext.Provider
            value={{
                stamps,
                balance,
                loading,
                refresh: async () => {
                    // No loading flag here: a refresh after a claim should update the count in
                    // place, not flash the whole section back to a spinner.
                    const result = await fetchWallet();
                    setStamps(result.cards);
                    setBalance(result.balance);
                    setLoading(false);
                },
            }}
        >
            {children}
        </StampContext.Provider>
    );
};

export const useStamps = () => useContext(StampContext);
