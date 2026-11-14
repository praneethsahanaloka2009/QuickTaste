import React, { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, Mail, RefreshCw, ShieldCheck, Truck, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import { StoreContext } from "../../context/StoreContext";
import "./DeliveryVerification.css";

const API_URL = "http://localhost:4911";

const DeliveryVerification = () => {
    const { orderId } = useParams();
    const { token } = useContext(StoreContext);

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const verified = Boolean(order?.deliveryOtpVerifiedAt);
    const eligible = order?.orderStatus === "Out for Delivery" && !verified;

    useEffect(() => {
        if(!token || !orderId){
            setLoading(false);
            return;
        }

        let active = true;

        const fetchOrder = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/api/order/${orderId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if(!response.ok || !data.success){
                    throw new Error(data.message || "Unable to load order.");
                }

                if(active){
                    setOrder(data.order);
                    setError("");
                }
            } catch (error) {
                if(active){
                    setError(error.message);
                }
            } finally {
                if(active){
                    setLoading(false);
                }
            }
        };

        fetchOrder();

        return () => {
            active = false;
        };
    }, [orderId, token]);

    useEffect(() => {
        if(cooldown <= 0){
            return;
        }

        const timer = setTimeout(() => {
            setCooldown((previous) => Math.max(previous - 1, 0));
        }, 1000);

        return () => {
            clearTimeout(timer);
        }
    }, [cooldown]);

    const handleSendOtp = async () => {
        if(!eligible || sending || cooldown > 0){
            return;
        }

        setSending(true);
        setError("");

        try {
            const response = await fetch(
                `${API_URL}/api/delivery-otp/${orderId}/send-otp`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(
                    data.message || "Unable to send delivery OTP."
                );
            }

            setSent(true);
            setCooldown(60);
            toast.success("Delivery OTP sent to your email!");
        } catch (error) {
            setError(error.message);
            toast.error(error.message);
        } finally {
            setSending(false);
        }
    };

    if(loading){
        return (
            <main className="dv-page">
                <div className="dv-loading">
                    Loading delivery information...
                </div>
            </main>
        );
    }

    if(!order){
        return (
            <main className="dv-page">
                <div className="dv-message-card">
                    <AlertCircle size={32}/>
                    <h2>Order Not Available</h2>
                    <p>{error || "Unable to find this order."}</p>
                    <Link to="/my-orders">Back to My Orders</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="dv-page">
            <div className="dv-container">
                <Link to="/my-orders" className="dv-back">
                    <ArrowLeft size={17}/>
                    Back to My Orders
                </Link>

                <div className="dv-heading">
                    <span className="dv-eyebrow">
                        QUICKTASTE SECURE DELIVERY
                    </span>
                    <h1>Delivery Verification</h1>
                    <p>
                        Verify your food delivery securely with an one-time code sent to your email.
                    </p>
                </div>

                <div className="dv-card">
                    <div className="dv-card-header">
                        <div className="dv-shield">
                            <ShieldCheck size={30}/>
                        </div>
                        <h2>
                            {verified ? "Delivery Verified" : "Secure Your Delivery"}
                        </h2>
                        <p>
                            {verified ? "Your delivery verification has been completed." : "Request your delivery code when your rider is arriving."}
                        </p>
                    </div>

                    <div className="dv-card-body">
                        <div className="dv-order-info">
                            <div>
                                <span>ORDER NUMBER</span>
                                <strong>
                                    #{String(order._id).slice(-8).toUpperCase()}
                                </strong>
                            </div>
                            <div>
                                <span>DELIVERY STATUS</span>
                                <strong className="dv-status">
                                    <Truck size={16}/>
                                    {order.orderStatus}
                                </strong>
                            </div>
                        </div>

                        {verified ? (
                            <div className="dv-success">
                                <CheckCircle2 size={40}/>
                                <h3>OTP Verified Successfully</h3>
                                <p>
                                    Your assigned rider has verified your delivery code.
                                </p>
                            </div>
                        ) : eligible ? (
                            <div className="dv-otp-section">
                                <div className="dv-mail-icon">
                                    <Mail size={27}/>
                                </div>

                                <h3>
                                    {sent ? "Check Your Email" : "Get Your Delivery Code"}
                                </h3>

                                <p>
                                    {sent ? "Your verification code has been sent. Share it with your assigned rider when receiving your order." : "We'll send a secure 6-digit verification code to the email address associated with this order."}
                                </p>

                                <button type="button" className="dv-send-button" onClick={handleSendOtp} disabled={sending || cooldown > 0}>
                                    {sending ? (
                                        <>
                                            <RefreshCw size={18} className="dv-spin"/>
                                            Sending...
                                        </>
                                    ) : cooldown > 0 ? (
                                        <>
                                            <Clock3 size={18}/>
                                            Resend in {cooldown}s
                                        </>
                                    ) : (
                                        <>
                                            <Mail size={18}/>
                                            {sent ? "Resend Delivery OTP" : "Send Delivery OTP"}
                                        </>
                                    )}
                                </button>

                                <div className="dv-expiry">
                                    <Clock3 size={15}/>
                                    Code expires after 10 minutes
                                </div>
                            </div>
                        ) : (
                            <div className="dv-not-eligible">
                                <AlertCircle size={25}/>
                                <h3>Verification Not Available</h3>
                                <p>
                                    Delivery OTP can only be requested while your order is Out for Delivery.
                                </p>
                            </div>
                        )}

                        {error && (
                            <p className="dv-error" role="alert">
                                {error}
                            </p>
                        )}

                        <div className="dv-security-note">
                            <ShieldCheck size={20}/>
                            <p>
                                <strong>Security Reminder</strong>
                                Only share your OTP with your assigned QuickTaste rider when receiving your order. Never share it with anyone else.
                            </p>
                        </div>
                    </div>
                </div>

                <p className="dv-bottom-note">
                    <ShieldCheck size={15}/>
                    Protected by QuickTaste Delivery Verification
                </p>
            </div>
        </main>
    );
};

export default DeliveryVerification;