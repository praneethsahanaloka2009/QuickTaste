import React, { useEffect, useState} from 'react'
import "./Auth.css"
import { Link } from 'react-router-dom'
import { assets } from '../../assets/assets.js'
import { FcGoogle } from "react-icons/fc";
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'react-toastify';

const Auth = ({setShowAuth, setIsLoggedIn}) => {

    const [currentState, setCurrentState] = useState("Login")

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    useEffect(() => {

        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = 'unset'
        }

    }, [])

    // Normal Login / Register
    const handleSubmit = async (e) => {

        e.preventDefault()

        try {
            
            const endpoint = currentState === "Login" ? "http://localhost:4911/api/admin/login" : "http://localhost:4911/api/admin/register"
            const body = currentState === "Login" ? { email, password } : { name, email, password }
            const response = await fetch(endpoint, {
                method : "POST",
                headers : {
                    "Content-Type" : "application/json"
                },
                body : JSON.stringify(body)
            })

            const data = await response.json()

            if(data.success){

                localStorage.setItem("adminToken", data.token)

                setIsLoggedIn(true)
                setShowAuth(false)

                if(currentState === "Login"){
                    toast.success("Login Successful!")
                } else {
                    toast.success("Register Successful!")
                }

            } else {

                toast.error(data.message)

            }

        } catch (error) {
            
            console.log("Admin Authentication Error:",error)
            toast.error("Something went wrong. Please try again!")

        }

    }

    // Google Login / Register
    const handleGoogleSuccess = async (credentialResponse) => {

        try {
            
            const endpoint = currentState === "Login" ? "http://localhost:4911/api/admin/google-login" : "http://localhost:4911/api/admin/google-register"

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

                localStorage.setItem("adminToken", data.token)

                setIsLoggedIn(true)
                setShowAuth(false)

                if(currentState === "Login"){
                    toast.success("Google Login Successful!")
                } else {
                    toast.success("Google Register Successful!")
                }

            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log("Google Admin Authentication Error:", error)
            toast.error("Something went wrong. Please try again!")
        }

    }

    const handleGoogleError = () => {
        toast.error("Google Authentication Failed!")
    }

    return (
        <div className="login-popup">
            <form className='popup-login-container' onSubmit={handleSubmit}>

                <div className="login-popup-title">
                    <h2>{currentState}</h2>
                    <img onClick={() => setShowAuth(false)} src={assets.cross_icon} alt=""/>
                </div>

                <div className="login-popup-inputs">
                    {currentState === "Login" ? (
                        <></>
                    ) : (
                        <input type="text" placeholder='Your Name' value={name} onChange={(e) => setName(e.target.value)} required/>
                    )}
                    <input type="email" placeholder='Your Email' value={email} onChange={(e) => setEmail(e.target.value)} required/>
                    <input type="password" placeholder='Your Password' value={password} onChange={(e) => setPassword(e.target.value)} required/>
                </div>

                <button type="submit">{currentState === "Sign Up" ? "Create an Admin Account" : "Login"}</button>

                <div className="login-popup-social">
                    
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} text="continue_with" width="100%"/>
                    
                </div>

                <div className="login-popup-condition">
                    <input type="checkbox" required/>
                    <p>By continuing, I agree to the{" "}<Link to="/terms-of-use">Terms of Use</Link>{" "}and{" "}<Link to="/privacy-policy">Privacy Policy</Link>.</p>
                </div>

                {currentState === "Login" ? (
                    <p>Create a new admin account?{" "} <span onClick={() => setCurrentState("Sign Up")}>Click here</span></p>
                ) : (
                    <p>Already, have an admin account?{" "} <span onClick={() => setCurrentState("Login")}>Login here</span></p>
                )}

            </form>
        </div>
    )

}

export default Auth