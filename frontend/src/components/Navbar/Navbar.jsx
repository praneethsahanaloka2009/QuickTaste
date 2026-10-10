import React, { useState, useEffect, useContext, useRef } from 'react'
import './Navbar.css'
import { assets } from '../../assets/assets'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { StoreContext } from '../../context/StoreContext'
import { toast } from 'react-toastify'

const Navbar = ({setShowLogin, isLoggedIn}) => {

    const [menu, setMenu] = useState("home")
    const [showMenu, setShowMenu] = useState(false)

    const fileInputRef = useRef(null)

    const { getTotalCartAmount, token, setToken, user, setUser } = useContext(StoreContext);

    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {

        if (location.pathname === "/") {

            const handleScroll = () => {

                const exploreMenu = document.getElementById("explore-menu")

                if (!exploreMenu) {
                    setMenu("home")
                    return
                }

                const menuTop = exploreMenu.getBoundingClientRect().top

                if (menuTop <= 150) {
                    setMenu("menu")
                } else {
                    setMenu("home")
                }
            }

            handleScroll()

            window.addEventListener("scroll", handleScroll)

            return () => {
                window.removeEventListener("scroll", handleScroll)
            }

        }

        else if (location.pathname === "/mobile-app") {
            setMenu("mobile-app")
        }

        else if (location.pathname === "/contact") {
            setMenu("contact-us")
        }

        else {
            setMenu("")
        }

    }, [location.pathname])


    const handleHome = () => {

        setMenu("home")
        navigate("/")

        setTimeout(() => {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: "smooth"
            })
        }, 100)

    }


    const handleMenu = () => {

        setMenu("menu")
        navigate("/")

        setTimeout(() => {
            document.getElementById("explore-menu")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            })
        }, 100)

    }

    const handleMobileApp = () => {
        setMenu("mobile-app")
        navigate("/mobile-app")
    }


    const handleContact = () => {
        setMenu("contact-us")
        navigate("/contact")
    }

    const handleSignIn = () => {
        setShowLogin(true)
    }

    // Open file selector
    const handleUploadClick = () => {
        fileInputRef.current?.click()
    }

    // Upload profile picture
    const handleProfilePicture = async (event) => {

        const file = event.target.files[0]

        if(!file){
            return
        }

        // Check image type
        if(!file.type.startsWith("image/")){
            toast.error("Please select an image file.")
            return
        }

        // Check image size maximum 5MB
        if(file.size > 5 * 1024 * 1024){
            toast.error("Image size must be less than 5MB.")
            return
        }

        try {
            
            const token = localStorage.getItem("token")

            if(!token){
                toast.error("Please login first.")
                return
            }

            const formData = new FormData()

            formData.append("avatar", file)

            const response = await fetch("http://localhost:4911/api/user/profile-picture", {
                method : "POST",
                headers : {
                    "Authorization" : `Bearer ${token}`
                },
                body : formData
            })

            const data = await response.json()

            if(data.success){
                setUser(data.user)
                localStorage.setItem("user", JSON.stringify(data.user))
                toast.success("Profile picture updated successfully!")
            } else{
                toast.error(data.message || "Failed to upload profile picture.")
            }

        } catch (error) {
            console.log("Profile Picture Upload Error:", error)
            toast.error("Something went wrong while uploading.")
        }

        // Reset file input
        event.target.value = ""

    }

    // Remove profile picture
    const handleRemoveProfilePicture = async () => {

        try {
            
            const token = localStorage.getItem("token")

            if(!token){
                toast.error("Please login first.")
                return
            }

            const response = await fetch("http://localhost:4911/api/user/profile-picture",{
                method : "DELETE",
                headers : {
                    "Authorization" : `Bearer ${token}`
                }
            })

            const data = await response.json()

            if(data.success){
                setUser(data.user)
                localStorage.setItem("user", JSON.stringify(data.user))
                toast.success("Profile picture removed successfully!")
                setShowMenu(false)
            } else {
                toast.error(data.message || "Failed to remove profile picture.")
            }

        } catch (error) {
            console.log("Remove Profile Picture Error:", error)
            toast.error("Something went wrong while removing.")
        }

    }

    const handleLogout = () => {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        setToken("")
        setUser(null)
        setShowMenu(false)
    }

    return (
        <div className="navbar">

            <Link to="/">
                <img src={assets.logo} alt="" className="logo"/>
            </Link>

            <ul className="navbar-menu">
                <li className={menu === "home" ? "active" : ""} onClick={handleHome}>home</li>
                <li className={menu === "menu" ? "active" : ""} onClick={handleMenu}>menu</li>
                <li className={menu === "mobile-app" ? "active" : ""} onClick={handleMobileApp}>mobile-app</li>
                <li className={menu === "contact-us" ? "active" : ""} onClick={handleContact}>contact-us</li>
            </ul>

            <div className="navbar-right">

                <img src={assets.search_icon} alt=""/>
                <div className="navbar-search-icon">

                    <Link to='/cart' onClick={(e) => {
                        if(!isLoggedIn){
                            e.preventDefault()
                            toast.error("Please login to access your cart.")
                            setShowLogin(true)
                        }
                    }}>
                        <img src={assets.basket_icon} alt=""/>
                    </Link>
                    
                    <div className={getTotalCartAmount() === 0 ? "" : "dot"}></div>
                </div>
                
                {!isLoggedIn ? (
                    <button onClick={handleSignIn}>
                        Sign In
                    </button>
                ):(
                    <div className='profile-container'>
                        
                        {user ? (
                            user.avatar ? (
                                <img src={`http://localhost:4911/images/${user.avatar}`} className='profile' alt="Profile" onClick={() => setShowMenu(!showMenu)}/>
                            ) : (
                                <div className='profile profile-letter' onClick={() => setShowMenu(!showMenu)}>
                                    {user.name?.charAt(0)?.toUpperCase() || ""}
                                </div>
                            )
                        ) : (
                            <div className='profile profile-letter'></div>
                        )}

                        <input type="file" accept='image/*' ref={fileInputRef} onChange={handleProfilePicture} style={{ display : 'none' }}/>

                        {showMenu && user && (
                            <div className='profile-menu'>

                                {user.avatar ? (
                                    <button onClick={handleRemoveProfilePicture}>
                                        Remove Profile Picture
                                    </button>
                                ) : (
                                    <button onClick={handleUploadClick}>
                                        Upload Profile Picture
                                    </button>
                                )}

                                <button onClick={() => {navigate("/my-orders"); setShowMenu(false)}}>
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
    )
}

export default Navbar