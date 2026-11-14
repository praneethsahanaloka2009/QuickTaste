import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Crown, Gift, Headphones, Leaf, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles, Truck, Wallet } from "lucide-react";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
import { API_URL } from "../../config/api";
import "./Subscription.css";

const planDetails = {
    Basic: {
        icon: Leaf,
        label: "EVERYDAY VALUE",
        subtitle: "Start saving on every delivery.",
        color: "basic"
    },
    Plus: {
        icon: Sparkles,
        label: "MOST POPULAR",
        subtitle: "A little extra for every craving.",
        color: "plus"
    },
    Premium: {
        icon: Crown,
        label: "ULTIMATE REWARDS",
        subtitle: "Our best benefits, all in one plan.",
        color: "premium"
    }
};

const faqs = [
    {
        question: "How does QuickTaste Membership work?",
        answer: "Choose a membership plan and complete the secure Stripe subscription checkout. Once your payment is confirmed, your membership becomes active and eligible benefits are applied."
    },
    {
        question: "Can I cancel my membership anytime?",
        answer: "Yes. You can cancel automatic renewal from your QuickTaste Profile. Your membership remains available until the end of your current paid billing period."
    },
    {
        question: "Are all food items eligible for discounts?",
        answer: "Not necessarily. Food discounts and delivery benefits apply only to eligible orders and items according to your membership plan."
    },
    {
        question: "Can I change my membership plan?",
        answer: "Plan upgrades and downgrades are not currently available. You can manage your existing membership from your Profile."
    },
    {
        question: "When will I be charged?",
        answer: "Your first payment is collected during Stripe Checkout. Your subscription then renews automatically every month unless you cancel automatic renewal."
    }
];

const Subscription = () => {
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [ordersPerMonth, setOrdersPerMonth] = useState(8);
    const [averageFoodSpend, setAverageFoodSpend] = useState(15);
    const [openFaq, setOpenFaq] = useState(0);
    const { token } = useContext(StoreContext);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const checkoutInProgress = useRef(false);
    const [activeMembership, setActiveMembership] = useState(null);
    const [membershipLoading, setMembershipLoading] = useState(true);
    const [membershipError, setMembershipError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        const fetchPlans = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `${API_URL}/api/subscription/plans`,
                    {
                        signal: controller.signal
                    }
                );

                if(!response.ok){
                    throw new Error("Failed to load membership plans.");
                }

                const data = await response.json();

                if(!data.success){
                    throw new Error(data.message || "Unable to load plans.");
                }

                setPlans(Array.isArray(data.plans) ? data.plans : []);
            } catch (error) {
                if(error.name !== "AbortError"){
                    setError(error.message);
                }
            } finally {
                if(!controller.signal.aborted){
                    setLoading(false);
                }
            }
        };

        fetchPlans();

        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        const fetchActiveMembership = async () => {
            setActiveMembership(null);
            setMembershipError("");

            if(!token){
                setMembershipLoading(false);
                return;
            }

            setMembershipLoading(true);

            try {
                const response = await fetch(
                    `${API_URL}/api/subscription/my-subscription`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        cache: "no-store",
                        signal: controller.signal
                    }
                );

                const data = await response.json();

                if(!response.ok || !data.success){
                    throw new Error(data.message || "Unable to load membership.");
                }

                if(!controller.signal.aborted){
                    setActiveMembership(data.subscription || null);
                }

            } catch (error) {
                if(error.name !== "AbortError"){
                    setMembershipError(error.message);
                }
            } finally {
                if(!controller.signal.aborted){
                    setMembershipLoading(false);
                }
            }
        };

        fetchActiveMembership();

        return () => controller.abort();
    }, [token]);

    const membershipPeriodEnd = activeMembership?.currentPeriodEnd ? new Date(activeMembership.currentPeriodEnd).getTime() : 0;

    const hasActiveMembership = activeMembership?.status === "active" && activeMembership?.paymentStatus === "Paid" && Number.isFinite(membershipPeriodEnd) && membershipPeriodEnd > Date.now();

    const activePlanId = hasActiveMembership ? (typeof activeMembership.planId === "object" ? activeMembership.planId?._id : activeMembership.planId) : null;

    const hasExistingMembership = Boolean(activeMembership && ["pending", "active", "past_due"].includes(activeMembership.status));

    const selectedPlanData = useMemo(() => plans.find((plan) => plan._id === selectedPlan), [plans, selectedPlan]);

    // Estimate only: actual eligibility, promotions and billing must be calculated by the backend at checkout.
    const estimatedSavings = useMemo(() => {
        if(!selectedPlanData){
            return null;
        }

        const deliveryDiscount = Number(selectedPlanData.deliveryDiscountPercentage || 0) / 100;
        const foodDiscount = Number(selectedPlanData.foodDiscountPercentage || 0) / 100;
        const estimatedDeliverySavings = ordersPerMonth * 2 * deliveryDiscount;
        const estimatedFoodSavings = ordersPerMonth * averageFoodSpend * foodDiscount;
        const grossSavings = estimatedDeliverySavings + estimatedFoodSavings;
        const monthlyPrice = Number(selectedPlanData.price || 0);

        return {
            gross: grossSavings,
            net: grossSavings - monthlyPrice,
            price: monthlyPrice
        };
    }, [selectedPlanData, ordersPerMonth, averageFoodSpend]);

    const handleContinue = async () => {
        if(membershipLoading || membershipError){
            toast.error("Unable to verify your membership. Please refresh the page.");
            return;
        }

        if(hasExistingMembership){
            toast.info("You already have a membership. Manage it from your Profile.");
            return;
        }

        if(!selectedPlanData || checkoutInProgress.current){
            return;
        }

        if(!token){
            toast.error("Please log in to purchase a membership.");
            return;
        }

        checkoutInProgress.current = true;
        setCheckoutLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/api/subscription/create-recurring-checkout`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        planId: selectedPlanData._id
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Unable to start membership checkout.");
            }

            if(typeof data.checkoutUrl !== "string" || !data.checkoutUrl.startsWith("https://checkout.stripe.com/")){
                throw new Error("Invalid Stripe Checkout URL.");
            }

            window.location.assign(data.checkoutUrl);

        } catch (error) {
            console.error("Membership Checkout Error:", error);

            toast.error(error.message || "Failed to start membership checkout.");

            checkoutInProgress.current = false;
            setCheckoutLoading(false);
        }
    };

    return (
        <main className="subscription-page">
            <section className="subscription-hero">
                <div className="subscription-hero-glow"/>

                <div className="subscription-hero-content">
                    <span className="subscription-kicker">
                        <Crown size={16}/>
                        QUICKTASTE MEMBERSHIP
                    </span>

                    <h1>
                        Your cravings deserve
                        <span> something extra.</span>
                    </h1>

                    <p>
                        Enjoy delicious food with exclusive member offers, delivery savings and rewards designed around you.
                    </p>

                    <div className="subscription-hero-highlights">
                        <span>
                            <BadgeCheck size={17}/>
                            Exclusive rewards
                        </span>
                        <span>
                            <Truck size={17}/>
                            Delivery savings
                        </span>
                        <span>
                            <ShieldCheck size={17}/>
                            Flexible membership
                        </span>
                    </div>

                    <a href="#membership-plans" className="subscription-hero-link">
                        Explore plans
                        <ArrowRight size={17}/>
                    </a>
                </div>

                <div className="subscription-hero-decoration" aria-hidden="true">
                    <div className="subscription-floating-badge subscription-floating-badge-one">
                        <Gift size={20}/>
                        <span>More rewards</span>
                    </div>

                    <div className="subscription-hero-emblem">
                        <Crown size={82} strokeWidth={1.4}/>
                        <span>QUICKTASTE</span>
                        <strong>MEMBERSHIP</strong>
                    </div>

                    <div className="subscription-floating-badge subscription-floating-badge-two">
                        <Truck size={20} />
                        <span>Delivery perks</span>
                    </div>
                </div>
            </section>

            <section className="subscription-pricing-section" id="membership-plans">
                <div className="subscription-section-heading">
                    <span className="subscription-section-eyebrow">
                        CHOOSE YOUR MEMBERSHIP
                    </span>

                    <h2>Three plans. More reasons to smile.</h2>

                    <p>
                        Pick the plan that fits your lifestyle. All memberships are designed for monthly billing.
                    </p>
                </div>

                {loading ? (
                    <div className="subscription-feedback">
                        <LoaderCircle size={30} className="subscription-spinner"/>
                        <p>Loading membership plans...</p>
                    </div>
                ) : error ? (
                    <div className="subscription-feedback subscription-error">
                        <p>{error}</p>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="subscription-feedback">
                        <p>No membership plans are available.</p>
                    </div>
                ) : (
                    <>
                        <div className="subscription-plans">
                            {plans.map((plan) => {
                                const details = planDetails[plan.name] || planDetails.Basic;
                                const PlanIcon = details.icon;
                                const isSelected = selectedPlan === plan._id;
                                const isCurrentPlan = hasActiveMembership && String(activePlanId) === String(plan._id);

                                return (
                                    <button type="button" key={plan._id} className={["subscription-plan-card", `subscription-card-${details.color}`, isSelected && !isCurrentPlan ? "selected" : "", isCurrentPlan ? "current-plan" : ""].join(" ")} onClick={() => {if(!hasExistingMembership && !membershipLoading && !membershipError){setSelectedPlan(plan._id);}}} aria-pressed={isSelected && !isCurrentPlan}>
                                        {isCurrentPlan && (
                                            <span className="subscription-active-badge">
                                                <BadgeCheck size={15}/>
                                                ACTIVE PLAN
                                            </span>
                                        )}

                                        {plan.name === "Plus" && !isCurrentPlan && (
                                            <span className="subscription-popular">
                                                <Sparkles size={14}/>
                                                MOST POPULAR
                                            </span>
                                        )}
                                        
                                        <div className="subscription-card-top">
                                            <div className="subscription-card-heading">
                                                <div className="subscription-card-icon">
                                                    <PlanIcon size={25} />
                                                </div>

                                                <span className="subscription-card-tier">
                                                    {details.label}
                                                </span>
                                            </div>

                                            <h3>{plan.name}</h3>
                                            <p>{plan.description || details.subtitle}</p>
                                        </div>

                                        <div className="subscription-price">
                                            <span className="subscription-currency">
                                                $
                                            </span>
                                            <strong>
                                                {Number(plan.price).toFixed(2)}
                                            </strong>
                                            <span className="subscription-period">
                                                / month
                                            </span>
                                        </div>

                                        <div className="subscription-billing-note">
                                            Billed monthly · USD
                                        </div>

                                        <div className="subscription-card-divider"/>

                                        <div className="subscription-benefits">
                                            <span className="subscription-benefits-title">
                                                WHAT'S INCLUDED
                                            </span>

                                            {(plan.benefits || []).map((benefit, index) => (
                                                <div className="subscription-benefit" key={`${plan._id}-${index}`}>
                                                    <span className="subscription-benefit-check">
                                                        <Check size={14}/>
                                                    </span>
                                                    <span>{benefit}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className={["subscription-select-label", isCurrentPlan ? "current" : "", isSelected && !isCurrentPlan ? "active" : ""].join(" ")}>
                                            <span>
                                                {isCurrentPlan ? "Your Current Plan" : isSelected ? "Selected Plan" : "Choose This Plan"}
                                            </span>
                                            {isCurrentPlan || isSelected ? (
                                                <Check size={18}/>
                                            ) : (
                                                <ArrowRight size={18}/>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="subscription-action">
                            <div className="subscription-selection-summary">
                                {hasExistingMembership ? (
                                    <span>
                                        You already have a membership. Manage your subscription from My Profile.
                                    </span>
                                ) : selectedPlanData ? (
                                    <>
                                        <Check size={17}/>
                                        <span>
                                            You've selected{" "}<strong>{selectedPlanData.name}</strong>{" — $"}{Number(selectedPlanData.price).toFixed(2)}/month
                                        </span>
                                    </>
                                ) : (
                                    <span>
                                        Select a membership plan to continue.
                                    </span>
                                )}
                            </div>

                            <button type="button" className="subscription-continue" disabled={!selectedPlanData || checkoutLoading || membershipLoading || Boolean(membershipError) || hasExistingMembership} onClick={handleContinue}>
                                {checkoutLoading ? (
                                    <>
                                        <LoaderCircle size={19} className="subscription-spinner"/>
                                        Connecting to Stripe...
                                    </>
                                ) : hasExistingMembership ? (
                                    <>
                                        <BadgeCheck size={19}/>
                                        Membership Already Active
                                    </>
                                ) : (
                                    <>
                                        Continue with Membership
                                        <ArrowRight size={19}/>
                                    </>
                                )}
                            </button>

                            <p>
                                {hasExistingMembership ? "Your existing membership can be managed from My Profile. Your current benefits remain available according to your membership status." : "You will be redirected to Stripe's secure checkout. Your selected membership renews automatically every month until cancelled."}
                            </p>
                        </div>
                    </>
                )}
            </section>

            <section className="subscription-savings-section">
                <div className="subscription-section-heading">
                    <span className="subscription-section-eyebrow">
                        YOUR POTENTIAL SAVINGS
                    </span>

                    <h2>See what membership could save you.</h2>

                    <p>
                        Adjust your monthly orders to explore estimated benefits.
                    </p>
                </div>

                <div className="subscription-savings-layout">
                    <div className="subscription-calculator">
                        <div className="subscription-calculator-header">
                            <div className="subscription-calculator-icon">
                                <Wallet size={24}/>
                            </div>
                            <div>
                                <h3>Membership Savings Calculator</h3>
                                <p>Customize your ordering habits.</p>
                            </div>
                        </div>

                        <div className="subscription-calc-field">
                            <div className="subscription-calc-label">
                                <label htmlFor="subscription-orders">
                                    Orders per month
                                </label>
                                <strong>{ordersPerMonth}</strong>
                            </div>

                            <input id="subscription-orders" type="range" min="1" max="30" value={ordersPerMonth} onChange={(event) => setOrdersPerMonth(Number(event.target.value))}/>
                        </div>

                        <div className="subscription-calc-field">
                            <div className="subscription-calc-label">
                                <label htmlFor="subscription-spend">
                                    Average food subtotal per order
                                </label>
                                <strong>${averageFoodSpend}</strong>
                            </div>

                            <input id="subscription-spend" type="range" min="5" max="50" step="5" value={averageFoodSpend} onChange={(event) => setAverageFoodSpend(Number(event.target.value))}/>
                        </div>

                        <div className="subscription-calc-disclaimer">
                            Assumes every order and food item is eligible. Uses a $2 standard delivery fee and does not account for existing free-delivery thresholds or promotions. Actual savings may be lower.
                        </div>
                    </div>

                    <div className="subscription-savings-result">
                        <div className="subscription-savings-result-top">
                            <Sparkles size={24}/>
                            <span>ESTIMATED MONTHLY SAVINGS</span>
                        </div>

                        {estimatedSavings ? (
                            <>
                                <p>
                                    With your selected{" "}
                                    <strong>{selectedPlanData.name}</strong> plan
                                </p>

                                <div className="subscription-savings-amount">
                                    ${estimatedSavings.gross.toFixed(2)}
                                </div>

                                <div className="subscription-savings-breakdown">
                                    <div>
                                        <span>Membership cost</span>
                                        <strong>
                                            -${estimatedSavings.price.toFixed(2)}
                                        </strong>
                                    </div>
                                    <div className="subscription-savings-net">
                                        <span>Estimated net savings</span>
                                        <strong>
                                            {estimatedSavings.net < 0 ? "-" : ""}
                                            ${Math.abs(estimatedSavings.net).toFixed(2)}
                                        </strong>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="subscription-savings-empty">
                                <Crown size={36}/>
                                <p>
                                    Select a membership plan above to see your estimated savings.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="subscription-perks-section">
                <div className="subscription-section-heading">
                    <span className="subscription-section-eyebrow">
                        MORE THAN JUST DISCOUNTS
                    </span>
                    <h2>Made for people who love good food.</h2>
                </div>

                <div className="subscription-perks-grid">
                    <div className="subscription-perk">
                        <div className="subscription-perk-icon">
                            <Truck size={25}/>
                        </div>
                        <h3>Delivery Benefits</h3>
                        <p>
                            Enjoy reduced or free delivery on eligible orders based on your plan.
                        </p>
                    </div>

                    <div className="subscription-perk">
                        <div className="subscription-perk-icon">
                            <Gift size={25}/>
                        </div>
                        <h3>Exclusive Rewards</h3>
                        <p>
                            Access member-only offers and special rewards available to your membership tier.
                        </p>
                    </div>

                    <div className="subscription-perk">
                        <div className="subscription-perk-icon">
                            <Headphones size={25}/>
                        </div>
                        <h3>Premium Support</h3>
                        <p>
                            Premium members will enjoy priority customer support when this benefit is launched.
                        </p>
                    </div>

                    <div className="subscription-perk">
                        <div className="subscription-perk-icon">
                            <LockKeyhole size={25}/>
                        </div>
                        <h3>Membership Control</h3>
                        <p>
                            View your plan, renewal details and cancellation options in your account once enabled.
                        </p>
                    </div>
                </div>
            </section>
            
            <section className="subscription-faq-section">
                <div className="subscription-section-heading">
                    <span className="subscription-section-eyebrow">
                        NEED TO KNOW MORE?
                    </span>
                    <h2>Frequently asked questions.</h2>
                </div>

                <div className="subscription-faq-list">
                    {faqs.map((faq, index) => (
                        <div className={`subscription-faq-item ${openFaq === index ? "open" : ""}`} key={faq.question}>
                            <button type="button" className="subscription-faq-question" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}>
                                <span>{faq.question}</span>
                                <ChevronDown size={20}/>
                            </button>

                            {openFaq === index && (
                                <div className="subscription-faq-answer">
                                    {faq.answer}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            <div className="subscription-bottom-note">
                <ShieldCheck size={18}/>
                <span>
                    Membership benefits are subject to eligibility. Subscriptions are billed monthly through Stripe. You can cancel automatic renewal from your QuickTaste Profile.
                </span>
            </div>
        </main>
    );
};

export default Subscription;