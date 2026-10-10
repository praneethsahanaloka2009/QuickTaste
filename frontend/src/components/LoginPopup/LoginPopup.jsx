import React, { useEffect, useState, useContext } from "react"
import "./LoginPopup.css"
import { Link } from 'react-router-dom'
import { assets } from '../../assets/assets'
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'react-toastify';
import { StoreContext } from '../../context/StoreContext'

const LoginPopup = ({setShowLogin}) => {

    const [currentState, setCurrentState] = useState("Login")

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const { fetchUserProfile, setToken } = useContext(StoreContext)

    useEffect(() => {

        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = 'unset'
        }

    }, [])

    // Normal Login / Register
    const handleSubmit = async (event) => {

        event.preventDefault()

        try {
            
            const endpoint = currentState === "Login" ? "http://localhost:4911/api/user/login" : "http://localhost:4911/api/user/register"
            const body = currentState === "Login" ? {email, password} : {name, email, password}
            const response = await fetch(endpoint, {
                method : "POST",
                headers : {
                    "Content-Type" : "application/json"
                },
                body : JSON.stringify(body)
            })

            const data = await response.json()

            if(data.success){
                localStorage.setItem("token", data.token)
                setToken(data.token)

                await fetchUserProfile(data.token)

                if(currentState === "Login"){
                    toast.success("Login Successful!")
                } else {
                    toast.success("Register Successful!")
                }

                setShowLogin(false)

            } else {
                toast.error(data.message)
                console.log(data.message)
            }

        } catch (error) {
            console.log("Authentication Error:", error)
            toast.error("Something went wrong. Please try again.")
        }

    }

    // Google Login / Register
    const handleGoogleSuccess = async(credentialResponse) => {

        try {
            //  Select endpoint based on Login / Sign Up
            const endpoint = currentState === "Login" ? "http://localhost:4911/api/user/google-login" : "http://localhost:4911/api/user/google-register"
            const response = await fetch(endpoint, {
                method : "POST",
                headers : {
                    "Content-Type" : "application/json"
                },
                body : JSON.stringify({
                    credential : credentialResponse.credential
                })
            })

            const data = await response.json()

            if(data.success){
                localStorage.setItem("token", data.token)
                setToken(data.token)

                await fetchUserProfile (data.token)

                if(currentState === "Login"){
                    toast.success("Login Successful!")
                } else {
                    toast.success("Register Successful!")
                }

                setShowLogin(false)

            } else {
                toast.error(data.message)
                console.log(data.message)
            }

        } catch (error) {
            console.log("Google Authentication Error:", error)
            toast.error("Google Authentication failed. Please try again.")
        }

    }

    const handleGoogleError = () => {
        toast.error("Google Login Failed")
        console.log("Google Login Failed")
    }

    return (
        <div className="login-popup">
            
            <form className="popup-login-container" onSubmit={handleSubmit}>

                <div className="login-popup-title">
                    <h2>{currentState}</h2>
                    <img onClick={() => setShowLogin(false)} src={assets.cross_icon} alt="" />
                </div>

                <div className="login-popup-inputs">
                    {currentState === "Login" ? (
                        <></>
                    ) : (
                        <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required/>
                    )}
                    <input type="email" placeholder="Your Email" value={email} onChange={(e) => setEmail(e.target.value)} required/>
                    <input type="password" placeholder="Your Password" value={password} onChange={(e) => setPassword(e.target.value)} required/>
                </div>

                <button type="submit">
                    {currentState === "Sign Up" ? "Create an Account" : "Login"}
                </button>

                <div className="login-popup-social">
                    
                    <div className="google-login">
                        <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} text="continue_with"/>
                    </div>

                </div>

                <div className="login-popup-condition">
                    
                    <input type="checkbox" required/>

                    <p>
                        By continuing, I agree to the{" "} <Link to="/terms-of-use"> Terms of Use </Link>{" "}and{" "} <Link to="/privacy-policy"> Privacy Policy </Link>.
                    </p>

                </div>

                {currentState === "Login" ? (
                    <p> Create a new account?{" "} <span onClick={() => {setCurrentState("Sign Up")}}>Click here</span> </p>
                ) : (
                    <p> Already, have an account?{" "} <span onClick={() => {setCurrentState("Login")}}>Login here</span> </p>
                )}
                
            </form>
            
        </div>
    )

}

export default LoginPopup