import React, { useContext, useState } from "react";
import { StoreContext } from "../../context/StoreContext";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./Payment.css";

const API_URL = "/api/payment";

const Payment = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { setCartItems, loadCartData, loadCustomizedCartData, customizedCartItems, customizedCartLoading } = useContext(StoreContext);

    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState("stripe");

    // Temporary protection until customized payments are tested
    const CUSTOMIZED_PAYMENT_TESTED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_CUSTOMIZED_PAYMENT_TEST === "true";

    const containsCustomizedItems = location.state?.containsCustomizedItems === true || (Array.isArray(customizedCartItems) && customizedCartItems.length > 0);

    const { formData, subtotal, discountAmount, promoCode, deliveryFee, deliveryLocation, total, selectedOffer } = location.state || {};

    // Display the checkout amounts already calculated by the backend checkout summary endpoint.
    const safeSubtotal = Number(subtotal) || 0;

    const safeDiscountAmount = Number(discountAmount) || 0;

    const effectiveDeliveryFee = Number(deliveryFee ?? 0);

    const effectiveTotal = Number(total ?? 0);

    const hasValidDeliveryLocation = deliveryLocation && typeof deliveryLocation.latitude === "number" && typeof deliveryLocation.longitude === "number" && Number.isFinite(deliveryLocation.latitude) && Number.isFinite(deliveryLocation.longitude) && deliveryLocation.latitude >= -90 && deliveryLocation.latitude <= 90 && deliveryLocation.longitude >= -180 && deliveryLocation.longitude <= 180;

    // Start Stripe Checkout
    const handlePayment = async () => {
        if(customizedCartLoading || (containsCustomizedItems && !CUSTOMIZED_PAYMENT_TESTED)){
            toast.info("Customized payment verification is not complete yet.");
            return;
        }

        if(loading) return;

        const token = localStorage.getItem("token");

        if(!token){
            toast.error("Please login to continue.");
            navigate("/");
            return;
        }

        if(!formData){
            toast.error("Delivery information is missing.");
            navigate("/order");
            return;
        }

        if(!hasValidDeliveryLocation){
            toast.error("Please select your delivery location on the map.");
            navigate("/order");
            return;
        }

        if(effectiveTotal <= 0){
            toast.error("Invalid payment amount.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/stripe/create-session`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        formData,
                        promoCode: promoCode || "",
                        selectedOffer: selectedOffer === 2 ? 2 : 1,
                        deliveryLocation
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                toast.error(data.message || "Unable to start Stripe payment.");
                return;
            }

            if(!data.checkoutUrl){
                toast.error(
                    "Stripe Checkout URL was not returned."
                );
                return;
            }

            // Redirect to Stripe-hosted Checkout.
            window.location.href = data.checkoutUrl;

        } catch (error) {
            console.error("Stripe Payment Error:", error);

            toast.error(
                "Something went wrong while starting the payment."
            );
        } finally {
            setLoading(false);
        }
    };

    // Create Cash on Delivery Order
    const handleCodOrder = async () => {
        if(customizedCartLoading || (containsCustomizedItems && !CUSTOMIZED_PAYMENT_TESTED)){
            toast.info("Customized payment verification is not complete yet.");
            return;
        }

        if(loading){
            return;
        }

        const token = localStorage.getItem("token");

        if(!token){
            toast.error("Please login to continue.");
            navigate("/");
            return;
        }

        if(!formData){
            toast.error("Delivery information is missing.");
            navigate("/order");
            return;
        }

        if(!hasValidDeliveryLocation){
            toast.error("Please select your delivery location on the map.");
            navigate("/order");
            return;
        }

        if(effectiveTotal <= 0){
            toast.error("Invalid order amount.");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/cod/create-order`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        formData,
                        promoCode: promoCode || "",
                        selectedOffer: selectedOffer === 2 ? 2 : 1,
                        deliveryLocation
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                toast.error(data.message || "Unable to place your order.");
                return;
            }

            // Refresh both carts after successful COD order.
            // The backend is responsible for clearing saved cart data.
            setCartItems({});

            try {
                await Promise.all([
                    loadCartData(token),
                    loadCustomizedCartData(token)
                ]);
            } catch (cartError) {
                console.error("Post-order cart refresh error:", cartError);
            }

            toast.success("Your order has been placed successfully!");
            navigate("/", { replace: true });

        } catch (error) {
            console.error("COD Order Error:", error);
            toast.error("Something went wrong while placing your order.");
        } finally {
            setLoading(false);
        }
    }

    // If payment page is opened without order details
    if (!formData) {
        return (
            <div className="payment-page">
                <div className="payment-empty">
                    <h2>Payment Information Not Found</h2>

                    <p>
                        Please complete your delivery information first.
                    </p>

                    <button onClick={() => navigate("/order")}>
                        BACK TO ORDER
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="payment-page">
            <div className="payment-container">
                <div className="payment-left">
                    <h2>Payment</h2>

                    <p className="payment-subtitle">
                        Choose your preferred payment method to complete your order.
                    </p>

                    <div className="payment-method">
                        <h3>Payment Method</h3>

                        <label className="payment-option">
                            <input type="radio" name="payment" value="stripe" checked={paymentMethod === "stripe"} onChange={() => setPaymentMethod("stripe")}/>
                            <span>Stripe (Credit / Debit Card)</span>
                        </label>

                        <label className="payment-option">
                            <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")}/>
                            <span>Cash on Delivery (COD)</span>
                        </label>
                    </div>

                    <div className="payment-coming-soon">
                        <h3>{paymentMethod === "stripe" ? "Secure Online Payment" : "Cash on Delivery"}</h3>

                        <p>
                            {paymentMethod === "stripe" ? "You will be redirected to Stripe's secure checkout page to complete your payment." : "Pay for your order in cash when it arrives at your delivery address."}
                        </p>
                    </div>

                    <button className="pay-button" onClick={paymentMethod === "stripe" ? handlePayment : handleCodOrder} disabled={loading || customizedCartLoading || (containsCustomizedItems && !CUSTOMIZED_PAYMENT_TESTED)}>
                        {loading ? "PROCESSING..." : paymentMethod === "stripe" ? `PAY WITH STRIPE — $${effectiveTotal.toFixed(2)}` : `PLACE COD ORDER — $${effectiveTotal.toFixed(2)}`}
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

                        <p>{formData.street}</p>

                        <p>
                            {formData.city}, {formData.state}
                        </p>

                        <p>{formData.zipCode}</p>

                        <p>{formData.country}</p>

                        <p>{formData.phone}</p>

                        {hasValidDeliveryLocation && (
                            <p>
                                <strong>GPS Location:</strong>{" "}
                                {deliveryLocation.latitude.toFixed(6)},{" "}
                                {deliveryLocation.longitude.toFixed(6)}
                            </p>
                        )}
                    </div>

                    <div className="summary-totals">
                        <div>
                            <span>Subtotal</span>

                            <span>
                                ${safeSubtotal.toFixed(2)}
                            </span>
                        </div>

                        <hr />

                        {safeDiscountAmount > 0 && (
                            <>
                                <div>
                                    <span>
                                        Discount{" "}
                                        {promoCode
                                            ? `(${promoCode})`
                                            : ""}
                                    </span>

                                    <span>
                                        -$
                                        {safeDiscountAmount.toFixed(2)}
                                    </span>
                                </div>

                                <hr />
                            </>
                        )}

                        <div>
                            <span>Delivery Fee</span>

                            <span>
                                {effectiveDeliveryFee === 0
                                    ? "FREE"
                                    : `$${effectiveDeliveryFee.toFixed(2)}`}
                            </span>
                        </div>

                        <hr />

                        <div className="summary-total">
                            <b>Total</b>

                            <b>
                                ${effectiveTotal.toFixed(2)}
                            </b>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Payment;