import React, { useContext, useState } from 'react'
import './PlaceOrder.css'
import { StoreContext } from '../../context/StoreContext'
import { toast } from 'react-toastify'
import { useNavigate, useLocation } from 'react-router-dom'

const PlaceOrder = () => {

  const { getTotalCartAmount, token } = useContext(StoreContext)
  const navigate = useNavigate()
  const location = useLocation()

  const [formData, setFormData] = useState({
    firstName : "",
    lastName : "",
    email : "",
    street : "",
    city : "",
    state : "",
    zipCode : "",
    country : "",
    phone : ""
  })

  // Promo information received from Cart
  const discountAmount = Number(location.state?.discountAmount || 0)
  const appliedPromoCode = location.state?.promoCode || ""

  const handleChange = (event) => {

    const { name, value } = event.target

    setFormData((previous) => ({
      ...previous,
      [name] : value
    }))

  }

  const handleSubmit = async (event) => {

    event.preventDefault()

    if(!token){
      toast.error("Please login to continue.")
      return
    }

    const subtotal = getTotalCartAmount()

    if(subtotal <= 0){
      toast.error("Your cart is empty.")
      return
    }

    navigate("/payment", {
      state : {
        formData : formData,
        subtotal : subtotal,
        discountAmount : discountAmount,
        promoCode : appliedPromoCode,
        deliveryFee : deliveryFee,
        total : total
      }
    })
  }

  const subtotal = getTotalCartAmount()
  const deliveryFee = subtotal === 0 ? 0 : 2
  const finalSubtotal = Math.max(0, subtotal - discountAmount)
  const total = subtotal === 0 ? 0 : finalSubtotal + deliveryFee

  return (
    <form className='place-order' onSubmit={handleSubmit}>

      <div className="place-order-left">

        <p className="title">Delivery Information</p>

        <div className="multi-fields">
          <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required/>
          <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange}required/>
        </div>

        <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required/>
        <input type="text" name="street" placeholder="Street" value={formData.street} onChange={handleChange} required/>

        <div className="multi-fields">
          <input type="text" name="city" placeholder="City" value={formData.city} onChange={handleChange} required/>
          <input type="text" name="state" placeholder="State" value={formData.state} onChange={handleChange} required/>
        </div>

        <div className="multi-fields">
          <input type="text" name="zipCode" placeholder="Zip Code" value={formData.zipCode} onChange={handleChange} required/>
          <input type="text" name="country" placeholder="Country" value={formData.country} onChange={handleChange} required/>
        </div>

        <input type="text" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required/>

      </div>

      <div className="place-order-right">

        <div className="cart-total">

          <h2>Cart Totals</h2>

          <div>

            <div className="cart-total-details">
              <p>Subtotal</p>
              <p>${subtotal.toFixed(2)}</p>
            </div>

            <hr />

            {/* Discount */}
            {discountAmount > 0 && (
              
              <>
                <div className="cart-total-details">
                  
                  <p>Discount {appliedPromoCode && ` (${appliedPromoCode})`}</p>

                  <p>-${discountAmount.toFixed(2)}</p>

                </div>

                <hr />
              </>

            )}

            {/* Delivery Fee */}
            <div className="cart-total-details">
              <p>Delivery Fee</p>
              <p>${deliveryFee.toFixed(2)}</p>
            </div>

            <hr />

            {/* Total */}
            <div className="cart-total-details">
              <b>Total</b>
              <b>${total.toFixed(2)}</b>
            </div>

          </div>

          <button type="submit">
            PROCEED TO PAYMENT
          </button>

        </div>

      </div>

    </form>
  )
}

export default PlaceOrder