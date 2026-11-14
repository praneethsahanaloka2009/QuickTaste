import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4911").replace(/\/$/, "");

export const StoreContext = createContext(null)

const StoreContextProvider = (props) => {

    const [cartItems, setCartItems] = useState({});
    const [customizedCartItems, setCustomizedCartItems] = useState([]);
    const [customizedCartLoading, setCustomizedCartLoading] = useState(false);
    const [token, setToken] = useState(() => localStorage.getItem("token") || "");
    const [food_list, setFoodList] = useState([]);

    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem("user");

        if(!savedUser){
            return null;
        }

        try {
            return JSON.parse(savedUser);
        } catch (error) {
            localStorage.removeItem("user");
            return null;
        }
    });

    // Fetch Products From Backend
    const fetchFoodList = async () => {

        try {

            const response = await fetch(
                `${API_URL}/api/food/list`
            );

            const data = await response.json();

            if(data.success){
                setFoodList(data.data);
            } else {
                console.log(data.message);
            }

        } catch (error) {
            console.log("Food List Error:", error);
        }

    };

    // Fetch Customized Cart From Backend
    const loadCustomizedCartData = async (userToken) => {
        
        if(!userToken){
            setCustomizedCartItems([]);
            return false;
        }

        try {
            setCustomizedCartLoading(true);

            const response = await fetch(
                `${API_URL}/api/user/custom-cart`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${userToken}`
                    }
                }
            );

            const data = await response.json();

            if(response.ok && data.success){
                setCustomizedCartItems(Array.isArray(data.items) ? data.items : []);
                return true;
            }

            console.error("Load Customized Cart Failed:", data.message);

            return false;

        } catch (error) {
            console.error("Load Customized Cart Error:", error);
            return false;
        } finally {
            setCustomizedCartLoading(false);
        }

    };

    // Fetch Cart From Backend
    const loadCartData = async (userToken) => {

        try {

            const response = await fetch(
                `${API_URL}/api/user/cart`,
                {
                    method : "GET",
                    headers : {
                        "Authorization" : `Bearer ${userToken}`
                    }
                }
            );

            const data = await response.json();

            if(data.success){
                setCartItems(data.cartData || {});
            } else {
                console.log(data.message);
            }

        } catch (error) {
            console.log("Load Cart Error:", error);
        }

    };

    // Fetch User Profile
    const fetchUserProfile = async (userToken) => {

        try {

            const response = await fetch(
                `${API_URL}/api/user/profile`,
                {
                    method : "GET",
                    headers : {
                        "Authorization" : `Bearer ${userToken}`
                    }
                }
            );

            const data = await response.json();

            if(data.success){

                console.log("USER PROFILE:", data.user);

                setUser(data.user);

                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );

                // Load normal and customized carts
                await Promise.all([
                    loadCartData(userToken),
                    loadCustomizedCartData(userToken)
                ]);

            } else {

                // User no longer exists or token is invalid
                localStorage.removeItem("token");
                localStorage.removeItem("user");

                setToken("");
                setUser(null);
                setCartItems({});
                setCustomizedCartItems([]);

                console.log(
                    "User not found. Logged out automatically."
                );

            }

        } catch (error) {
            console.log("User Profile Error:", error);
        }

    };

    useEffect(() => {

        const savedToken = localStorage.getItem("token");

        if(savedToken){
            setToken(savedToken);
            fetchUserProfile(savedToken);
        }

        fetchFoodList();

    }, []);

    // Clear customized cart state after logout
    useEffect(() => {
        if(!token){
            setCustomizedCartItems([]);
        }
    }, [token]);

    // Add Item(s) To Cart
    const addToCart = async (itemId, quantity = 1) => {
        
        if(!token){
            toast.error("Please login to add items to your cart.");
            return false;
        }

        if(!Number.isInteger(quantity) || quantity < 1 || quantity > 20){
            toast.error("Please select a valid quantity.");
            return false;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/user/cart/add`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        itemId,
                        quantity
                    })
                }
            );

            const data = await response.json();

            if(response.ok && data.success){
                
                setCartItems(data.cartData);

                // Display only ONE success notification
                toast.success(
                    data.message || "Item added to cart!",
                    {
                        position: "top-right",
                        autoClose: 2000
                    }
                );

                return true;

            } else {
                toast.error(data.message || "Failed to add item to cart.");
                return false;
            }
        } catch (error) {
            console.error("Add To Cart Error:", error);
            toast.error("Something went wrong while adding items.")

            return false;
        }

    }

    // Add food with selected size / add-ons
    const addCustomizedToCart = async (foodId, quantity = 1, selections = []) => {
        
        if(!token){
            toast.error("Please login to add items to your cart.");
            return false;
        }

        if(!Number.isInteger(quantity) || quantity < 1 || quantity > 20){
            toast.error("Quantity must be between 1 and 20.");
            return false;
        }

        if(!Array.isArray(selections)){
            toast.error("Invalid customization selections.");
            return false;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/user/custom-cart/add`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        foodId,
                        quantity,
                        selections
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                toast.error(data.message || "Failed to add customized food.");
                return false;
            }

            // Reload detailed customized cart
            const reloaded = await loadCustomizedCartData(token);

            if(!reloaded){
                toast.error("Food was saved, but the cart could not be refreshed.");
                return true;
            }

            toast.success(data.message || "Customized food added to cart!");

            return true;

        } catch (error) {
            console.error("Add Customized Cart Error:", error);
            toast.error("Something went wrong while adding customized food.");
            return false;
        }

    };

    // Remove Item From Cart
    const removeFromCart = async (itemId) => {

        if(!token){
            toast.error("Please login first.");
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/user/cart/remove`,
                {
                    method : "POST",

                    headers : {
                        "Content-Type" : "application/json",
                        "Authorization" : `Bearer ${token}`
                    },

                    body : JSON.stringify({
                        itemId : itemId
                    })
                }
            );

            const data = await response.json();

            if(data.success){
                setCartItems(data.cartData);
                toast.success(data.message || "Food Item removed from cart!", {
                    position: "top-right",
                    autoClose: 2000
                });
            } else {
                toast.error(data.message || "Failed to remove item from cart.");
            }

        } catch (error) {

            console.log(
                "Remove From Cart Error:", error
            );

            toast.error(
                "Something went wrong while removing item."
            );

        }

    };

    // Remove one quantity or all quantities of a customized variant
    const removeCustomizedFromCart = async (variantKey, removeAll = false) => {
        
        if(!token){
            toast.error("Please login first.");
            return false;
        }

        if(typeof variantKey !== "string" || !variantKey.trim()){
            toast.error("Invalid customized cart item.");
            return false;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/user/custom-cart/remove`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        variantKey,
                        removeAll
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                toast.error(data.message || "Failed to remove customized item.");
                return false;
            }

            const reloaded = await loadCustomizedCartData(token);

            if(!reloaded){
                toast.error("Cart was updated, but the latest items could not be loaded.");
                return true;
            }

            toast.success(data.message || "Customized cart updated!");

            return true;

        } catch (error) {
            console.error("Remove Customized Cart Error:", error);

            toast.error("Something went wrong while updating your cart.");

            return false;
        }

    }

    // Get Total Cart Amount
    const getTotalCartAmount = () => {

        let totalAmount = 0;

        for(const item in cartItems){

            if(cartItems[item] > 0){

                let itemInfo = food_list.find(
                    (product) => product._id === item
                );

                if(itemInfo){

                    totalAmount +=
                        itemInfo.price * cartItems[item];

                }

            }

        }

        return Number(totalAmount.toFixed(2));

    };

    // Get User Rating For A Food
    const getUserRating = async (foodId) => {

        if(!token){
            return 0;
        }

        try {

            const response = await fetch(
                `${API_URL}/api/rating/user/${foodId}`,
                {
                    method : "GET",

                    headers : {
                        "Authorization" : `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(data.success){
                return data.rating;
            }

            return 0;

        } catch (error) {

            console.log(
                "Get User Rating Error:",
                error
            );

            return 0;

        }

    };

    // Add / Update Rating
    const addRating = async (foodId, rating) => {

        if(!token){

            toast.error(
                "Please login to rate this food."
            );

            return false;
        }

        try {

            const response = await fetch(
                `${API_URL}/api/rating/add`,
                {
                    method : "POST",

                    headers : {
                        "Content-Type" : "application/json",
                        "Authorization" : `Bearer ${token}`
                    },

                    body : JSON.stringify({
                        foodId : foodId,
                        rating : rating
                    })
                }
            );

            const data = await response.json();

            if(data.success){

                toast.success(
                    "Rating saved successfully!"
                );

                return true;

            } else {

                toast.error(
                    data.message ||
                    "Failed to save rating."
                );

                return false;

            }

        } catch (error) {

            console.log(
                "Add Rating Error:",
                error
            );

            toast.error(
                "Something went wrong while saving rating."
            );

            return false;

        }

    };

    // Remove Rating
    const removeRating = async (foodId) => {

        if(!token){

            toast.error(
                "Please login first."
            );

            return false;
        }

        try {

            const response = await fetch(
                `${API_URL}/api/rating/remove/${foodId}`,
                {
                    method : "DELETE",

                    headers : {
                        "Authorization" : `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(data.success){

                toast.success(
                    "Rating removed successfully!"
                );

                return true;

            } else {

                toast.error(
                    data.message ||
                    "Failed to remove rating."
                );

                return false;

            }

        } catch (error) {

            console.log(
                "Remove Rating Error:",
                error
            );

            toast.error(
                "Something went wrong while removing rating."
            );

            return false;

        }

    };

    // Total of available customized cart items
    const getCustomizedCartTotal = () => {
        const totalCents = customizedCartItems.reduce((total, item) => {
            
            if(item.available !== true || !Number.isFinite(Number(item.lineTotal))){
                return total;
            }

            return total + Math.round(Number(item.lineTotal) * 100);

        }, 0);

        return totalCents / 100;
    }

    const contextValue = {

        food_list,
        cartItems,
        setCartItems,

        addToCart,
        removeFromCart,
        getTotalCartAmount,

        // Customized Cart
        customizedCartItems,
        customizedCartLoading,
        loadCustomizedCartData,
        addCustomizedToCart,
        removeCustomizedFromCart,
        getCustomizedCartTotal,

        token,
        setToken,

        user,
        setUser,

        fetchUserProfile,
        loadCartData,

        getUserRating,
        addRating,
        removeRating

    };

    return (
        <StoreContext.Provider value={contextValue}>
            {props.children}
        </StoreContext.Provider>
    );

};

export default StoreContextProvider;