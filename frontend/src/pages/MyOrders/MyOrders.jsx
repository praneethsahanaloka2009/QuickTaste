import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from "react-router-dom";
import { StoreContext } from '../../context/StoreContext'
import { toast } from "react-toastify";
import "./MyOrders.css";

const MyOrders = () => {

    const { token } = useContext(StoreContext);
    const navigate = useNavigate();

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Cancellation States
    const [showCancelPopup, setShowCancelPopup] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [customReason, setCustomReason] = useState("");
    const [cancelling, setCancelling] = useState(false);

    // Customer Cancellation Reasons
    const cancellationReasons = ["Changed my mind", "Ordered by mistake", "Order taking too long", "No longer needed", "Found another option", "Other"];

    // Fetch User Orders
    const fetchOrders = async () => {
        
        try {
            const response = await fetch("http://localhost:4911/api/order/my-orders",
                {
                    method : "GET",
                    headers : {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(data.success){
                setOrders(data.orders || []);
            } else {
                toast.error(
                    data.message || "Unable to load your orders."
                );
            }

        } catch (error) {
            console.log("My Orders Error:", error);

            toast.error(
                "Something went wrong while loading your orders."
            );
        } finally {
            setLoading(false);
        }

    };

    // Load Orders
    useEffect(() => {
        if(token){
            fetchOrders();
        } else {
            setLoading(false);
        }
    }, [token]);

    // Open Cancel Popup
    const openCancelPopup = (order) => {
        setSelectedOrder(order);
        setCancelReason("");
        setCustomReason("");
        setShowCancelPopup(true);
    };

    // Close Cancel Popup
    const closeCancelPopup = () => {
        if(cancelling) return;

        setShowCancelPopup(false);
        setSelectedOrder(null);
        setCancelReason("");
        setCustomReason("");
    }

    // Cancel Order
    const handleCancelOrder = async () => {
        
        if(!selectedOrder){
            return;
        }

        if(!cancelReason){
            toast.error("Please select a cancellation reason.");
            return;
        }

        let finalReason = cancelReason;

        // Handle Other reason
        if(cancelReason === "Other"){
            
            if (!customReason.trim()){
                toast.error("Please enter your cancellation reason.");
                return;
            }

            finalReason = `Other: ${customReason.trim()}`;

        }

        try {
            setCancelling(true);

            const response = await fetch(`http://localhost:4911/api/order/cancel/${selectedOrder._id}`,{
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason: finalReason
                })
            });

            const data = await response.json();

            if(data.success){
                
                // Update order in the current list
                setOrders((prevOrders) => prevOrders.map((order) => order._id === selectedOrder._id ? data.order : order));
                toast.success("Order cancelled successfully.");
                closeCancelPopup();

            } else {
                
                toast.error(
                    data.message || "Failed to cancel order."
                );

            }

        } catch (error) {
            
            console.log("Cancel Order Error:", error);
            toast.error("Something went wrong while cancelling the order.");

        } finally {
            
            setCancelling(false);

        }

    };

    // Loading
    if(loading){
        return(
            <div className='my-orders'>
                <div className="my-orders-loading">
                    <h2>Loading Your Orders...</h2>
                    <p>Please wait while we load your orders.</p>
                </div>
            </div>
        );
    }

    // Not Logged In
    if(!token){
        return(
            <div className="my-orders">
                <div className="my-orders-empty">

                    <h2>Please Login</h2>

                    <p>You need to login to view your orders.</p>

                    <button onClick={() => navigate("/")}>
                        GO TO HOME
                    </button>

                </div>
            </div>
        );
    }

    // No Orders
    if(orders.length === 0){
        return (
            <div className="my-orders">
                <div className="my-orders-empty">
                    
                    <h2>No Orders Yet</h2>

                    <p>You haven't placed any orders yet.</p>

                    <button onClick={() => navigate("/")}>
                        ORDER NOW
                    </button>

                </div>
            </div>
        );
    }

    // Orders Page
    return (
        <div className='my-orders'>
            
            <div className="my-orders-container">
                
                <div className="my-orders-title">
                    
                    <h2>My Orders</h2>

                    <p>View and track all your orders.</p>

                </div>

                <div className="orders-list">
                    
                    {orders.map((order) => (
                        
                        <div className='order-card' key={order._id}>
                            
                            {/* Order Header */}
                            <div className="order-card-header">
                                
                                <div>
                                    
                                    <h3>Order #{order._id.slice(-8).toUpperCase()}</h3>

                                    <p>{new Date(order.createdAt).toLocaleDateString()}</p>

                                </div>

                                <div className="order-status">
                                    
                                    <span>{order.orderStatus}</span>

                                </div>

                            </div>

                            {/* Order Items */}
                            <div className="order-items">
                                
                                {order.items?.map((item, index) => (
                                    
                                    <div className="order-item" key={index}>
                                        
                                        <div className="order-item-info">
                                            
                                            <div className="order-item-image">
                                                
                                                <div className="order-item-placeholder">
                                                    🍴
                                                </div>

                                            </div>

                                            <div>
                                                
                                                <h4>{item.name}</h4>

                                                <p>Quantity: {item.quantity}</p>

                                            </div>

                                        </div>

                                        <div className="order-item-price">
                                            
                                            ${(Number(item.price) * Number(item.quantity)).toFixed(2)}

                                        </div>

                                    </div>

                                ))}

                            </div>

                            {/* Order Footer */}
                            <div className="order-card-footer">
                                
                                <div className="order-total">
                                    
                                    <span>Total</span>

                                    <strong>${Number(order.amount).toFixed(2)}</strong>

                                </div>

                                <div className="order-actions">
                                    {/* Track Order */}
                                    <button className='track-order-button' onClick={() => navigate(`/track-order/${order._id}`)}>
                                        TRACK ORDER
                                    </button>

                                    {/* Cancel Order */}
                                    {(order.orderStatus === "Pending" || order.orderStatus === "Processing") && (
                                        <button className="cancel-order-button" onClick={() => openCancelPopup(order)}>
                                            CANCEL ORDER
                                        </button>
                                    )}
                                </div>

                            </div>

                            {/* Cancellation Information */}
                            {order.orderStatus === "Cancelled" && order.cancellationReason && (
                                <div className="cancellation-info">
                                    <p><strong>Cancelled by:</strong>{" "}{order.cancelledBy}</p>

                                    <p><strong>Reason:</strong>{" "}{order.cancellationReason}</p>

                                    {order.cancelledAt && (
                                        <p><strong>Cancelled on:</strong>{" "}{new Date(order.cancelledAt).toLocaleDateString()}</p>
                                    )}
                                </div>
                            )}

                        </div>

                    ))}

                </div>

            </div>

            {/* Cancel Order Popup */}
            {showCancelPopup && selectedOrder && (
                <div className="cancel-popup-overlay">
                    
                    <div className="cancel-popup">
                        
                        <div className="cancel-popup-header">
                            
                            <h3>Cancel Order</h3>

                            <button className='cancel-popup-close' onClick={closeCancelPopup} disabled={cancelling}>×</button>

                        </div>

                        <div className="cancel-popup-content">
                            
                            <p>Are you sure you want to cancel<strong>{" "}Order #{selectedOrder._id.slice(-8).toUpperCase()}</strong>?</p>

                            <label>Why do you want to cancel this order?</label>

                            <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} disabled={cancelling}>
                                
                                <option value="">Select a reason</option>

                                {cancellationReasons.map((reason) => (
                                    <option key={reason} value={reason}>{reason}</option>
                                ))}

                            </select>

                            {/* Other Reason */}
                            {cancelReason === "Other" && (
                                <textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder='Please enter your reason...' rows="3" disabled={cancelling}/>
                            )}

                        </div>

                        <div className="cancel-popup-actions">
                            
                            <button className="cancel-popup-back" onClick={closeCancelPopup} disabled={cancelling}>KEEP ORDER</button>

                            <button className="cancel-popup-confirm" onClick={handleCancelOrder} disabled={cancelling}>
                                {cancelling ? "CANCELLING..." : "CANCEL ORDER"}
                            </button>

                        </div>

                    </div>

                </div>
            )}

        </div>
    );

};

export default MyOrders;
