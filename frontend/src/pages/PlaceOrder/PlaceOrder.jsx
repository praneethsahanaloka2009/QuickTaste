import React, { useContext, useEffect, useRef, useState } from "react"
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
import { Link, useNavigate, useLocation } from "react-router-dom";
import LocationPicker from "../../components/LocationPicker/LocationPicker";
import "./PlaceOrder.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4911";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  street: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  phone: ""
}

// Convert full name to first and last name
const splitFullName = (fullName) => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || ""
  };
};

const PlaceOrder = () => {
  
  const { getTotalCartAmount, getCustomizedCartTotal, customizedCartItems, customizedCartLoading, token, user, fetchUserProfile } = useContext(StoreContext);

  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState(EMPTY_FORM);

  const [deliveryLocation, setDeliveryLocation] = useState(null);

  const [coverage, setCoverage] = useState({
    status: "idle",
    data: null,
    message: ""
  });

  const [submitting, setSubmitting] = useState(false);

  const requestIdRef = useRef(0);

  // Saved Addresses
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [addressesError, setAddressesError] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("manual");

  // Prevent an incoming API response from overwriting an address the customer already started entering.
  const addressManuallyEditedRef = useRef(false);

  const appliedPromoCode = location.state?.promoCode || "";
  const selectedOffer = location.state?.selectedOffer === 2 ? 2 : 1;

  const regularSubtotal = getTotalCartAmount();

  const customizedSubtotal = getCustomizedCartTotal();

  const subtotal = Number((regularSubtotal + customizedSubtotal).toFixed(2));

  const hasUnavailableCustomizations = customizedCartItems.some((item) => item.available !== true);

  const [checkoutSummary, setCheckoutSummary] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState("");

  const deliveryFee = Number(checkoutSummary?.deliveryFee ?? 0);

  const total = Number(checkoutSummary?.total ?? 0);

  // Load Customer Profile
  useEffect(() => {
    if(!token || user || typeof fetchUserProfile !== "function"){
      return;
    }

    fetchUserProfile(token);
  }, [token]);

  // Fill contact details without overwriting customer edits
  useEffect(() => {
    if(!user){
      return;
    }

    const names = splitFullName(user.name);

    setFormData((previous) => {
      const updates = {
        firstName: previous.firstName || names.firstName,
        lastName: previous.lastName || names.lastName,
        email: previous.email || user.email || "",
        phone: previous.phone || user.phone || ""
      };

      if(previous.firstName === updates.firstName && previous.lastName === updates.lastName && previous.email === updates.email && previous.phone === updates.phone){
        return previous;
      }

      return {
        ...previous,
        ...updates
      };
    });
  }, [user?.name, user?.email, user?.phone]);

  // Saved Address Helper
  const applySavedAddress = (address) => {
    if(!address){
      return;
    }

    const latitude = Number(address.latitude);
    const longitude = Number(address.longitude);

    setFormData((previous) => ({
      ...previous,
      street: address.fullAddress || "",
      city: address.city || "",
      state: address.state || "",
      zipCode: address.zipCode || "",
      country: address.country || ""
    }));

    if(Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180){
      setDeliveryLocation({
        latitude,
        longitude
      });
    } else {
      setDeliveryLocation(null);
    }

    // Clear previous coverage immediately.
    setCoverage({
      status: "idle",
      data: null,
      message: "Checking the selected saved address..."
    });

    setSelectedAddressId(address._id);
    addressManuallyEditedRef.current = false;
  };

  const handleSavedAddressChange = (event) => {
    const addressId = event.target.value;

    if(addressId === "manual"){
      addressManuallyEditedRef.current = true;

      setSelectedAddressId("manual");

      setFormData((previous) => ({
        ...previous,
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "Sri Lanka"
      }));

      setDeliveryLocation(null);

      setCoverage({
        status: "idle",
        data: null,
        message: "Select your delivery location on the map."
      });

      return;
    }

    const selected = savedAddresses.find(
      (address) => address._id === addressId
    );

    if(selected){
      applySavedAddress(selected);
    }
  };

  // Load Saved Addresses
  useEffect(() => {
    if(!token){
      setSavedAddresses([]);
      setAddressesLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadSavedAddresses = async () => {
      try {
        setAddressesLoading(true);
        setAddressesError("");

        const response = await fetch(
          `${API_URL}/api/user/addresses`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`
            },
            cache: "no-store",
            signal: controller.signal
          }
        );

        const result = await response.json();

        if(!response.ok || result.success !== true){
          throw new Error(result.message || "Unable to load saved addresses.");
        }

        if(controller.signal.aborted){
          return;
        }

        const addresses = Array.isArray(result.addresses) ? result.addresses : [];

        setSavedAddresses(addresses);

        const defaultAddress = addresses.find((address) => address.isDefault === true);

        if(defaultAddress && !addressManuallyEditedRef.current){
          applySavedAddress(defaultAddress);
        }

      } catch (error) {
        if(!controller.signal.aborted){
          setAddressesError(error.message || "Unable to load saved addresses.");
        }
      } finally {
        if(!controller.signal.aborted){
          setAddressesLoading(false);
        }
      }
    };

    loadSavedAddresses();

    return () => {
      controller.abort();
    }

  }, [token]);

  // Trust Memberships and Promo Pricing
  useEffect(() => {
    const controller = new AbortController();

    const loadCheckoutPricing = async () => {
      setPricingLoading(true);
      setPricingError("");
      setCheckoutSummary(null);

      if(!token || subtotal <= 0 || customizedCartLoading){
        setPricingError(
          "Please log in and add items to your cart."
        );
        setPricingLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/payment/checkout/summary`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              promoCode: appliedPromoCode,
              selectedOffer
            }),
            signal: controller.signal
          }
        );

        const result = await response.json();

        if(!response.ok || result.success !== true){
          throw new Error(result.message || "Unable to calculate checkout pricing.");
        }

        if(!controller.signal.aborted){
          setCheckoutSummary(result.summary);
        }

      } catch (error) {
        if(!controller.signal.aborted){
          setPricingError(error.message);
        }
      } finally {
        if(!controller.signal.aborted){
          setPricingLoading(false);
        }
      }
    };

    loadCheckoutPricing();

    return () => {
      controller.abort();
    }
  }, [token, subtotal, customizedCartLoading, appliedPromoCode, selectedOffer]);

  // Delivery Coverage Check
  useEffect(() => {
    const latitude = deliveryLocation?.latitude;
    const longitude = deliveryLocation?.longitude;

    const requestId = ++requestIdRef.current;

    if(typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)){
      setCoverage({
        status: "idle",
        data: null,
        message: "Select your delivery location on the map."
      });

      return;
    }

    const controller = new AbortController();

    setCoverage({
      status: "checking",
      data: null,
      message: "Checking delivery availability..."
    });

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/branch/check-coverage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              deliveryLocation: {
                latitude,
                longitude
              }
            }),
            signal: controller.signal
          }
        );

        const result = await response.json();

        if(controller.signal.aborted || requestId !== requestIdRef.current){
          return;
        }

        if(!response.ok || result.success !== true){
          throw new Error(
            result.message || "Unable to check delivery coverage."
          );
        }

        if(result.available === true && result.branch){
          setCoverage({
            status: "available",
            data: result,
            message: result.message
          });
        } else {
          setCoverage({
            status: "unavailable",
            data: null,
            message: result.message || "Delivery is not available at this location."
          });
        }

      } catch (error) {
        if(controller.signal.aborted || requestId !== requestIdRef.current){
          return;
        }

        setCoverage({
          status: "error",
          data: null,
          message: error.message || "Unable to check delivery coverage."
        });
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };

  }, [deliveryLocation?.latitude, deliveryLocation?.longitude]);

  // Handle Delivery Form Change
  const handleChange = (event) => {
    const { name, value } = event.target;

    const addressFields = [
      "street",
      "city",
      "state",
      "zipCode",
      "country"
    ];

    // A manual address change invalidates the saved GPS.
    if(addressFields.includes(name) && formData[name] !== value){
      addressManuallyEditedRef.current = true;
      setSelectedAddressId("manual");
      setDeliveryLocation(null);

      setCoverage({
        status: "idle",
        data: null,
        message: "Address changed. Please select the delivery location again."
      });
    }

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleLocationChange = (nextLocation) => {
    setDeliveryLocation(nextLocation);

    const oldLatitude = deliveryLocation?.latitude;
    const oldLongitude = deliveryLocation?.longitude;

    if(nextLocation?.latitude !== oldLatitude || nextLocation?.longitude !== oldLongitude){
      addressManuallyEditedRef.current = true;
      setSelectedAddressId("manual");
    }
  };

  // Proceed to Payment
  const handleSubmit = async (event) => {
    event.preventDefault();

    if(submitting){
      return;
    }

    if(customizedCartLoading || hasUnavailableCustomizations){
      toast.error("Please wait for your cart to load or remove unavailable items.");
      return;
    }

    if(pricingLoading || !checkoutSummary || pricingError){
      toast.error("Please wait for checkout pricing to load.");
      return;
    }

    if(!token){
      toast.error("Please login to continue.");
      return;
    }

    if(subtotal <= 0){
      toast.error("Your cart is empty.");
      return;
    }

    if(deliveryLocation?.latitude == null || deliveryLocation?.longitude == null){
      toast.error("Please select your delivery location on the map.");
      return;
    }

    if(coverage.status !== "available"){
      toast.error(coverage.message || "Please check your delivery location.");
      return;
    }

    const currentRequestId = requestIdRef.current;

    setSubmitting(true);

    try {
      // Recheck coverage before payment
      const response = await fetch(
        `${API_URL}/api/branch/check-coverage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            deliveryLocation
          })
        }
      );

      const result = await response.json();

      if(!response.ok || result.success !== true){
        throw new Error(
          result.message || "Unable to verify delivery availability."
        );
      }

      if(result.available !== true){
        setCoverage({
          status: "unavailable",
          data: null,
          message: result.message || "Delivery is not available at this location."
        });

        toast.error(
          result.message || "Delivery is not available at this location."
        );

        return;
      }

      if(requestIdRef.current !== currentRequestId){
        return;
      }

      navigate("/payment", {
        state: {
          formData,
          deliveryLocation,

          subtotal: checkoutSummary.subtotal,
          discountAmount: checkoutSummary.discountAmount,

          membershipFoodDiscount: checkoutSummary.membershipFoodDiscount,

          membershipDeliverySavings: checkoutSummary.membershipDeliverySavings,

          promoDiscountAmount: checkoutSummary.promoDiscountAmount,

          promoCode: appliedPromoCode,
          selectedOffer,

          deliveryFee: checkoutSummary.deliveryFee,
          total: checkoutSummary.total,
          containsCustomizedItems: location.state?.containsCustomizedItems === true || customizedCartItems.length > 0
        }
      });

    } catch (error) {
      toast.error(
        error.message || "Unable to verify delivery availability."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = coverage.status === "available" && !submitting && !pricingLoading && !customizedCartLoading && !hasUnavailableCustomizations && !pricingError && checkoutSummary !== null && Number(checkoutSummary.subtotal) > 0;

  return (
    <form className="place-order" onSubmit={handleSubmit}>
      
      <div className="place-order-left">
        
        <p className="title">
          Delivery Information
        </p>

        {/* Saved Delivery Addresses */}
        <div className="qt-checkout-saved-addresses">
          
          <div className="qt-checkout-saved-header">
            <div>
              <h3>Saved Delivery Addresses</h3>
              <p>
                Select an address to fill your delivery details automatically.
              </p>
            </div>

            <Link to="/my-addresses">
              Manage
            </Link>
          </div>

          {addressesLoading ? (
            <p className="qt-checkout-saved-message">
              Loading saved addresses...
            </p>
          ) : addressesError ? (
            <p className="qt-checkout-saved-error">
              {addressesError}
            </p>
          ) : (
            <>
              <label htmlFor="qt-saved-address-select">
                Choose Delivery Address
              </label>

              <select id="qt-saved-address-select" value={selectedAddressId} onChange={handleSavedAddressChange}>
                <option value="manual">
                  Enter Address Manually
                </option>

                {savedAddresses.map((address) => (
                  <option key={address._id} value={address._id}>
                    {address.label}{address.isDefault ? " (Default)" : ""}{" — "}{address.fullAddress}
                  </option>
                ))}
              </select>

              {selectedAddressId !== "manual" && (
                <p className="qt-checkout-selected-note">
                  ✓ Saved address selected. Delivery availability is being verified using its GPS location.
                </p>
              )}

              {savedAddresses.length === 0 && (
                <p className="qt-checkout-saved-message">
                  No saved addresses yet. You can enter your address manually or save one for future orders.
                </p>
              )}
            </>
          )}

        </div>

        {/* Customer Contact Information */}
        <div className="multi-fields">
          <input type="text" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required/>
          <input type="text" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required/>
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

        {/* Existing Location Picker */}
        <LocationPicker value={deliveryLocation} onChange={handleLocationChange}/>

        {/* Live Delivery Coverage */}
        <div className={`delivery-coverage delivery-coverage-${coverage.status}`}>
          
          {coverage.status === "idle" && (
            <p>
              {coverage.message || "Select a location to check delivery availability."}
            </p>
          )}

          {coverage.status === "checking" && (
            <p>
              Checking delivery availability...
            </p>
          )}

          {coverage.status === "available" && coverage.data && (
            <>
              <h3>✓ Delivery Available</h3>

              <p>
                Your location is within our delivery coverage.
              </p>

              <div className="delivery-coverage-details">
                
                <div>
                  <span>Serving Branch</span>
                  <strong>
                    {coverage.data.branch.name}
                  </strong>
                </div>

                <div>
                  <span>Road Distance</span>
                  <strong>
                    {Number(coverage.data.deliveryDistanceKm).toFixed(2)} km
                  </strong>
                </div>

                <div>
                  <span>Delivery Radius</span>
                  <strong>
                    {coverage.data.branch.deliveryRadiusKm} km
                  </strong>
                </div>

                {Number.isFinite(coverage.data.estimatedTravelMinutes) && (
                  <div>
                    <span>Estimated Road Travel</span>
                    <strong>
                      {Math.round(coverage.data.estimatedTravelMinutes)} min
                    </strong>
                  </div>
                )}

              </div>
            </>
          )}

          {coverage.status === "unavailable" && (
            <>
              <h3>Delivery Not Available</h3>
              <p>{coverage.message}</p>
            </>
          )}

          {coverage.status === "error" && (
            <>
              <h3>Coverage Check Failed</h3>
              <p>{coverage.message}</p>
            </>
          )}

        </div>

      </div>

      {/* Cart Totals */}
      <div className="place-order-right">
        
        <div className="cart-total">
          <h2>Cart Totals</h2>

          <div>
            <div className="cart-total-details">
              <p>Subtotal</p>
              <p>${Number(checkoutSummary?.subtotal ?? subtotal).toFixed(2)}</p>
            </div>

            <hr/>

            {pricingLoading && (
              <p>
                Calculating membership benefits...
              </p>
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
                        {checkoutSummary.membership?.planName}{" "}Membership Discount
                      </p>
                      <p>
                        -${Number(checkoutSummary.membershipFoodDiscount).toFixed(2)}
                      </p>
                    </div>
                    <hr/>
                  </>
                )}

                {Number(checkoutSummary.promoDiscountAmount) > 0 && (
                  <>
                    <div className="cart-total-details">
                      <p>
                        Promo Discount
                        {appliedPromoCode && ` (${appliedPromoCode})`}
                      </p>
                      <p>
                         -${Number(checkoutSummary.promoDiscountAmount).toFixed(2)}
                      </p>
                    </div>
                    <hr/>
                  </>
                )}

                {Number(checkoutSummary.membershipDeliverySavings) > 0 && (
                  <>
                    <div className="cart-total-details">
                      <p>
                        Membership Delivery Savings
                      </p>
                      <p>
                        -${Number(checkoutSummary.membershipDeliverySavings).toFixed(2)}
                      </p>
                    </div>
                    <hr/>
                  </>
                )}

                <div className="cart-total-details">
                  <p>Delivery Fee</p>
                  <p>
                    {deliveryFee === 0 ? "FREE" : `$${deliveryFee.toFixed(2)}`}
                  </p>
                </div>

                <hr/>

                <div className="cart-total-details">
                  <b>Total</b>
                  <b>${total.toFixed(2)}</b>
                </div>

                {checkoutSummary.membership?.isPriorityOrder && (
                  <p style={{ color: "#087c31", fontWeight: 700, fontSize: "12px", marginTop: "12px" }}>
                    ★ PREMIUM PRIORITY ORDER
                  </p>
                )}

              </>
            )}
          </div>

          <button type="submit" disabled={!canProceed}>
            {submitting ? "VERIFYING DELIVERY..." : pricingLoading ? "CALCULATING..." : coverage.status === "checking" ? "CHECKING DELIVERY..." : "PROCEED TO PAYMENT"}
          </button>
        </div>

      </div>

    </form>
  );

};

export default PlaceOrder;