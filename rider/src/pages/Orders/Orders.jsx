import { useEffect, useMemo, useState } from "react";
import {ArrowRight, CalendarDays, CheckCircle2, Clock3, CreditCard, DollarSign, MapPin, Package, Phone, RefreshCw, Search, ShoppingBag, Truck, UserRound, X} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api.js";
import LiveTrackingControls from "../../components/LiveTrackingControls/LiveTrackingControls.jsx";
import "./Orders.css";

const ACTIVE_STATUSES = ["Pending", "Processing", "Out for Delivery"];

const formatDate = (value) => {
  if(!value){
    return "—";
  }

  const date = new Date(value);
  if(Number.isNaN(date.getTime())){
    return "—";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "—";
};

const getCustomerName = (order) => {
  const address = order?.address || {};
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");

  return name || order?.userId?.name || "Customer";
};

const getAddress = (order) => {
  const address = order?.address;

  if(!address){
    return "Address not available";
  }

  if(typeof address === "string"){
    return address;
  }

  return [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country
  ].filter(Boolean).join(", ") || "Address not available";
};

const getArea = (order) => {
  const address = order?.address;

  if(typeof address === "string"){
    return address.split(",").map((part) => part.trim()).filter(Boolean).pop() || "Unknown Area";
  }

  return address?.city || address?.state || "Unknown Area";
};

const getOrderTotal = (order) => {
  // Food amount after discount + final delivery fee.
  return Number(order?.amount || 0) + Number(order?.deliveryFee || 0);
};

const isCOD = (order) => {
  const method = String(order?.paymentMethod || "").toLowerCase().replace(/[\s_-]/g, "");
  return ["cod", "cashondelivery"].includes(method);
}

const getStatusClass = (status) => {
  if(status === "Delivered") return "delivered";
  if(status === "Out for Delivery") return "out";
  if(status === "Processing") return "processing";
  if(status === "Cancelled") return "cancelled";
  return"pending";
};

function Orders(){
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cashCollected, setCashCollected] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [deliveryOtp, setDeliveryOtp] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  const fetchOrders = async (refresh = false) => {
    try {
      if(refresh){
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get("/orders");
      const payload = response.data;

      if(payload?.success === false){
        throw new Error(payload.message || "Unable to load orders.");
      }

      const orderList = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : Array.isArray(payload?.data?.orders) ? payload.data.orders : Array.isArray(payload?.data) ? payload.data : null;

      if(!orderList){
        throw new Error("Unexpected orders response from server.");
      }

      setOrders(orderList);

      if(refresh){
        toast.success("Deliveries updated successfully!");
      }

    } catch (error) {
      console.error("Rider orders error:", error);

      setError(
        error.response?.data?.message || error.message || "Failed to load deliveries."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((order) => ACTIVE_STATUSES.includes(order.orderStatus)).length,
    completed: orders.filter((order) => order.orderStatus === "Delivered").length,
    pending: orders.filter((order) => order.orderStatus === "Pending").length
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {

      if(filter === "active"){
        return ACTIVE_STATUSES.includes(order.orderStatus);
      }

      if(filter === "completed"){
        return order.orderStatus === "Delivered";
      }

      return true;

    }).filter((order) => {

      if(!query){
        return true;
      }

      const searchable = [
        order._id,
        getCustomerName(order),
        getAddress(order),
        order.orderStatus,
        order.paymentMethod
      ].join(" ").toLowerCase();

      return searchable.includes(query);

    }).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [orders, filter, search]);

  const openDetails = (order) => {
    setSelectedOrder(order);
    setCashCollected(Boolean(order.riderCashCollected));

    setDeliveryOtp("");
    setOtpVerified(Boolean(order.deliveryOtpVerifiedAt));
  };

  const closeDetails = () => {
    if(confirming || verifyingOtp){
      return;
    }

    setSelectedOrder(null);
    setCashCollected(false);
    setDeliveryOtp("");
    setOtpVerified(false);
  };

  const verifyCustomerOtp = async () => {
    if(!selectedOrder || verifyingOtp){
      return
    }

    if(!/^\d{6}$/.test(deliveryOtp)){
      toast.error("Please enter a valid 6-digit OTP.");
      return;
    }

    setVerifyingOtp(true);

    try {
      const response = await api.post(
        `/delivery-otp/${selectedOrder._id}/verify-otp`,
        { otp: deliveryOtp },
        {
          baseURL: "http://localhost:4911/api"
        }
      );

      if(response.data?.success === false){
        throw new Error(
          response.data.message || "OTP verification failed."
        );
      }

      setOtpVerified(true);
      setDeliveryOtp("");

      setSelectedOrder((previous) => ({
        ...previous,
        deliveryOtpVerifiedAt: response.data.deliveryOtpVerifiedAt
      }));

      setOrders((previous) => previous.map((order) => order._id === selectedOrder._id ? {...order, deliveryOtpVerifiedAt : response.data.deliveryOtpVerifiedAt} : order ));

      toast.success("Delivery OTP verified successfully!");

    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Unable to verify delivery OTP.")
    } finally {
      setVerifyingOtp(false);
    }
  };

  const confirmDelivery = async () => {
    if(!selectedOrder || confirming){
      return;
    }

    if(selectedOrder.orderStatus !== "Out for Delivery"){
      toast.error("Order must be Out for Delivery.");
      return;
    }

    if(selectedOrder.riderDeliveryConfirmedAt){
      toast.info("Delivery has already been confirmed.");
      return;
    }

    if(isCOD(selectedOrder) && !cashCollected){
      toast.error("Please confirm that cash was collected.");
      return;
    }

    if(!otpVerified){
      toast.error("Please verify the customer's delivery OTP first.");
      return;
    }

    setConfirming(true);

    try {
      const response = await api.put(
        `/orders/${selectedOrder._id}/confirm-delivery`,
        isCOD(selectedOrder)
          ? { cashCollected: true }
          : {}
      );

      if(response.data?.success === false){
        throw new Error(
          response.data.message || "Delivery confirmation failed."
        );
      }

      toast.success(
        response.data?.message || "Delivery confirmed successfully!"
      );

      setSelectedOrder(null);
      setCashCollected(false);
      setDeliveryOtp("");
      setOtpVerified(false);

      // Reload latest assigned orders
      await fetchOrders();

    } catch (error) {
      console.error("Confirm delivery error:", error);
      toast.error(error.response?.data?.message || error.message ||  "Failed to confirm delivery.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <main className="rider-deliveries">
      <div className="rider-deliveries-container">
        
        <div className="rider-deliveries-header">
          <div>
            <p className="rider-deliveries-eyebrow">
              QUICKTASTE RIDER PORTAL
            </p>

            <h1>My Deliveries</h1>

            <p>
              Manage your assigned orders and delivery confirmations.
            </p>
          </div>

          <button type="button" className="rider-deliveries-refresh" onClick={() => fetchOrders(true)} disabled={loading || refreshing}>
            <RefreshCw size={17} className={refreshing ? "rider-deliveries-spin" : ""}/>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="rider-deliveries-stats">
          <div className="rider-deliveries-stat">
            <span className="rider-deliveries-stat-icon green">
              <Package size={23} />
            </span>
            <div>
              <p>Total Assigned</p>
              <h2>{loading ? "—" : stats.total}</h2>
            </div>
          </div>

          <div className="rider-deliveries-stat">
            <span className="rider-deliveries-stat-icon orange">
              <Truck size={23} />
            </span>
            <div>
              <p>Active Deliveries</p>
              <h2>{loading ? "—" : stats.active}</h2>
            </div>
          </div>

          <div className="rider-deliveries-stat">
            <span className="rider-deliveries-stat-icon lime">
              <CheckCircle2 size={23} />
            </span>
            <div>
              <p>Completed</p>
              <h2>{loading ? "—" : stats.completed}</h2>
            </div>
          </div>

          <div className="rider-deliveries-stat">
            <span className="rider-deliveries-stat-icon blue">
              <Clock3 size={23} />
            </span>
            <div>
              <p>Pending</p>
              <h2>{loading ? "—" : stats.pending}</h2>
            </div>
          </div>
        </div>

        <section className="rider-deliveries-panel">
          <div className="rider-deliveries-panel-heading">
            <div>
              <h2>Assigned Orders</h2>
              <p>View and manage your deliveries</p>
            </div>

            <span className="rider-deliveries-count">
              {filteredOrders.length} Orders
            </span>
          </div>

          <div className="rider-deliveries-controls">
            <div className="rider-deliveries-filters">
              <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                All Orders
              </button>

              <button type="button" className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>
                Active
              </button>

              <button type="button" className={filter === "completed" ? "active" : ""} onClick={() => setFilter("completed")}>
                Completed
              </button>
            </div>

            <div className="rider-deliveries-search">
              <Search size={18} />
              <input type="search" placeholder="Search orders..." value={search} onChange={(event) => setSearch(event.target.value)}/>
            </div>
          </div>

          {error && (
            <div className="rider-deliveries-error">
              <p>{error}</p>
              <button type="button" onClick={() => fetchOrders()}>
                Try Again
              </button>
            </div>
          )}

          {loading ? (
            <div className="rider-deliveries-empty">
              <RefreshCw size={30} className="rider-deliveries-spin" />
              <p>Loading your deliveries...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rider-deliveries-empty">
              <Package size={45} />
              <h3>No deliveries found</h3>
              <p>
                {search || filter !== "all" ? "Try changing your search or filter." : "Orders assigned by the admin will appear here."}
              </p>
            </div>
          ) : (
            <div className="rider-deliveries-list">
              {filteredOrders.map((order) => (
                <article className="rider-delivery-card" key={order._id}>
                  <div className="rider-delivery-card-top">
                    <div>
                      <span className="rider-delivery-order-label">
                        ORDER NUMBER
                      </span>
                      <h3>
                        #{String(order._id).slice(-8).toUpperCase()}
                      </h3>
                    </div>

                    <span className={`rider-delivery-status ${getStatusClass(order.orderStatus)}`}>
                      {order.orderStatus || "Pending"}
                    </span>
                  </div>

                  <div className="rider-delivery-card-info">
                    <div>
                      <UserRound size={17} />
                      <span>{getCustomerName(order)}</span>
                    </div>

                    <div>
                      <MapPin size={17} />
                      <span>{getArea(order)}</span>
                    </div>

                    <div>
                      <CalendarDays size={17} />
                      <span>{formatDate(order.createdAt)}</span>
                    </div>

                    <div>
                      <CreditCard size={17} />
                      <span>{order.paymentMethod || "Not specified"}</span>
                    </div>
                  </div>

                  <div className="rider-delivery-card-bottom">
                    <div>
                      <span>Order Total</span>
                      <strong>{formatMoney(getOrderTotal(order))}</strong>
                    </div>

                    <button type="button" onClick={() => openDetails(order)}>View Details<ArrowRight size={17}/></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedOrder && (
        <div className="rider-delivery-modal-overlay" onClick={closeDetails}>
          <div className="rider-delivery-modal" role="dialog" aria-modal="true" aria-labelledby="rider-delivery-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="rider-delivery-modal-header">
              <div>
                <p>DELIVERY DETAILS</p>
                <h2 id="rider-delivery-modal-title">
                  #{String(selectedOrder._id).slice(-8).toUpperCase()}
                </h2>
              </div>

              <button type="button" onClick={closeDetails} disabled={confirming || verifyingOtp} aria-label="Close details">
                <X size={22}/>
              </button>
            </div>

            <div className="rider-delivery-modal-body">
              <div className="rider-delivery-modal-status-row">
                <span className={`rider-delivery-status ${getStatusClass(selectedOrder.orderStatus)}`}>
                  {selectedOrder.orderStatus}
                </span>

                <span className="rider-delivery-modal-date">
                  {formatDate(selectedOrder.createdAt)}
                </span>
              </div>

              <div className="rider-delivery-detail-section">
                <h3>
                  <UserRound size={19}/>
                  Customer Information
                </h3>

                <div className="rider-delivery-detail-line">
                  <span>Name</span>
                  <strong>{getCustomerName(selectedOrder)}</strong>
                </div>

                <div className="rider-delivery-detail-line">
                  <span>Phone</span>
                  <strong>
                    {selectedOrder.address?.phone || selectedOrder.userId?.phone || "Not available"}
                  </strong>
                </div>
                
                {selectedOrder.address?.phone && (
                  <a className="rider-delivery-phone-link" href={`tel:${selectedOrder.address.phone}`}>
                    <Phone size={16}/>
                    Call Customer
                  </a>
                )}
              </div>

              <div className="rider-delivery-detail-section">
                <h3>
                  <MapPin size={19} />
                  Delivery Address
                </h3>
                <p className="rider-delivery-address">
                  {getAddress(selectedOrder)}
                </p>
              </div>

              {/* Delivery Location - Admin Approved Coordinates */}
              {selectedOrder.deliveryLocation && Number.isFinite(Number(selectedOrder.deliveryLocation.latitude)) && Number.isFinite(Number(selectedOrder.deliveryLocation.longitude)) && selectedOrder.deliveryLocation.latitude != null && selectedOrder.deliveryLocation.longitude != null && (
                <div className="rider-delivery-detail-section">
                  <h3>
                    <MapPin size={19}/>
                    Delivery Location
                  </h3>

                  <p className="rider-delivery-location-label">
                    {selectedOrder.locationChangeStatus === "Approved" ? "Admin Approved Location" : "Original Delivery Location"}
                  </p>

                  <div className="rider-delivery-detail-line">
                    <span>Latitude</span>
                    <strong>{selectedOrder.deliveryLocation.latitude}</strong>
                  </div>

                  <div className="rider-delivery-detail-line">
                    <span>Longitude</span>
                    <strong>{selectedOrder.deliveryLocation.longitude}</strong>
                  </div>

                  <a className="rider-delivery-location-link" href={`https://www.google.com/maps/dir/?api=1&destination=${selectedOrder.deliveryLocation.latitude},${selectedOrder.deliveryLocation.longitude}`} target="_blank" rel="noopener noreferrer">
                    <MapPin size={17}/>
                    Navigate with Google Maps
                  </a>
                </div>
              )}

              <div className="rider-delivery-detail-section">
                <h3>
                  <ShoppingBag size={19} />
                  Ordered Items
                </h3>

                {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item, index) => (
                    <div className="rider-delivery-item" key={`${item.foodId || item.name}-${index}`}>
                      <div>
                        <strong>{item.name}</strong>

                        <span>Qty: {item.quantity}</span>

                        {item.isCustomized && Array.isArray(item.selectedCustomizations) && item.selectedCustomizations.map((group, groupIndex) => (
                          <div key={String(group.groupId || groupIndex)} style={{ marginTop: "6px", fontSize: "12px", color: "#446b50" }}>
                            <span>
                              {group.groupName}:{" "}
                              {(group.options || []).map((option) => option.name).join(", ")}
                            </span>
                          </div>
                        ))}
                      </div>

                      <strong>{formatMoney(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                    </div>
                  ))
                ) : (
                  <p>Item details unavailable.</p>
                )}
              </div>

              <div className="rider-delivery-detail-section">
                <h3>
                  <CreditCard size={19}/>
                  Payment Details
                </h3>

                <div className="rider-delivery-detail-line">
                  <span>Payment Method</span>
                  <strong>
                    {selectedOrder.paymentMethod || "Not specified"}
                  </strong>
                </div>

                <div className="rider-delivery-detail-line">
                  <span>Payment Status</span>
                  <strong>
                    {selectedOrder.paymentStatus || "Not specified"}
                  </strong>
                </div>

                <div className="rider-delivery-detail-line">
                  <span>Order Total</span>
                  <strong>
                    {formatMoney(getOrderTotal(selectedOrder))}
                  </strong>
                </div>

                {isCOD(selectedOrder) && (
                  <div className="rider-delivery-cod-note">
                    <DollarSign size={18}/>
                    Collect the order total from the customer if it has not already been collected.
                  </div>
                )}
              </div>

              {/* Live Rider GPS Tracking */}
              {selectedOrder.orderStatus === "Out for Delivery" && !selectedOrder.riderDeliveryConfirmedAt && (
                <div className="rider-delivery-detail-section">
                  <LiveTrackingControls key={selectedOrder._id} orderId={selectedOrder._id}/>
                </div>
              )}

              {/* Delivery OTP Verification */}
              {selectedOrder.orderStatus === "Out for Delivery" && (
                <div className="rider-delivery-detail-section">

                  <h3>Delivery OTP Verification</h3>

                  {otpVerified ? (
                    <div className="rider-delivery-confirmed-message">
                      <CheckCircle2 size={20}/>
                      <strong>Delivery OTP Verified</strong>
                    </div>
                  ) : (
                    <>
                      <p>Ask the customer for the 6-digit delivery OTP sent to their email.</p>

                      <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit OTP" value={deliveryOtp} onChange={(event) => setDeliveryOtp(event.target.value.replace(/\D/g, ""))} disabled={verifyingOtp} className="rider-delivery-otp-input"/>

                      <button type="button" className="rider-delivery-confirm-button" onClick={verifyCustomerOtp} disabled={verifyingOtp || deliveryOtp.length !== 6}>
                        {verifyingOtp ? "Verifying..." : "Verify OTP"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {selectedOrder.riderDeliveryConfirmedAt ? (
                <div className="rider-delivery-confirmed-message">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>
                      {selectedOrder.orderStatus === "Delivered" ? "Delivery Completed Successfully" : "Delivery Confirmed by Rider"}
                    </strong>
                    <p>
                      {selectedOrder.orderStatus === "Delivered" ? "This order has been successfully delivered and finalized by the admin." : "Delivery confirmation has been saved. Awaiting final admin confirmation."}
                    </p>
                  </div>
                </div>
              ) : selectedOrder.orderStatus === "Out for Delivery" ? (
                <div className="rider-delivery-confirm-section">
                  <h3>Confirm Delivery</h3>

                  {isCOD(selectedOrder) && (
                    <label className="rider-delivery-cash-check">
                      <input type="checkbox" checked={cashCollected} onChange={(event) => setCashCollected(event.target.checked)}/>

                      <span>
                        I confirm that I collected the cash payment from the customer.
                      </span>
                    </label>
                  )}

                  <button type="button" className="rider-delivery-confirm-button" onClick={confirmDelivery} disabled={confirming || verifyingOtp || !otpVerified || (isCOD(selectedOrder) && !cashCollected)}>
                    <CheckCircle2 size={19}/>
                    {confirming ? "Confirming..." : "Confirm Delivery"}
                  </button>
                </div>
              ) : (
                <div className="rider-delivery-waiting">
                  <Clock3 size={19} />
                  {selectedOrder.orderStatus === "Delivered" ? "This order is already delivered." : "Delivery confirmation is available only when the order is Out for Delivery."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Orders;