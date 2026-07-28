import { StampCardDetails } from '@/assets/classes/stamps';
import { stampService } from '@src/services/stampService';
import React, { createContext, useContext, useEffect, useState } from 'react';



interface StampContextType {
    stamps: StampCardDetails[];
    loading: boolean;
    /** Refetch from Firestore. Safe to call from anywhere; errors are swallowed and logged. */
    refresh: () => Promise<void>;
}

const StampContext = createContext<StampContextType>({
    stamps: [],
    loading: true,
    refresh: async () => {},
});

export const StampProvider = ({ children }: { children: React.ReactNode }) => {
    const [stamps, setStamps] = useState<StampCardDetails[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        const fetched = await stampService.fetchStamps();
        setStamps(fetched);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <StampContext.Provider
            value={{
                stamps,
                loading,
                refresh: async () => {
                    // No loading flag here: a refresh after a claim should update the card in place,
                    // not flash the whole section back to a spinner.
                    await load();
                },
            }}
        >
            {children}
        </StampContext.Provider>
    );
};

export const useStamps = () => useContext(StampContext);
