import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api.js";
import { toast } from "react-toastify";

export const RiderContext = createContext(null);

const RiderContextProvider = (props) => {
    
    // Load saved rider details
    const [rider, setRider] = useState(() =>{
        const savedRider = localStorage.getItem("rider");

        if(!savedRider){
            return null;
        }

        try {
            return JSON.parse(savedRider);
        } catch (error) {
            localStorage.removeItem("rider");
            return null;
        }
    });

    // Load saved rider token
    const[token, setToken] = useState(
        () => localStorage.getItem("riderToken") || ""
    );

    const [authLoading, setAuthLoading] = useState(true);
    const [sessionVerified, setSessionVerified] = useState(false);

    // Verify saved rider session on app startup
    useEffect(() => {
        let cancelled = false;

        const verifySession = async () => {
            const savedToken = localStorage.getItem("riderToken");

            if(!savedToken){
                if(!cancelled){
                    setRider(null);
                    setToken("");
                    setSessionVerified(false);
                    setAuthLoading(false);
                }
                return;
            }

            try {
                const response = await api.get("/profile");

                if(response.data?.success !== true || !response.data?.rider || response.data.rider.isActive === false){
                    throw new Error("Invalid rider session.");
                }

                if(!cancelled){
                    const freshRider = response.data.rider;

                    localStorage.setItem("rider", JSON.stringify(freshRider));

                    setRider(freshRider);
                    setToken(savedToken);
                    setSessionVerified(true);
                }
            } catch (error) {
                if(!cancelled){
                    setSessionVerified(false);
                    
                    // Clear authentication only when the server explicitly rejects the stored session.
                    if(error.response?.status === 401 || error.response?.status === 403 || error.message === "Invalid rider session."){
                        localStorage.removeItem("rider");
                        localStorage.removeItem("riderToken");

                        setRider(null);
                        setToken("");
                    } else {
                        console.error("Rider session verification failed:", error.message);
                    }
                }
            } finally {
                if(!cancelled){
                    setAuthLoading(false);
                }
            }
        };

        verifySession();

        return () => {
            cancelled = true;
        };
    }, []);

    // Login rider
    const login = (riderData, riderToken, showMessage = true) => {
        if(!riderData || !riderToken){
            toast.error("Rider authentication failed. Please try again.");
            return false;
        }

        localStorage.setItem("rider", JSON.stringify(riderData));
        localStorage.setItem("riderToken", riderToken);

        setRider(riderData);
        setToken(riderToken);
        setSessionVerified(true);

        if(showMessage){
            toast.success("Login successful!");
        }
        
        return true;
    };

    // Logout rider
    const logout = () => {
        localStorage.removeItem("rider");
        localStorage.removeItem("riderToken");

        setRider(null);
        setToken("");
        setSessionVerified(false);

        toast.success("Logged out successfully!");
    };

    const contextValue = {rider, setRider, token, setToken, login, logout, authLoading, sessionVerified, isAuthenticated: Boolean(rider && token && sessionVerified)};

    return(
        <RiderContext.Provider value={contextValue}>
            {props.children}
        </RiderContext.Provider>
    );

};

export const useRider = () => {
    return useContext(RiderContext);
}

export default RiderContextProvider;