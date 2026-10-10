import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

export const StoreContext = createContext(null)

const StoreContextProvider = (props) => {

    const [cartItems, setCartItems] = useState({});
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
                "http://localhost:4911/api/food/list"
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

    // Fetch Cart From Backend
    const loadCartData = async (userToken) => {

        try {

            const response = await fetch(
                "http://localhost:4911/api/user/cart",
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
                "http://localhost:4911/api/user/profile",
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

                loadCartData(userToken);

            } else {

                // User no longer exists or token is invalid
                localStorage.removeItem("token");
                localStorage.removeItem("user");

                setToken("");
                setUser(null);
                setCartItems({});

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

    // Add Item To Cart
    const addToCart = async (itemId) => {

        if(!token){
            toast.error("Please login to add items to your cart.");
            return;
        }

        try {

            const response = await fetch(
                "http://localhost:4911/api/user/cart/add",
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

            } else {

                toast.error(
                    data.message ||
                    "Failed to add item to cart."
                );

            }

        } catch (error) {

            console.log("Add To Cart Error:", error);

            toast.error(
                "Something went wrong while adding item."
            );

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
                "http://localhost:4911/api/user/cart/remove",
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

            } else {

                toast.error(
                    data.message ||
                    "Failed to remove item from cart."
                );

            }

        } catch (error) {

            console.log(
                "Remove From Cart Error:",
                error
            );

            toast.error(
                "Something went wrong while removing item."
            );

        }

    };

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
                `http://localhost:4911/api/rating/user/${foodId}`,
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
                "http://localhost:4911/api/rating/add",
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
                `http://localhost:4911/api/rating/remove/${foodId}`,
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

    const contextValue = {

        food_list,
        cartItems,
        setCartItems,

        addToCart,
        removeFromCart,

        getTotalCartAmount,

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