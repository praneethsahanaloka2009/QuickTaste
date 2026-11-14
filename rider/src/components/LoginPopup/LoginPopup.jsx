import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Bike, Mail, Lock, User, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api.js";
import { useRider } from "../../context/RiderContext.jsx";
import "./LoginPopup.css";

function LoginPopup() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useRider();

    const isRegister = location.pathname === "/register";

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    const goToNextPage = (rider) => {
        if(!rider?.name?.trim() || !rider?.phone?.trim()){
            navigate("/complete-profile", { replace: true });
        } else {
            navigate("/dashboard", { replace: true });
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if(loading){
            return;
        }

        const email = formData.email.trim().toLowerCase();
        const password = formData.password;

        if(!email || !password){
            toast.error("Please enter your email and password.");
            return;
        }

        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
            toast.error("Please enter a valid email address.");
            return;
        }

        if(isRegister && (password.length < 8 || password.length > 128)){
            toast.error("Password must contain 8–128 characters.");
            return;
        }

        setLoading(true);

        try {
            const endpoint = isRegister ? "/register" : "/login";

            const response = await api.post(endpoint, {email, password});

            const data = response.data;

            if(!data.success || !data.token || !data.rider){
                toast.error(data.message || "Authentication failed.");
                return;
            }

            const loggedIn = login(data.rider, data.token, false);

            if(!loggedIn){
                return;
            }

            toast.success(isRegister ? "Registration Successful!" : "Login Successful!")

            goToNextPage(data.rider);
        } catch (error) {
            const message = error.response?.data?.message || (isRegister ? "Registration failed. Please try again." : "Login failed. Please check your credentials.");
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    const handleGoogleSuccess = async (credentialResponse) => {
        if(loading){
            return;
        }

        const credential = credentialResponse?.credential;

        if(!credential){
            toast.error("Google authentication did not return a credential.");
            return;
        }

        setLoading(true);

        try {
            const endpoint = isRegister ? "/google-register" : "/google-login";

            // Google provides identity and email.
            // Phone and vehicle details are collected on the profile page.
            const response = await api.post(endpoint, { credential });
            const data = response.data;

            if(!data.success || !data.token || !data.rider){
                toast.error(data.message || "Google authentication failed.");
                return;
            }

            const loggedIn = login(data.rider, data.token, false);

            if(!loggedIn){
                return;
            }

            toast.success(isRegister ? "Google Registration Successful!" : "Google Login Successful!")

            goToNextPage(data.rider);
        } catch (error) {
            const message = error.response?.data?.message || "Google authentication failed. Please try again.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rider-auth-page">
            <div className="rider-auth-card">
                <Link to="/login" className="rider-auth-logo">
                    <span className="rider-logo-icon">
                        <Bike size={28}/>
                    </span>
                    
                    <span>
                        <strong>QuickTaste</strong>
                        <small>Rider Portal</small>
                    </span>
                </Link>

                <div className="rider-auth-heading">
                    <div className="rider-auth-badge">
                        {isRegister ? (
                            <User size={22}/>
                        ) : (
                            <ShieldCheck size={22}/>
                        )}
                    </div>

                    <h1>{isRegister ? "Create Rider Account" : "Welcome Back"}</h1>

                    <p>{isRegister ? "Register to start your QuickTaste rider journey." : "Log in to manage your deliveries."}</p>
                </div>

                <form className="rider-auth-form" onSubmit={handleSubmit}>
                    <label htmlFor="rider-email">Email Address</label>

                    <div className="rider-input-wrapper">
                        <Mail size={19}/>

                        <input id="rider-email" type="email" name="email" placeholder="Enter Your Email" value={formData.email} onChange={handleChange} autoComplete="email" required disabled={loading}/>
                    </div>

                    <label htmlFor="rider-password">Password</label>

                    <div className="rider-input-wrapper">
                        <Lock size={19}/>

                        <input id="rider-password" type="password" name="password" placeholder={isRegister ? "At least 8 characters" : "Enter your password"} value={formData.password} onChange={handleChange} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : undefined} maxLength={128} required disabled={loading}/>
                    </div>

                    <button type="submit" className="rider-auth-submit" disabled={loading}>
                        {loading ? "Please wait..." : isRegister ? "Create Account" : "Log In"}

                        {!loading && <ArrowRight size={19}/>}
                    </button>
                </form>

                <div className="rider-auth-divider">
                    <span/>
                    <p>OR CONTINUE WITH</p>
                    <span/>
                </div>

                <div className="rider-google-button">
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => {toast.error("Google authentication was cancelled or failed.");}} text={isRegister ? "signup_with" : "signin_with"} shape="rectangular" theme="outline" size="large" width="320"/>
                </div>

                <p className="rider-auth-switch">
                    {isRegister ? "Already have a rider account?" : "New to QuickTaste Rider?"}

                    <Link to={isRegister ? "/login" : "/register"}>
                        {isRegister ? " Log In" : " Create Account"}
                    </Link>
                </p>

                <div className="rider-auth-security">
                    <ShieldCheck size={16}/>

                    <span>
                        Secure authentication for QuickTaste Riders.
                    </span>
                </div>
            </div>

            <div className="rider-auth-footer">
                <p>© {new Date().getFullYear()} QuickTaste. Rider Portal.</p>
            </div>
        </div>
    );
}

export default LoginPopup;