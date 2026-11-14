import React from "react";
import { Link } from "react-router-dom";
import { Crown, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import "./MembershipBanner.css";

const MembershipBanner = () => {
    return (
        <section className="membership-banner">
            <div className="membership-banner-content">
                <span className="membership-banner-tag">
                    <Crown size={16}/>
                    QUICKTASTE MEMBERSHIP
                </span>

                <h2>
                    More Flavor.
                    <span> More Rewards.</span>
                </h2>

                <p>
                    Enjoy exclusive food discounts, delivery savings, and premium rewards with QuickTaste Membership.
                </p>

                <div className="membership-banner-features">
                    <span>
                        <CheckCircle2 size={17}/>
                        Delivery Savings
                    </span>
                    <span>
                        <CheckCircle2 size={17}/>
                        Exclusive Offers
                    </span>
                    <span>
                        <CheckCircle2 size={17}/>
                        Member Rewards
                    </span>
                </div>

                <Link to="/subscription" className="membership-banner-button">
                    Explore Membership Plans
                    <ArrowRight size={18}/>
                </Link>
            </div>

            <div className="membership-banner-visual">
                <div className="membership-banner-crown">
                    <Crown size={65}/>
                    <strong>QuickTaste</strong>
                    <span>PREMIUM MEMBERSHIP</span>
                </div>

                <div className="membership-banner-floating">
                    <Sparkles size={17}/>
                    Exclusive Rewards
                </div>
            </div>
        </section>
    );
};

export default MembershipBanner;