import React, { useEffect, useState, useContext } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./PaymentSuccess.css";
import { StoreContext } from "../../context/StoreContext";

const API_URL = "http://localhost:4911/api/payment";

const PaymentSuccess = () => {

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false);

    const { setCartItems } = useContext(StoreContext);

    useEffect(() => {
        let cancelled = false;
        
        const verifyPayment = async () => {
            const sessionId = searchParams.get("session_id");

            if(!sessionId){
                if(!cancelled){
                    toast.error("Stripe payment session was not found.");
                    setLoading(false);
                }
                return;
            }

            try {
                const token = localStorage.getItem("token");

                if(!token){
                    if(!cancelled){
                        toast.error("Please log in again.");
                        setLoading(false);
                    }
                    return;
                }

                const response = await fetch(`${API_URL}/stripe/verify`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ sessionId })
                    }
                );

                const data = await response.json();

                if(cancelled) return;

                if(!response.ok || !data.success){
                    toast.error(
                        data.message || "Payment verification failed."
                    );
                    setSuccess(false);
                    return;
                }

                setCartItems({});
                setSuccess(true);

                toast.success(
                    "Payment successful! Your order has been placed."
                );
                
            } catch(error) {
                if(cancelled) return;

                console.error("Payment Verification Error:", error);

                toast.error(
                    "Something went wrong while verifying payment."
                );
            } finally {
                if(!cancelled){
                    setLoading(false);
                }
            }
        };

        verifyPayment();

        return () => {
            cancelled = true;
        };

    },[searchParams, setCartItems]);

    // Payment verification loading
    if(loading){
        return (
            <div className="payment-success-page">
                <div className="payment-success-container">
                    
                    <h2>Verifying Payment...</h2>
                    <p>Please wait while we confirm your payment and create your order.</p>

                </div>
            </div>
        );
    }
    
    // Payment verification failed
    if (!success){
        return (
            <div className="payment-success-page">
                <div className="payment-success-container">
                    
                    <h2>Payment Verification Failed</h2>
                    <p>We could not verify your payment.</p>

                    <button onClick={() => navigate("/cart")}>
                        BACK TO CART
                    </button>

                </div>
            </div>
        );
    }

    // Payment verified + Order created
    return (
        <div className="payment-success-page">
            <div className="payment-success-container">
                
                <div className="success-icon">
                    ✓
                </div>

                <h2>Payment Successful!</h2>

                <p>Your payment has been successfully completed.</p>
                <p>Your order has been placed successfully.</p>
                <p>Your order is awaiting confirmation.</p>

                <button onClick={() => navigate("/my-orders")}>
                    VIEW MY ORDERS
                </button>

            </div>
        </div>
    )
}

export default PaymentSuccess;