import React, { useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import './Payment.css'

const API_URL = "http://localhost:4911/api/payment";

const Payment = () => {

    const location = useLocation()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(false)

    const { formData, subtotal, discountAmount, promoCode, deliveryFee, total } = location.state || {}

    // If payment pase is opened directly without order details
    if(!formData){
        return (
            <div className="payment-page">
                <div className="payment-empty">

                    <h2>Payment Information Not Found</h2>
                    <p>Please complete your delivery information first.</p>

                    <button onClick={() => navigate("/order")}>
                        BACK TO ORDER
                    </button>

                </div>
            </div>
        );
    }

    const handlePayment = async () => {
        if(loading) return;

        const token = localStorage.getItem("token");

        if(!token) {
            toast.error("Please login to continue.");
            return;
        }

        setLoading(true);

        try {

            const response = await fetch(`${API_URL}/stripe/create-session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    formData,
                    promoCode: promoCode || ""
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                toast.error(
                    data.message || "Unable to start Stripe payment."
                );
                return;
            }

            if(!data.url){
                toast.error( "Stripe checkout URL was not returned." );
                return;
            }

            // Redirect to Stripe Checkout
            window.location.assign(data.url);
            
        } catch (error) {
            console.error("Stripe Payment Error:", error);

            toast.error(
                "Something went wrong while starting the payment."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="payment-page">
            <div className="payment-container">
                <div className="payment-left">
                    
                    <h2>Payment</h2>

                    <p className="payment-subtitle">
                        Pay securely using your credit or debit card.
                    </p>

                    <div className="payment-method">
                        <h3>Payment Method</h3>
                        <label className="payment-option">
                            <input type="radio" name="payment" value="stripe" checked readOnly/>
                            <span>Stripe (Credit / Debit Card)</span>
                        </label>
                    </div>

                    <div className="payment-coming-soon">
                        <h3>Secure Payment</h3>
                        <p>You will be redirected to our secure payment gateway to complete your payment.</p>
                    </div>

                    <button className="pay-button" onClick={handlePayment} disabled={loading}>
                        {loading ? "PROCESSING..." : `PAY $${Number(total).toFixed(2)}`}
                    </button>

                    <button className="back-button" onClick={() => navigate("/order")} disabled={loading}>
                        BACK TO DELIVERY INFORMATION
                    </button>

                </div>
                
                <div className="payment-right">
                    <h2>Order Summary</h2>

                    <div className="delivery-summary">

                        <h3>Delivery Information</h3>

                        <p>
                            {formData.firstName} {formData.lastName}
                        </p>

                        <p>
                            {formData.street}
                        </p>

                        <p>
                            {formData.city}, {formData.state}
                        </p>

                        <p>
                            {formData.zipCode}
                        </p>

                        <p>
                            {formData.country}
                        </p>

                        <p>
                            {formData.phone}
                        </p>
                        
                    </div>

                    <div className="summary-totals">
                        
                        {/* Subtotal */}
                        <div>
                            <span>Subtotal</span>
                            <span>${Number(subtotal).toFixed(2)}</span>
                        </div>

                        <hr />

                        {/* Discount */}
                        {Number(discountAmount) > 0 && (
                            <>
                                <div>
                                    <span>
                                        Discount {promoCode && `(${promoCode})`}
                                    </span>

                                    <span>
                                        -${Number(discountAmount).toFixed(2)}
                                    </span>
                                </div>
                                <hr />
                            </>
                        )}

                        {/* Delivery Fee */}
                        <div>
                            <span>Delivery Fee</span>
                            <span>${Number(deliveryFee).toFixed(2)}</span>
                        </div>

                        <hr />

                        <div className="summary-total">
                            <b>Total</b>
                            <b>${Number(total).toFixed(2)}</b>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )

}

export default Payment