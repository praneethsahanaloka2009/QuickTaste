import React, { useEffect, useState } from 'react'
import './OfferBar.css'

const OfferBar = () => {

    const [promo, setPromo] = useState(null)

    useEffect(() => {
        
        const fetchOfferPromo = async () => {
            
            try {
                
                const response = await fetch("http://localhost:4911/api/promo/list")

                const data = await response.json()

                if(data.success){
                    
                    const now = new Date()

                    const activePromo = data.promos.find((item) => {
                        
                        return (item.isActive === true && item.showOnOfferBar === true && new Date(item.expiryDate) >= now)

                    })

                    setPromo(activePromo || null)

                }

            } catch (error) {
                console.log("Offer Bar Error:", error)
                setPromo(null)
            }

        }

        fetchOfferPromo()

    }, [])

    if(!promo){
        return null
    }

    return (
        <div className="offer-bar">
            <div className="offer-bar-content">

                <p>🚚 Free Shipping on Orders Above $25</p>

                <span>|</span>

                <p>🎁 {promo.offerText}</p>

                <span>|</span>

                <p>
                    🔐 Use Code: <strong>{promo.code}</strong>
                </p>

            </div>
        </div>
    )
}

export default OfferBar