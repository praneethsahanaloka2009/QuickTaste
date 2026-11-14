import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
import { API_URL, getImageUrl } from "../../config/api";
import "./Profile.css";

const Profile = () => {
    const { user, setUser, token, fetchUserProfile } = useContext(StoreContext);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    const [searchParams, setSearchParams] = useSearchParams();

    const membershipPayment = searchParams.get("membership_payment");
    const checkoutSessionId = searchParams.get("session_id");

    const [checkoutStatus, setCheckoutStatus] = useState("");

    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({name: "", phone: ""});
    const [membership, setMembership] = useState(null);
    const [membershipLoading, setMembershipLoading] = useState(true);
    const [cancellingMembership, setCancellingMembership] = useState(false);
    const [openingBillingPortal, setOpeningBillingPortal] = useState(false);
    const [membershipHistory, setMembershipHistory] = useState([]);
    const [historySummary, setHistorySummary] = useState({
        totalMemberships: 0,
        totalPurchasedDays: 0,
        totalActiveDays: 0
    });
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState("");
    const [membershipPayments, setMembershipPayments] = useState([]);
    const [paymentSummary, setPaymentSummary] = useState({
        totalPayments: 0,
        totalPaid: 0,
        currency: "USD"
    });
    const [paymentsLoading, setPaymentsLoading] = useState(true);
    const [paymentsError, setPaymentsError] = useState("");

    useEffect(() => {
        if(!token){
            navigate("/", { replace: true });
            return;
        }

        fetchUserProfile(token);

        const loadMembership = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/api/subscription/my-subscription`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if(!response.ok){
                    throw new Error("Failed to load membership.");
                }

                const data = await response.json();

                if(data.success){
                    setMembership(data.subscription || null);
                }
            } catch (error) {
                console.error("Membership Error:", error);
            } finally {
                setMembershipLoading(false);
            }
        };

        loadMembership();

        const loadMembershipHistory = async () => {
            try {
                setHistoryLoading(true);
                setHistoryError("");

                const response = await fetch(
                    `${API_URL}/api/subscription/my-history`,
                    {
                        headers : {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if(!response.ok || !data.success){
                    throw new Error(
                        data.message || "Failed to load membership history."
                    );
                }

                setMembershipHistory(data.history || []);

                setHistorySummary(data.summary || {
                    totalMemberships: 0,
                    totalPurchasedDays: 0,
                    totalActiveDays: 0
                });
            } catch (error) {
                console.error("Membership History Error:", error);
                setHistoryError(error.message);
            } finally {
                setHistoryLoading(false);
            }
        }

        loadMembershipHistory();

        // Load Monthly Membership Payment History
        const loadMembershipPayments = async () => {
            try {
                setPaymentsLoading(true);
                setPaymentsError("");

                const response = await fetch(
                    `${API_URL}/api/subscription/my-payments`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        cache: "no-store"
                    }
                );

                const data = await response.json();

                if(!response.ok || !data.success){
                    throw new Error(data.message || "Failed to load membership payments.");
                }

                setMembershipPayments(data.payments || []);

                setPaymentSummary(data.summary || {
                    totalPayments: 0,
                    totalPaid: 0,
                    currency: "USD"
                });

            } catch (error) {
                console.error("Membership Payments Error:", error);
                setPaymentsError(error.message);
            } finally {
                setPaymentsLoading(false);
            }
        };

        loadMembershipPayments();

    }, [token, navigate]);

    useEffect(() => {
        if(!token || membershipPayment !== "success" || !checkoutSessionId){
            return;
        }

        let cancelled = false;
        let timeoutId;

        const verifyMembership = async () => {
            setCheckoutStatus("processing");

            // Allow time for Stripe webhook processing.
            for(let attempt = 0; attempt < 10; attempt++){
                if(cancelled){
                    return;
                }

                try {
                    const response = await fetch(
                        `${API_URL}/api/subscription/my-subscription`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`
                            },
                            cache: "no-store"
                        }
                    );

                    if(!response.ok){
                        throw new Error("Unable to check membership status.");
                    }

                    const data = await response.json();

                    if(data.success && data.subscription?.status === "active" && data.subscription?.paymentStatus === "Paid" && data.subscription?.stripeCheckoutSessionId === checkoutSessionId && new Date(data.subscription.currentPeriodEnd).getTime() > Date.now()){
                        if(cancelled){
                            return
                        }

                        setMembership(data.subscription);
                        setCheckoutStatus("success");

                        toast.success("Your QuickTaste membership is now active!");

                        setSearchParams(
                            {},
                            {
                                replace: true
                            }
                        );
                        return;
                    }
                } catch (error) {
                    console.error("Membership verification error:", error);
                }

                await new Promise((resolve) => {
                    timeoutId = setTimeout(resolve, 2000);
                });
            }

            if(!cancelled){
                setCheckoutStatus("pending");
            }
        };

        verifyMembership();

        return() => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [token, membershipPayment, checkoutSessionId, setSearchParams]);

    const handleOpenBillingPortal = async () => {
        if(openingBillingPortal || !token){
            return;
        }

        setOpeningBillingPortal(true);

        try {
            const response = await fetch(
                `${API_URL}/api/subscription/create-billing-portal`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success || !data.url){
                throw new Error(
                    data.message || "Unable to open billing portal."
                );
            }

            // Redirect customer to Stripe-hosted billing portal
            window.location.assign(data.url);

        } catch (error) {
            console.error("Billing Portal Error:", error);
            toast.error(error.message || "Unable to open billing portal.");
            setOpeningBillingPortal(false);
        }
    };

    const handleCancelMembership = async () => {
        if(cancellingMembership || !membership || !token){
            return;
        }

        if(membership.cancelAtPeriodEnd){
            toast.info("Automatic renewal is already cancelled.");
            return;
        }

        const confirmed = window.confirm("Are you sure you want to cancel automatic renewal? " + "Your membership will remain available until the end of your paid billing period.");

        if(!confirmed){
            return;
        }

        setCancellingMembership(true);

        try {
            const response = await fetch(
                `${API_URL}/api/subscription/cancel`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Unable to cancel automatic renewal.");
            }

            setMembership((previous) => ({
                ...previous,
                cancelAtPeriodEnd: data.cancelAtPeriodEnd
            }));

            toast.success(data.message);

        } catch (error) {
            console.error("Membership Cancellation Error:", error);

            toast.error(error.message || "Failed to cancel automatic renewal.");
        } finally {
            setCancellingMembership(false);
        }
    };

    const saveUpdatedUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
    };

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if(!file){
            return;
        }

        if(!["image/jpeg", "image/png", "image/webp"].includes(file.type)){
            toast.error("Please select a JPG, PNG or WebP image.");
            return;
        }

        if(file.size > 5 * 1024 * 1024){
            toast.error("Image must be smaller than 5MB.");
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            formData.append("avatar", file);

            const response = await fetch(
                `${API_URL}/api/user/profile-picture`,
                {
                    method : "POST",
                    headers : {
                        "Authorization" : `Bearer ${token}`
                    },
                    body : formData
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Upload failed.");
            }

            saveUpdatedUser(data.user);
            toast.success("Profile picture updated successfully!");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setUploading(false);
        }
    };

    const getMemberSince = (user) => {
        if(user?.createdAt){
            return {
                date: formatDate(user.createdAt),
                estimated: false
            };
        }

        // Fallback for older users without createdAt
        const objectId = user?._id;

        if(typeof objectId === "string" && /^[0-9a-fA-F]{24}$/.test(objectId)){
            const timestamp = parseInt(objectId.slice(0, 8), 16);

            const date = new Date(timestamp * 1000);

            if(!Number.isNaN(date.getTime())){
                return {
                    date: formatDate(date),
                    estimated: true
                };
            }
        }

        return {
            date: "Not available",
            estimated: false
        };
    };

    useEffect(() => {
        if(!isEditing){
            setProfileForm({
                name: user?.name || "",
                phone: user?.phone || ""
            });
        }
    }, [user?.name, user?.phone, isEditing]);

    const handleEditProfile = () => {
        setProfileForm({
            name: user?.name || "",
            phone: user?.phone || ""
        });

        setIsEditing(true);
    };

    const handleSaveProfile = async (event) => {
        event.preventDefault();

        if(savingProfile){
            return;
        }

        const name = profileForm.name.trim();
        const phone = profileForm.phone.trim();

        if(name.length < 2 || name.length > 80){
            toast.error("Full name must contain 2 to 80 characters.");
            return;
        }

        if(phone && !/^\+?[0-9][0-9\s()-]{6,19}$/.test(phone)){
            toast.error("Please enter a valid phone number.");
            return;
        }

        setSavingProfile(true);

        try {
            const response = await fetch(
                `${API_URL}/api/user/profile`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name,
                        phone
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Unable to update profile.");
            }

            saveUpdatedUser(data.user);
            setIsEditing(false);

            toast.success("Profile updated successfully!");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleRemove = async () => {
        if(!user?.avatar || removing){
            return;
        }

        setRemoving(true);

        try {
            const response = await fetch(
                `${API_URL}/api/user/profile-picture`,
                {
                    method : "DELETE",
                    headers : {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Remove failed.");
            }

            saveUpdatedUser(data.user);
            toast.success("Profile picture removed successfully!");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setRemoving(false);
        }
    };

    const formatDate = (date) => {
        if(!date){
            return "Not available";
        }

        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    const periodEnd = membership?.currentPeriodEnd ? new Date(membership.currentPeriodEnd) : null;

    const isActive = membership?.status === "active" && periodEnd && periodEnd.getTime() > Date.now();

    const isPastDue = membership?.status === "past_due";

    const daysRemaining = isActive ? Math.ceil((periodEnd.getTime() - Date.now()) / 86400000) : 0;

    const plan = membership?.planId;

    if(!token){
        return null;
    }

    return (
        <div className="customer-profile-page">
            
            <div className="customer-profile-heading">
                <span className="customer-profile-eyebrow">
                    QUICKTASTE ACCOUNT
                </span>
                <h1>My Profile</h1>
                <p>
                    Manage your personal details, membership and orders.
                </p>
            </div>

            {checkoutStatus === "processing" && (
                <p role="status">
                    Verifying your membership payment. Please wait...
                </p>
            )}

            {checkoutStatus === "pending" && (
                <p role="status">
                    Your membership is still being processed.
                    Please refresh your profile later.
                </p>
            )}

            {checkoutStatus === "success" && (
                <p role="status">
                    Your membership has been activated successfully!
                </p>
            )}

            <div className="customer-profile-grid">
                
                <section className="customer-profile-card customer-personal-card">
                    <h2>Personal Information</h2>

                    <div className="customer-avatar-section">
                        {user?.avatar ? (
                            <img className="customer-profile-avatar" src={getImageUrl(user.avatar)} alt="Customer profile"/>
                        ) : (
                            <div className="customer-profile-avatar customer-avatar-letter">
                                {user?.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                        )}

                        <h3>{user?.name || "Customer"}</h3>
                        <p>{user?.email || ""}</p>

                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUpload} hidden/>

                        <div className="customer-avatar-actions">
                            <button className="customer-primary-btn" disabled={uploading || removing} onClick={() => fileInputRef.current?.click()}>
                                {uploading ? "Uploading..." : user?.avatar ? "Change Photo" : "Upload Photo"}
                            </button>

                            {user?.avatar && (
                                <button className="customer-outline-btn" disabled={uploading || removing} onClick={handleRemove}>
                                    {removing ? "Removing..." : "Remove Photo"}
                                </button>
                            )}
                        </div>

                        <small>JPG, PNG or WebP. Maximum 5MB.</small>
                    </div>

                    <div className="customer-info-list">
                        {!isEditing ? (
                            <>
                                <div>
                                    <span>Full Name</span>
                                    <strong>{user?.name || "Not available"}</strong>
                                </div>

                                <div>
                                    <span>Email Address</span>
                                    <strong>{user?.email || "Not available"}</strong>
                                </div>

                                <div>
                                    <span>Phone Number</span>
                                    <strong>{user?.phone || "Not added"}</strong>
                                </div>

                                <div>
                                    <span>
                                        {getMemberSince(user).estimated ? "Member Since (Estimated)" : "Member Since"}
                                    </span>
                                    <strong>
                                        {getMemberSince(user).date}
                                    </strong>
                                </div>

                                <div className="customer-profile-action-buttons">
                                    <button type="button" className="customer-primary-btn" onClick={handleEditProfile}>
                                        Edit Profile
                                    </button>

                                    <Link to="/my-addresses" className="customer-outline-btn">
                                        Manage Addresses
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <form className="customer-edit-profile-form" onSubmit={handleSaveProfile}>
                                <label htmlFor="customer-profile-name">
                                    Full Name
                                </label>

                                <input id="customer-profile-name" type="text" value={profileForm.name} onChange={(event) => setProfileForm((previous) => ({...previous, name: event.target.value}))} minLength={2} maxLength={80} required/>

                                <label htmlFor="customer-profile-phone">
                                    Phone Number
                                </label>

                                <input id="customer-profile-phone" type="tel" value={profileForm.phone} onChange={(event) => setProfileForm((previous) => ({...previous, phone: event.target.value}))} placeholder="Enter phone number" maxLength={20}/>

                                <div className="customer-edit-profile-actions">

                                    <button type="submit" className="customer-primary-btn" disabled={savingProfile}>
                                        {savingProfile  ? "Saving..." : "Save Changes"}
                                    </button>

                                    <button type="button" className="customer-outline-btn" disabled={savingProfile} onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </button>

                                </div>
                            </form>
                        )}
                    </div>
                </section>

                <section className="customer-profile-card customer-membership-card">
                    <div className="customer-section-title">
                        <div>
                            <span className="customer-profile-eyebrow">
                                EXCLUSIVE REWARDS
                            </span>
                            <h2>My Membership</h2>
                        </div>

                        <span className={`customer-status ${isActive ? "active" : ""}`}>
                            {membershipLoading ? "Loading" : isPastDue ? "Payment Failed" : isActive ? "Active" : membership ? "Inactive" : "Not Subscribed"}
                        </span>
                    </div>

                    {membershipLoading ? (
                        <p>Loading your membership...</p>
                    ) : isPastDue ? (
                        <div className="customer-no-membership">
                            <div className="customer-crown">♛</div>

                            <h3>Membership Payment Failed</h3>

                            <p>
                                Your monthly membership renewal payment was unsuccessful. Your membership is currently past due.
                            </p>

                            <p>
                                Last Paid Period Ended:
                                {" "}
                                <strong>{formatDate(membership.currentPeriodEnd)}</strong>
                            </p>

                            <p>
                                Please update your payment method to restore your membership.
                            </p>

                            <button type="button" className="customer-primary-btn" onClick={handleOpenBillingPortal} disabled={openingBillingPortal}>
                                {openingBillingPortal ? "Opening Billing Portal..." : "Manage Billing"}
                            </button>
                        </div>
                    ) : isActive ? (
                        <>
                            <div className="customer-plan-box">
                                <span>YOUR CURRENT PLAN</span>
                                <h3>QuickTaste {plan?.name || "Membership"}</h3>

                                <p>
                                    ${Number(plan?.price || 0).toFixed(2)}
                                    <small> / month</small>
                                </p>
                            </div>

                            <div className="customer-membership-details">
                                <div>
                                    <span>Activated On</span>
                                    <strong>{formatDate(membership.startDate)}</strong>
                                </div>

                                <div>
                                    <span>Expires On</span>
                                    <strong>{formatDate(membership.currentPeriodEnd)}</strong>
                                </div>

                                <div>
                                    <span>Days Remaining</span>
                                    <strong>{daysRemaining} days</strong>
                                </div>

                                <div>
                                    <span>Automatic Renewal</span>
                                    <strong>
                                        {membership?.cancelAtPeriodEnd ? "OFF" : "ON"}
                                    </strong>
                                </div>
                            </div>

                            <div className="customer-plan-benefits">
                                <h4>Membership Benefits</h4>

                                {plan?.benefits?.map((benefit, index) => (
                                    <p key={index}>✓ {benefit}</p>
                                ))}
                            </div>

                            {/* Membership Action Buttons */}
                            <div className="customer-membership-action-buttons">
                                
                                {/* Stripe Billing Portal */}
                                <button type="button" className="customer-primary-btn" onClick={handleOpenBillingPortal} disabled={openingBillingPortal}>
                                    {openingBillingPortal ? "Opening Billing Portal..." : "Manage Billing"}
                                </button>

                                {/* Cancel Automatic Renewal */}
                                {!membership?.cancelAtPeriodEnd && (
                                    <button type="button" className="customer-outline-btn" onClick={handleCancelMembership} disabled={cancellingMembership}>
                                        {cancellingMembership ? "Cancelling Renewal...": "Cancel Automatic Renewal"}
                                    </button>
                                )}

                            </div>
                        </>
                    ) : (
                        <div className="customer-no-membership">
                            <div className="customer-crown">♛</div>
                            <h3>
                                {membership ? "Membership Inactive" : "Unlock More Rewards"}
                            </h3>
                            <p>
                                Enjoy exclusive food offers, delivery savings and special member benefits.
                            </p>

                            <Link to="/subscription" className="customer-primary-btn">
                                Explore Membership Plans
                            </Link>
                        </div>
                    )}

                    <p className="customer-renewal-note">
                        {isActive ? membership?.cancelAtPeriodEnd ? "Automatic renewal is cancelled. Your membership remains active until the end of the current billing period." : "Your membership renews automatically every month unless you cancel." : "Choose a membership plan to enjoy exclusive QuickTaste benefits."}
                    </p>
                </section>

                <section className="customer-profile-card customer-history-section">
                    <div className="customer-history-heading">
                        <div>
                            <span className="customer-profile-eyebrow">
                                YOUR MEMBERSHIP JOURNEY
                            </span>
                            <h2>Membership History</h2>
                            <p>Track your membership purchases and benefits over time.</p>
                        </div>
                    </div>

                    {historyLoading ? (
                        <p className="customer-history-message">
                            Loading membership history...
                        </p>
                    ) : historyError ? (
                        <p className="customer-history-error" role="alert">
                            {historyError}
                        </p>
                    ) : (
                        <>
                            <div className="customer-history-stats">
                                <div className="customer-history-stat">
                                    <span>Total Purchases</span>
                                    <strong>{historySummary.totalMemberships}</strong>
                                    <small>Membership periods</small>
                                </div>

                                <div className="customer-history-stat">
                                    <span>Purchased Days</span>
                                    <strong>{historySummary.totalPurchasedDays}</strong>
                                    <small>Total membership days purchased</small>
                                </div>

                                <div className="customer-history-stat">
                                    <span>Active Days</span>
                                    <strong>{historySummary.totalActiveDays}</strong>
                                    <small>Completed membership days</small>
                                </div>
                            </div>

                            {membershipHistory.length === 0 ? (
                                <div className="customer-history-empty">
                                    <div className="customer-history-empty-icon">♛</div>
                                    <h3>No Membership History Yet</h3>
                                    <p>
                                        Your membership purchases will appear here once you join a QuickTaste membership plan.
                                    </p>
                                    <Link to="/subscription" className="customer-primary-btn">
                                        Explore Membership Plans
                                    </Link>
                                </div>
                            ) : (
                                <div className="customer-history-list">
                                    {membershipHistory.map((item) => {
                                        const active = item.status === "active" && item.currentPeriodEnd && new Date(item.currentPeriodEnd).getTime() > Date.now();

                                        return (
                                            <article className="customer-history-item" key={item._id}>
                                                <div className="customer-history-item-top">
                                                    <div>
                                                        <span className="customer-history-plan-label">
                                                            QUICKTASTE MEMBERSHIP
                                                        </span>
                                                        <h3>
                                                            {item.planId?.name || "Membership Plan"}
                                                        </h3>
                                                    </div>

                                                    <span className={`customer-history-badge ${active ? "active" : ""}`}>
                                                        {active ? "Active" : item.status === "past_due" ? "Payment Failed" : item.status === "expired" ? "Expired" : item.status === "cancelled" ? "Cancelled" : "Inactive"}
                                                    </span>
                                                </div>

                                                <div className="customer-history-item-details">
                                                    <div>
                                                        <span>Activated</span>
                                                        <strong>{formatDate(item.startDate)}</strong>
                                                    </div>

                                                    <div>
                                                        <span>Expires</span>
                                                        <strong>{formatDate(item.currentPeriodEnd)}</strong>
                                                    </div>

                                                    <div>
                                                        <span>Purchased Duration</span>
                                                        <strong>{item.purchasedDays} days</strong>
                                                    </div>

                                                    <div>
                                                        <span>Active Days</span>
                                                        <strong>{item.activeDays} days</strong>
                                                    </div>

                                                    <div>
                                                        <span>Plan Price</span>
                                                        <strong>${Number(item.planId?.price || 0).toFixed(2)}</strong>
                                                    </div>
                                                </div>
                                            </article>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </section>

            </div>

            <section className="customer-profile-card customer-payment-history">
                
                <div className="customer-history-heading">
                    <div>
                        <span className="customer-profile-eyebrow">
                            YOUR BILLING RECORDS
                        </span>

                        <h2>Monthly Payment History</h2>

                        <p>
                            View your membership payments and monthly renewals.
                        </p>
                    </div>
                </div>

                {paymentsLoading ? (
                    <p className="customer-history-message">
                        Loading payment history...
                    </p>
                ) : paymentsError ? (
                    <p className="customer-history-error" role="alert">
                        {paymentsError}
                    </p>
                ) : (
                    <>
                        <div className="customer-payment-stats">
                            <div className="customer-history-stat">
                                <span>Total Payments</span>
                                <strong>{paymentSummary.totalPayments}</strong>
                                <small>Successful membership payments</small>
                            </div>

                            <div className="customer-history-stat">
                                <span>Total Paid</span>
                                <strong>
                                    ${Number(paymentSummary.totalPaid || 0).toFixed(2)}
                                </strong>
                                <small>{paymentSummary.currency} billed</small>
                            </div>
                        </div>

                        {membershipPayments.length === 0 ? (
                            <div className="customer-history-empty">
                                <h3>No Payment History Yet</h3>
                                <p>Your membership payments will appear here.</p>
                            </div>
                        ) : (
                            <div className="customer-payment-list">
                                {membershipPayments.map((payment) => (
                                    <article className="customer-payment-item" key={payment._id}>
                                        <div className="customer-payment-info">
                                            <span className="customer-history-plan-label">
                                                QUICKTASTE MEMBERSHIP
                                            </span>

                                            <h3>
                                                {payment.planId?.name || "Membership"}{" — "}{payment.billingReason === "subscription_cycle" ? "Monthly Renewal" : payment.billingReason === "subscription_create" ? "Initial Payment" : "Membership Payment"}
                                            </h3>

                                            <p>
                                                {formatDate(payment.paymentStatus === "Failed" ? payment.periodStart || payment.failedAt || payment.createdAt : payment.paidAt || payment.periodStart || payment.createdAt)}
                                            </p>
                                        </div>

                                        <div className="customer-payment-amount">
                                            <strong>
                                                ${Number(payment.amount || 0).toFixed(2)}
                                            </strong>

                                            <span className={`customer-payment-status ${payment.paymentStatus === "Paid" ? "paid" : ""}`}>
                                                {payment.paymentStatus}
                                            </span>

                                            {payment.hostedInvoiceUrl && (
                                                <a href={payment.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                                    View Invoice
                                                </a>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </>
                )}

            </section>

            <section className="customer-profile-card customer-quick-actions">
                <h2>Quick Actions</h2>

                <div className="customer-action-links">
                    <Link to="/my-orders">
                        <span>My Orders</span>
                        <span>→</span>
                    </Link>

                    <Link to="/subscription">
                        <span>Membership Plans</span>
                        <span>→</span>
                    </Link>
                </div>
            </section>

        </div>
    );
};

export default Profile;