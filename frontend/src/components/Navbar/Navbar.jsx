import React, { useState, useEffect, useContext, useRef } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";

// Backend API Configuration
import { API_URL, getImageUrl } from "../../config/api";

const Navbar = ({ setShowLogin, isLoggedIn }) => {

    const [menu, setMenu] = useState("home");
    const [showMenu, setShowMenu] = useState(false);

    const profileMenuRef = useRef(null);

    const {getTotalCartAmount, customizedCartItems, token, setToken, user, setUser} = useContext(StoreContext);

    const navigate = useNavigate();
    const location = useLocation();

    // Normal cart items
    const hasRegularItems = getTotalCartAmount() > 0;

    // Customized cart items
    const hasCustomizedItems = Array.isArray(customizedCartItems) && customizedCartItems.some((item) => Number(item.quantity) > 0);

    // Either cart contains items
    const hasCartItems = hasRegularItems || hasCustomizedItems;

    // Close profile menu on outside click / Escape
    useEffect(() => {

        if(!showMenu){
            return;
        }

        const handleOutsideClick = (event) => {

            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)){
                setShowMenu(false);
            }
        };

        const handleEscapeKey = (event) => {

            if(event.key === "Escape"){
                setShowMenu(false);
            }
        };

        document.addEventListener("pointerdown", handleOutsideClick);
        document.addEventListener("keydown", handleEscapeKey);

        return () => {
            document.removeEventListener("pointerdown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscapeKey);
        };

    }, [showMenu]);

    // Active menu based on route and scroll
    useEffect(() => {

        if (location.pathname === "/") {

            const handleScroll = () => {

                const exploreMenu = document.getElementById("explore-menu");

                if(!exploreMenu){
                    setMenu("home");
                    return;
                }

                const menuTop =
                    exploreMenu.getBoundingClientRect().top;

                if(menuTop <= 150){
                    setMenu("menu");
                } else {
                    setMenu("home");
                }
            };

            handleScroll();

            window.addEventListener(
                "scroll",
                handleScroll
            );

            return () => {
                window.removeEventListener(
                    "scroll",
                    handleScroll
                );
            };
        }

        else if(location.pathname === "/mobile-app"){
            setMenu("mobile-app");
        }

        else if(location.pathname === "/contact"){
            setMenu("contact-us");
        }

        else {
            setMenu("");
        }

    }, [location.pathname]);

    // Home Navigation
    const handleHome = () => {

        setMenu("home");
        navigate("/");

        setTimeout(() => {
            window.scrollTo({top: 0, left: 0, behavior: "smooth"});
        }, 100);
    };

    // Explore Menu Navigation
    const handleMenu = () => {

        setMenu("menu");
        navigate("/");

        setTimeout(() => {
            document.getElementById("explore-menu") ?.scrollIntoView({behavior: "smooth", block: "start"});
        }, 100);
    };

    const handleMobileApp = () => {
        setMenu("mobile-app");
        navigate("/mobile-app");
    };

    const handleContact = () => {
        setMenu("contact-us");
        navigate("/contact");
    };

    const handleSignIn = () => {
        setShowLogin(true);
    };

    // Upload Profile Picture
    const handleProfilePicture = async (event) => {

        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if(!file.type.startsWith("image/")){
            toast.error("Please select an image file.");
            event.target.value = "";
            return;
        }

        if(file.size > 5 * 1024 * 1024){
            toast.error("Image size must be less than 5MB.");
            event.target.value = "";
            return;
        }

        try {

            const userToken = localStorage.getItem("token");

            if(!userToken){
                toast.error("Please login first.");
                return;
            }

            const formData = new FormData();
            formData.append("avatar", file);

            const response = await fetch(
                `${API_URL}/api/user/profile-picture`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${userToken}`
                    },
                    body: formData
                }
            );

            const data = await response.json();

            if(data.success){

                setUser(data.user);

                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );

                toast.success("Profile picture updated successfully!");

            } else {
                toast.error(data.message || "Failed to upload profile picture.");
            }

        } catch (error) {
            console.log("Profile Picture Upload Error:", error);
            toast.error("Something went wrong while uploading.");
        } finally {
            event.target.value = "";
        }
    };

    // Remove Profile Picture
    const handleRemoveProfilePicture = async () => {

        try {

            const userToken = localStorage.getItem("token");

            if(!userToken){
                toast.error("Please login first.");
                return;
            }

            const response = await fetch(
                `${API_URL}/api/user/profile-picture`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${userToken}`
                    }
                }
            );

            const data = await response.json();

            if(data.success){
                setUser(data.user);
                localStorage.setItem("user", JSON.stringify(data.user));
                toast.success("Profile picture removed successfully!");
                setShowMenu(false);
            } else {
                toast.error(data.message || "Failed to remove profile picture.");
            }

        } catch (error) {

            console.log("Remove Profile Picture Error:", error);
            toast.error("Something went wrong while removing.");
        }
    };

    // Logout
    const handleLogout = () => {

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        setToken("");
        setUser(null);
        setShowMenu(false);
    };

    return (

        <div className="navbar">

            <Link to="/">
                <img src={assets.logo} alt="" className="logo"/>
            </Link>

            <ul className="navbar-menu">

                <li className={menu === "home" ? "active" : ""} onClick={handleHome}>
                    home
                </li>

                <li className={menu === "menu" ? "active" : ""} onClick={handleMenu}>
                    menu
                </li>

                <li className={menu === "mobile-app" ? "active" : ""} onClick={handleMobileApp}>
                    mobile-app
                </li>

                <li className={menu === "contact-us" ? "active" : ""} onClick={handleContact}>
                    contact-us
                </li>

            </ul>

            <div className="navbar-right">

                <img src={assets.search_icon} alt=""/>

                <div className="navbar-search-icon">

                    <Link to="/cart" onClick={(event) => {
                        if(!isLoggedIn){
                            event.preventDefault();
                            toast.error("Please login to access your cart.");
                            setShowLogin(true);
                        }
                    }}>
                        <img src={assets.basket_icon} alt=""/>
                    </Link>

                    {isLoggedIn && hasCartItems && (
                        <div className="dot"></div>
                    )}

                </div>

                {!isLoggedIn ? (

                    <button onClick={handleSignIn}>
                        Sign In
                    </button>

                ) : (

                    <div className="profile-container" ref={profileMenuRef}>

                        {user ? (

                            user.avatar ? (

                                <img src={getImageUrl(user.avatar)} className="profile" alt="Profile" onClick={() => setShowMenu(!showMenu)}/>

                            ) : (

                                <div className="profile profile-letter" onClick={() => setShowMenu(!showMenu)}>
                                    {user.name ?.charAt(0) ?.toUpperCase() || ""}
                                </div>

                            )

                        ) : (

                            <div className="profile profile-letter"></div>

                        )}

                        {showMenu && user && (

                            <div className="profile-menu">

                                <button onClick={() => {navigate("/profile"); setShowMenu(false);}}>
                                    My Profile
                                </button>

                                <button onClick={() => {navigate("/my-orders"); setShowMenu(false);}}>
                                    My Orders
                                </button>

                                <button onClick={handleLogout}>
                                    Logout
                                </button>

                            </div>

                        )}

                    </div>

                )}

            </div>

        </div>
    );
};

export default Navbar;