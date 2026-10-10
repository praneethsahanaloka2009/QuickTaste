import React, { useContext, useState } from 'react'
import './Cart.css'
import { StoreContext } from '../../context/StoreContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

const Cart = () => {

  const {cartItems, food_list, removeFromCart, getTotalCartAmount} = useContext(StoreContext)

  const navigate = useNavigate()

  const [promoCode, setPromoCode] = useState("")
  const [appliedPromo, setAppliedPromo] = useState(null)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [promoLoading, setPromoLoading] = useState(false)

  const handleApplyPromo = async () => {

    if (!promoCode.trim()) {
      toast.error("Please enter a promo code.")
      return
    }

    const subtotal = getTotalCartAmount()

    if (subtotal <= 0) {
      toast.error("Your cart is empty.")
      return
    }

    try {

      setPromoLoading(true)

      const response = await fetch(
        "http://localhost:4911/api/promo/validate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            code: promoCode,
            orderAmount: subtotal
          })
        }
      )

      const data = await response.json()

      if (data.success) {

        setAppliedPromo(data.promo)
        setDiscountAmount(Number(data.discountAmount))

        toast.success(data.message)

      } else {

        setAppliedPromo(null)
        setDiscountAmount(0)

        toast.error(data.message)

      }

    } catch (error) {

      console.log(error)

      setAppliedPromo(null)
      setDiscountAmount(0)

      toast.error("Unable to apply promo code.")

    } finally {

      setPromoLoading(false)

    }
  }

  const handleRemovePromo = () => {

    setAppliedPromo(null)
    setDiscountAmount(0)
    setPromoCode("")

    toast.info("Promo code removed.")

  }

  const subtotal = getTotalCartAmount()

  const deliveryFee = subtotal === 0 ? 0 : 2

  const finalSubtotal = Math.max(0, subtotal - discountAmount)

  const total = subtotal === 0 ? 0 : finalSubtotal + deliveryFee

  return (
    <div className='cart'>

      <div className="cart-items">

        <div className="cart-items-title">

          <p>Items</p>
          <p>Title</p>
          <p>Price</p>
          <p>Quantity</p>
          <p>Total</p>
          <p>Remove</p>

        </div>

        <br />

        <hr />

        {food_list.map((item) => {

          if (cartItems[item._id] > 0) {

            return (

              <div key={item._id}>

                <div className='cart-items-title cart-items-item'>

                  <img src={`http://localhost:4911/images/${item.image}`} alt={item.name}/>

                  <p>{item.name}</p>

                  <p>${Number(item.price).toFixed(2)}</p>

                  <p>{cartItems[item._id]}</p>

                  <p>${(Number(item.price) * cartItems[item._id]).toFixed(2)}</p>

                  <p onClick={() => removeFromCart(item._id)} className='cross'>
                    x
                  </p>

                </div>

                <hr />

              </div>

            )
          }

          return null

        })}

      </div>

      <div className="cart-bottom">

        <div className="cart-total">

          <h2>Cart Totals</h2>

          <div>

            {/* Subtotal */}
            <div className="cart-total-details">

              <p>Subtotal</p>

              <p>${subtotal.toFixed(2)}</p>

            </div>

            <hr />

            {/* Discount */}
            {discountAmount > 0 && (

              <>
                <div className="cart-total-details">

                  <p>Discount</p>

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

          <button onClick={() => navigate('/order', {state: {promoCode: appliedPromo?.code || "", discountAmount: discountAmount}})}>
            PROCEED TO CHECKOUT
          </button>

        </div>

        {/* Promo Code */}
        <div className="cart-promocode">

          <div>

            {!appliedPromo ? (

              <>
                <p>If you have a promo code, Enter it here!</p>

                <div className="cart-promocode-input">

                  <input type="text" placeholder="Promo Code" value={promoCode} onChange={(e) =>setPromoCode(e.target.value.toUpperCase())}/>

                  <button type="button" onClick={handleApplyPromo} disabled={promoLoading}>
                    {promoLoading ? "Applying..." : "Submit"}
                  </button>

                </div>
              </>

            ) : (

              <div className="applied-promo">

                <div>

                  <strong>{appliedPromo.code}</strong>

                  <span>{appliedPromo.discountType === "percentage" ? `${appliedPromo.discountValue}% OFF` : `$${Number(appliedPromo.discountValue).toFixed(2)} OFF`}</span>

                </div>

                <button type="button" onClick={handleRemovePromo}>
                  Remove
                </button>

              </div>

            )}

          </div>

        </div>

      </div>

    </div>
  )
}

export default Cart