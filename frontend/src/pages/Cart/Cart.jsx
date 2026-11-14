import React, { useContext, useEffect, useState } from 'react'
import './Cart.css'
import { StoreContext } from '../../context/StoreContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

const Cart = () => {
  const { cartItems, food_list, removeFromCart, getTotalCartAmount, token, customizedCartItems, customizedCartLoading, removeCustomizedFromCart, getCustomizedCartTotal } = useContext(StoreContext)

  const navigate = useNavigate()

  const [promoCode, setPromoCode] = useState(
    () => localStorage.getItem('quickTastePromoCode') || ''
  )

  const [appliedPromo, setAppliedPromo] = useState(() => {
    try {
      const savedPromo = localStorage.getItem('quickTasteAppliedPromo')
      return savedPromo ? JSON.parse(savedPromo) : null
    } catch (error) {
      return null
    }
  })

  const [selectedOffer, setSelectedOffer] = useState(() => {
    const savedOffer = Number(
      localStorage.getItem('quickTasteSelectedOffer')
    )
    return savedOffer === 2 ? 2 : 1
  })

  const [promoLoading, setPromoLoading] = useState(false)
  const [checkoutSummary, setCheckoutSummary] = useState(null)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingError, setPricingError] = useState("")

  const subtotal = getTotalCartAmount()

  // Customized Cart Preview
  const safeCustomizedItems = Array.isArray(customizedCartItems) ? customizedCartItems : [];

  const customizedSubtotal = getCustomizedCartTotal();

  const displaySubtotal = Number((subtotal + customizedSubtotal).toFixed(2));

  const hasCustomizedItems = safeCustomizedItems.length > 0;

  const hasUnavailableCustomizedItems = safeCustomizedItems.some((item) => item.available !== true);

  useEffect(() => {
    const controller = new AbortController()

    const fetchCheckoutSummary = async () => {
      setPricingLoading(true)
      setPricingError("")
      setCheckoutSummary(null)

      if(!token || displaySubtotal <= 0 || customizedCartLoading){
        setPricingLoading(false)
        return
      }

      try {
        const response = await fetch(
          "http://localhost:4911/api/payment/checkout/summary",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              promoCode: appliedPromo?.code || "",
              selectedOffer: appliedPromo ? selectedOffer : 1
            }),
            signal: controller.signal
          }
        )

        const data = await response.json()

        if(!response.ok || data.success !== true){
          throw new Error(data.message || "Unable to calculate checkout pricing.")
        }

        if(!controller.signal.aborted){
          setCheckoutSummary(data.summary)
        }
      } catch (error) {
        if(!controller.signal.aborted){
          setPricingError(error.message)
        }
      } finally {
        if(!controller.signal.aborted){
          setPricingLoading(false)
        }
      }
    }

    fetchCheckoutSummary()

    return () => {
      controller.abort()
    }
  }, [token, subtotal, customizedSubtotal, customizedCartLoading, cartItems, appliedPromo?.code, selectedOffer])

  const calculateOfferDiscount = (promo, offerNumber, amount) => {
    const suffix = offerNumber === 1 ? '' : '2'
    const type = promo[`discountType${suffix}`]
    const value = Number(promo[`discountValue${suffix}`] ?? 0)
    const maxDiscount = promo[`maxDiscountAmount${suffix}`]

    if (!type) {
      return null
    }

    if (type === 'freeDelivery') {
      return {
        offerNumber,
        type,
        value,
        discount: 0,
        freeDelivery: true
      }
    }

    let discount = 0

    if (type === 'percentage') {
      discount = (amount * value) / 100

      if (maxDiscount !== null && maxDiscount !== undefined && maxDiscount !== ''){
        discount = Math.min(discount, Number(maxDiscount))
      }
    } else if(type === 'fixed'){
      discount = value
    }

    discount = Number(Math.min(amount, Math.max(0, discount)).toFixed(2))

    return {
      offerNumber,
      type,
      value,
      discount,
      freeDelivery: false
    }
  }

  const offer1 = appliedPromo ? calculateOfferDiscount(appliedPromo, 1, displaySubtotal) : null;

  const offer2 = appliedPromo ? calculateOfferDiscount(appliedPromo, 2, displaySubtotal) : null;

  const activeOffer = selectedOffer === 2 && offer2 ? offer2 : offer1

  const discountAmount = activeOffer?.discount ?? 0

  const qualifiesForFreeDelivery = subtotal >= 25 || activeOffer?.freeDelivery === true;

  const deliveryFee = subtotal === 0 ? 0 : qualifiesForFreeDelivery ? 0 : 2

  const finalSubtotal = Math.max(0, subtotal - discountAmount)

  const total = subtotal === 0 ? 0 : Number((finalSubtotal + deliveryFee).toFixed(2))

  const formatOffer = (offer) => {
    if(!offer){
      return ''
    }

    if(offer.type === 'freeDelivery'){
      return 'FREE DELIVERY'
    }

    if(offer.type === 'percentage'){
      return `${offer.value}% OFF`
    }

    return `$${Number(offer.value).toFixed(2)} OFF`
  }

  const clearSavedPromo = () => {
    localStorage.removeItem('quickTastePromoCode')
    localStorage.removeItem('quickTasteAppliedPromo')
    localStorage.removeItem('quickTasteSelectedOffer')
  }

  const handleApplyPromo = async () => {
    if(customizedCartLoading || hasUnavailableCustomizedItems){
      toast.error("Please wait for your customized cart to be ready.");
      return;
    }

    if(!promoCode.trim()){
      toast.error('Please enter a promo code.')
      return
    }

    if(displaySubtotal <= 0){
      toast.error('Your cart is empty.')
      return
    }

    try {
      setPromoLoading(true)

      const response = await fetch(
        'http://localhost:4911/api/promo/validate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: promoCode.trim().toUpperCase(),
            orderAmount: displaySubtotal
          })
        }
      )

      const data = await response.json()

      if(!response.ok || !data.success){
        setAppliedPromo(null)
        setSelectedOffer(1)
        clearSavedPromo()

        toast.error(
          data.message || 'Unable to apply promo code.'
        )
        return
      }

      const promo = {
        ...data.promo,
        discountType: data.promo.discountType,
        discountValue: Number(data.promo.discountValue ?? 0),
        maxDiscountAmount: data.promo.maxDiscountAmount ?? null,
        discountType2: data.promo.discountType2 ?? null,
        discountValue2: data.promo.discountValue2 != null ? Number(data.promo.discountValue2) : null,
        maxDiscountAmount2: data.promo.maxDiscountAmount2 ?? null
      }

      // Update React state
      setAppliedPromo(promo)
      setSelectedOffer(1)
      setPromoCode(promo.code)

      // Save the applied promo so it survives a page reload
      localStorage.setItem('quickTastePromoCode', promo.code)
      localStorage.setItem(
        'quickTasteAppliedPromo',
        JSON.stringify(promo)
      )
      localStorage.setItem('quickTasteSelectedOffer', '1')

      toast.success(
        'Promo code applied! Choose your preferred offer.'
      )
    } catch (error) {
      console.error('Promo validation error:', error)
      toast.error('Unable to apply promo code.')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setSelectedOffer(1)
    setPromoCode('')

    clearSavedPromo()

    toast.info('Promo code removed.')
  }

  const handleSelectOffer = (offerNumber) => {
    setSelectedOffer(offerNumber)

    localStorage.setItem('quickTasteSelectedOffer', String(offerNumber))
  }

  const handleCheckout = () => {
    
    if(customizedCartLoading){
      toast.info("Please wait for your cart to load.");
      return;
    }

    if(hasUnavailableCustomizedItems){
      toast.error("Please remove unavailable customizations before checkout.");
      return;
    }

    if(pricingLoading || pricingError || !checkoutSummary){
      toast.error("Please wait for checkout pricing to load.");
      return;
    }

    if(Number(checkoutSummary.subtotal) <= 0){
      toast.error("Your cart is empty.");
      return;
    }

    navigate("/order", {
      state: {
        promoCode: checkoutSummary.promoCode || "",
        discountAmount: checkoutSummary.discountAmount,
        selectedOffer: checkoutSummary.selectedOffer || 1,
        isFreeDelivery: checkoutSummary.deliveryFee === 0,
        containsCustomizedItems: hasCustomizedItems
      }
    });

  };

  return (
    <div className="cart">
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
                <div className="cart-items-title cart-items-item">
                  <img src={`http://localhost:4911/images/${item.image}`} alt={item.name}/>

                  <p>{item.name}</p>

                  <p>${Number(item.price).toFixed(2)}</p>

                  <p>{cartItems[item._id]}</p>

                  <p>${(Number(item.price) * cartItems[item._id]).toFixed(2)}</p>

                  <p onClick={() => removeFromCart(item._id)} className="cross">
                    x
                  </p>
                </div>

                <hr />
              </div>
            )
          }

          return null
        })}

        {/* Customized Cart Items */}
        {customizedCartLoading && (
          <p className="cart-custom-loading">
            Loading customized items...
          </p>
        )}

        {safeCustomizedItems.map((item) => {

          const quantity = Number(item.quantity) || 0;

          const unitPrice = Number(item.unitPrice) || 0;

          const lineTotal = Number(item.lineTotal) || 0;

          const available = item.available === true;

          const selectedDetails = Array.isArray(item.selectedDetails) ? item.selectedDetails : [];

          const foodName = item.name || food_list.find((food) => food._id === item.foodId)?.name || "Customized Food";

          const imageName = item.image || food_list.find((food) => food._id === item.foodId)?.image;

          return (
            <div key={item.variantKey} className="cart-custom-wrapper">

              <div className="cart-items-title cart-items-item cart-custom-item">
              
                <div className="cart-custom-image">
                  
                  {imageName ? (
                    <img src={`http://localhost:4911/images/${imageName}`} alt={foodName}/>
                  ) : (
                    <span>🍽️</span>
                  )}

                </div>

                {/* Product Name and Selections */}
                <div className="cart-custom-product">
                  
                  <strong>{foodName}</strong>

                  <span className="cart-custom-badge">
                    Customized
                  </span>

                  {selectedDetails.map((group) => (
                    <div key={group.groupId} className="cart-custom-selection">
                      <span>{group.groupName}:</span>
                      <strong>
                        {(group.options || []).map((option) => option.name).join(", ")}
                      </strong>
                    </div>
                  ))}

                  {selectedDetails.length === 0 && (
                    <small>Original Portion</small>
                  )}

                  {!available && (
                    <span className="cart-custom-unavailable">
                      This customization is no longer available.
                    </span>
                  )}

                </div>

                {/* Unit Price */}
                <p>
                  {available ? `$${unitPrice.toFixed(2)}` : "Unavailable"}
                </p>

                {/* Quantity */}
                <p>{quantity}</p>

                {/* Line Total */}
                <p className="cart-custom-line-total">
                  {available ? `$${lineTotal.toFixed(2)}` : "—"}
                </p>

                {/* Remove one quantity */}
                <button type="button" className="cart-custom-remove" aria-label={`Remove one ${foodName}`} title="Remove one quantity" onClick={() => removeCustomizedFromCart(item.variantKey, false)}>
                  ×
                </button>

              </div>
              
              <hr/>

            </div>
          );
        })}
      </div>

      <div className="cart-bottom">
        <div className="cart-total">
          <h2>Cart Totals</h2>

          <div>
            <div className="cart-total-details">
              <p>Subtotal</p>
              <p>${displaySubtotal.toFixed(2)}</p>
            </div>

            {hasCustomizedItems && (
              <div className="cart-custom-summary">
                
                <div className="cart-total-details">
                  <p>Regular Items</p>
                  <p>${subtotal.toFixed(2)}</p>
                </div>

                <div className="cart-total-details">
                  <p>Customized Items</p>
                  <p>${customizedSubtotal.toFixed(2)}</p>
                </div>

                <p className="cart-custom-notice">
                  Your selected portion sizes and extra add-ons are included in the cart subtotal. Final pricing is verified at checkout.
                </p>

                {hasUnavailableCustomizedItems && (
                  <p className="cart-custom-warning">
                    Some selected options are unavailable.
                    Please remove or update those items.
                  </p>
                )}

              </div>
            )}

            <hr />

            {pricingLoading && displaySubtotal > 0 && (
              <p>Calculating your best price...</p>
            )}

            {pricingError && (
              <p style={{ color: "#c62828", fontSize: "13px" }}>
                {pricingError}
              </p>
            )}

            {checkoutSummary && !pricingLoading && (
              <>
                {Number(checkoutSummary.membershipFoodDiscount) > 0 && (
                  <>
                    <div className="cart-total-details">
                      <p>
                        {checkoutSummary.membership?.planName}
                        {" "}Membership Discount
                      </p>
                      <p>
                        -${Number(checkoutSummary.membershipFoodDiscount).toFixed(2)}
                      </p>
                    </div>
                    <hr />
                  </>
                )}

                {Number(checkoutSummary.promoDiscountAmount) > 0 && (
                  <>
                    <div className="cart-total-details">
                      <p>Promo Discount</p>
                      <p>
                        -${Number(checkoutSummary.promoDiscountAmount).toFixed(2)}
                      </p>
                    </div>
                    <hr />
                  </>
                )}

                {Number(checkoutSummary.membershipDeliverySavings) > 0 && (
                  <>
                    <div className="cart-total-details">
                      <p>Membership Delivery Savings</p>
                      <p>
                        -${Number(checkoutSummary.membershipDeliverySavings).toFixed(2)}
                      </p>
                    </div>
                    <hr />
                  </>
                )}

                <div className="cart-total-details">
                  <p>Delivery Fee</p>
                  <p>
                    {Number(checkoutSummary.deliveryFee) === 0 ? "FREE" : `$${Number(checkoutSummary.deliveryFee).toFixed(2)}`}
                  </p>
                </div>

                <hr />

                <div className="cart-total-details">
                  <b>Total</b>
                  <b>${Number(checkoutSummary.total).toFixed(2)}</b>
                </div>

                {checkoutSummary.membership?.isPriorityOrder && (
                  <p style={{ color: "#087c31", fontSize: "12px", fontWeight: "700", marginTop: "12px" }}>
                    ★ PREMIUM PRIORITY ORDER
                  </p>
                )}
              </>
            )}
          </div>

          <button type="button" onClick={handleCheckout} disabled={customizedCartLoading || pricingLoading || !checkoutSummary || Boolean(pricingError) || hasUnavailableCustomizedItems || displaySubtotal <= 0}>
            {customizedCartLoading || pricingLoading ? "CALCULATING..." : "PROCEED TO CHECKOUT"}
          </button>
        </div>

        <div className="cart-promocode">
          <div>
            {!appliedPromo ? (
              <>
                <p>
                  If you have a promo code, Enter it here!
                </p>

                <div className="cart-promocode-input">
                  <input type="text" placeholder="Promo Code" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}/>

                  <button type="button" onClick={handleApplyPromo} disabled={promoLoading} >
                    {promoLoading ? 'Applying...' : 'Submit'}
                  </button>
                </div>
              </>
            ) : (
              <div className="applied-promo">
                <div>
                  <strong>{appliedPromo.code}</strong>
                  <span>Promo code applied</span>
                </div>

                <button type="button" onClick={handleRemovePromo}>Remove</button>
              </div>
            )}

            {appliedPromo && (
              <div className="promo-offer-selection">
                <h3>Choose Your Offer</h3>

                {offer1 && (
                  <label className={`promo-offer-option ${selectedOffer === 1 ? 'selected' : ''}`}>
                    <input type="radio" name="selectedPromoOffer" checked={selectedOffer === 1} onChange={() => handleSelectOffer(1)}/>

                    <span className="promo-offer-info">
                      <strong>Offer 1</strong>
                      <span>{formatOffer(offer1)}</span>
                    </span>

                    {selectedOffer === 1 && <span>✓</span>}
                  </label>
                )}

                {offer2 && (
                  <label className={`promo-offer-option ${selectedOffer === 2 ? 'selected' : ''}`}>
                    <input type="radio" name="selectedPromoOffer" checked={selectedOffer === 2} onChange={() => handleSelectOffer(2)}/>

                    <span className="promo-offer-info">
                      <strong>Offer 2</strong>
                      <span>{formatOffer(offer2)}</span>
                    </span>

                    {selectedOffer === 2 && <span>✓</span>}
                  </label>
                )}

                <p className="promo-selection-note">
                  Select one offer to apply to your order.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Cart