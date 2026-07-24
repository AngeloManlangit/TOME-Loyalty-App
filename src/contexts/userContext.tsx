import React, { createContext, useContext, useState, useEffect } from 'react';
import { userService } from "../services/userService";
import { UserDetails } from "@/assets/classes/users";

// Define the shape of your global data
interface UserContextType {
    user: UserDetails | undefined;
    loading: boolean;
}

// Create the context
const UserContext = createContext<UserContextType>({ user: undefined, loading: true });

// Create a Provider component that will wrap your app
export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserDetails>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            const u = await userService.fetchUserDetails();
            if (u) {
                setUser(u);
            }
            setLoading(false);
        };
        
        fetchUser();
    }, []); // Empty dependency array means this only runs ONCE when the app starts

    return (
        <UserContext.Provider value={{ user, loading }}>
            {children}
        </UserContext.Provider>
    );
};

// Create a custom hook for easy access in any screen
export const useUser = () => useContext(UserContext);