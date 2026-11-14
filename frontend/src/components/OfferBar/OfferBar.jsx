import React, { useEffect, useState } from "react";
import "./OfferBar.css";

// Backend API Configuration
import { API_URL } from "../../config/api";

const OfferBar = () => {

    const [promo, setPromo] = useState(null);

    useEffect(() => {

        const fetchOfferPromo = async () => {

            try {
                const response = await fetch(
                    `${API_URL}/api/promo/public-offers`
                );

                const data = await response.json();

                if(data.success){
                    const activePromo = Array.isArray(data.promos) ? data.promos[0] : null;
                    setPromo(activePromo || null);
                } else {
                    setPromo(null);
                }

            } catch (error) {

                console.log("Offer Bar Error:", error);
                setPromo(null);

            }

        };

        fetchOfferPromo();

    }, []);

    if (!promo) {
        return null;
    }

    return (

        <div className="offer-bar">

            <div className="offer-bar-content">

                <p>
                    🚚 Free Shipping on Orders Above $25
                </p>

                <span>|</span>

                <p>
                    🎁 {promo.offerText}
                </p>

                <span>|</span>

                <p>
                    🔐 Use Code: <strong>{promo.code}</strong>
                </p>

            </div>

        </div>
    );
};

export default OfferBar;