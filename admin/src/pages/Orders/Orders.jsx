import React, { useEffect, useState } from 'react'
import './Orders.css'
import { toast } from 'react-toastify'
import { API_URL } from '../../config/api'

const sortOrdersByPriority = (orders) => {
    return [...orders].sort((a, b) => {
        const aPriority = a.isPriorityOrder === true && a.orderStatus === "Pending" && (a.paymentMethod === "Cash on Delivery" || a.paymentStatus === "Paid");

        const bPriority = b.isPriorityOrder === true && b.orderStatus === "Pending" && (b.paymentMethod === "Cash on Delivery" || b.paymentStatus === "Paid");

        if(aPriority !== bPriority){
            return aPriority ? -1 : 1;
        }

        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
};

const Orders = () => {

    const [orders, setOrders] = useState([])
    const [riders, setRiders] = useState([])
    const [selectedRiders, setSelectedRiders] = useState({});
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(Date.now())
    const [updatingOrderId, setUpdatingOrderId] = useState(null)

    // Refund modal states
    const [selectedRefundOrder, setSelectedRefundOrder] = useState(null)
    const [refundReasonInput, setRefundReasonInput] = useState('')

    useEffect(() => {
        fetchOrders();
        fetchRiders();

        // Update preparation countdown every second
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const fetchOrders = async () => {

        try {

            const token = localStorage.getItem("adminToken")

            if (!token) {
                toast.error("Please login as admin first!")
                setLoading(false)
                return
            }

            const response = await fetch(
                `${API_URL}/api/order/admin/orders`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                }
            )

            const data = await response.json()

            if(data.success){
                setOrders(data.orders || [])
            } else {
                toast.error(data.message || "Failed to fetch orders")
            }

        } catch (error) {

            console.log("Fetch Orders Error:", error)
            toast.error("Something went wrong while loading orders!")

        } finally {

            setLoading(false)

        }

    }

    // Fetch available riders
    const fetchRiders = async () => {
        try {
            const token = localStorage.getItem("adminToken");

            if(!token){
                return;
            }

            const response = await fetch(
                `${API_URL}/api/admin/riders`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(response.ok && data.success){
                setRiders((data.riders || []).filter(rider => rider.isActive));
            } else {
                toast.error(data.message || "Failed to load riders.");
            }

        } catch (error) {
            console.error("Fetch Riders Error:", error);
            toast.error("Unable to load available riders.");
        }
    };

    // Assign rider to an order
    const assignRider = async (orderId) => {
        const riderId = selectedRiders[orderId];

        if(!riderId){
            toast.error("Please select a rider.");
            return;
        }

        if(updatingOrderId){
            return;
        }

        try {
            const token = localStorage.getItem("adminToken");

            if(!token){
                toast.error("Please login as admin first.");
                return;
            }

            setUpdatingOrderId(orderId);

            const response = await fetch(
                `${API_URL}/api/admin/orders/${orderId}/assign-rider`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ riderId })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                toast.error(data.message || "Failed to assign rider.");
                return;
            }

            toast.success("Rider assigned successfully!");

            await fetchOrders();

        } catch (error) {
            console.error("Assign Rider Error:", error);
            toast.error("Something went wrong while assigning rider.");
        } finally {
            setUpdatingOrderId(null);
        }
    };

    // Customer Location Approval
    const updateLocationApproval = async (orderId, action) => {
        if(updatingOrderId){
            return;
        }

        if(!["approve", "reject"].includes(action)){
            return;
        }

        try {
            const token = localStorage.getItem("adminToken");

            if(!token){
                toast.error("Please login as admin first.");
                return;
            }

            setUpdatingOrderId(orderId);

            const response = await fetch(
                `${API_URL}/api/admin/orders/${orderId}/${action}-location`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                toast.error(data.message || "Failed to update location request.");
                return;
            }

            toast.success(action === "approve" ? "Customer location approved successfully!" : "Customer location rejected.");

            await fetchOrders();

        } catch (error) {
            console.error("Location Approval Error:", error);
            toast.error("Unable to update location request.");
        } finally {
            setUpdatingOrderId(null);
        }
    };

    // Calculate total preparation time for an order
    const getPreparationMinutes = (order) => {
        if(!Array.isArray(order.items)){
            return 0
        }

        return order.items.reduce((total, item) => {
            const minutes = Number(item.preparationTime) || 15
            const quantity = Number(item.quantity) || 1

            return total + minutes * quantity
        }, 0)
    }

    // Calculate remaining preparation time
    const getRemainingMs = (order) => {
        if(!order.preparationStartedAt){
            return null
        }

        const startTime = new Date(order.preparationStartedAt).getTime()
        const endTime = startTime + getPreparationMinutes(order) * 60 * 1000

        return Math.max(0, endTime - currentTime)
    }

    // Format countdown
    const formatRemainingTime = (milliseconds) => {
        const totalSeconds = Math.ceil(milliseconds / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60

        return `${minutes}m ${String(seconds).padStart(2, '0')}s`
    }

    // Accept an order or update its next status
    const updateStatus = async (orderId, newStatus) => {
        const order = orders.find(item => item._id === orderId)

        if(!order || updatingOrderId){
            return
        }

        const allowedTransitions = {
            Pending: ['Processing'],
            Processing: ['Out for Delivery'],
            'Out for Delivery': ['Delivered']
        }

        if(!allowedTransitions[order.orderStatus || 'Pending']?.includes(newStatus)){
            toast.error('This status transition is not allowed!')
            return
        }

        // Do not allow dispatch before preparation finishes
        if(order.orderStatus === 'Processing' && newStatus === 'Out for Delivery'){
            const remaining = getRemainingMs(order)

            if(remaining === null || remaining > 0){
                toast.error(remaining === null ? 'Preparation start time is missing.' : `Preparation is not finished. Please wait ${formatRemainingTime(remaining)}.`)
                return
            }
        }

        try {
            const token = localStorage.getItem('adminToken')

            if(!token){
                toast.error('Please login as admin first!')
                return
            }

            setUpdatingOrderId(orderId)

            const response = await fetch(
                `${API_URL}/api/order/admin/update-status/${orderId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        status: newStatus
                    })
                }
            )

            const data = await response.json()

            if(data.success){
                setOrders(prevOrders => prevOrders.map(item => item._id === orderId ? { ...item, ...(data.order || {}), orderStatus: data.order?.orderStatus || newStatus } : item))

                if(newStatus === 'Processing'){
                    toast.success('Order accepted! Food preparation has started.')
                } else {
                    toast.success(`Order status updated to ${newStatus}!`)
                }
            } else {
                toast.error(data.message || 'Failed to update order status')
            }
        } catch (error) {
            console.error('Update Status Error:', error)
            toast.error('Something went wrong while updating status!')
        } finally {
            setUpdatingOrderId(null)
        }
    }

    // Open refund modal
    const requestRefund = async (order) => {
        if(order.orderStatus !== "Cancelled"){
            toast.error("Only cancelled orders can be refunded.");
            return;
        }

        if(order.paymentMethod !== "Stripe" || order.paymentStatus !== "Paid"){
            toast.error("Only paid Stripe orders can be refunded.");
            return;
        }

        if(order.refundStatus === "Refunded" || order.refundStatus === "Processing" || order.stripeRefundId){
            toast.error("A refund has already been processed or requested.");
            return;
        }
        
        setRefundReasonInput('')
        setSelectedRefundOrder(order)
    }

    // Close refund modal
    const closeRefundModal = () => {
        if(updatingOrderId === selectedRefundOrder?._id){
            return
        }

        setSelectedRefundOrder(null)
        setRefundReasonInput('')
    }

    // Submit refund request to backend
    const confirmRefund = async () => {
        if(!selectedRefundOrder){
            return
        }

        if(!refundReasonInput.trim()){
            toast.error("Please enter a refund reason.");
            return;
        }

        if(updatingOrderId){
            return;
        }

        try {
            const token = localStorage.getItem("adminToken");

            if(!token){
                toast.error("Please login as admin first!");
                return;
            }

            const orderId = selectedRefundOrder._id

            setUpdatingOrderId(orderId);

            const response = await fetch(
                `${API_URL}/api/payment/stripe/refund/${orderId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        reason: refundReasonInput.trim()
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                toast.error(data.message || "Failed to process refund.");
                return;
            }

            toast.success(data.message || "Refund request submitted.");

            setSelectedRefundOrder(null)
            setRefundReasonInput('')

            await fetchOrders();
        } catch (error) {
            console.error("Refund Error:", error);
            toast.error("Something went wrong while processing the refund.");
        } finally {
            setUpdatingOrderId(null);
        }
    };

    if (loading) {
        return (
            <div className="orders-page">
                <h2>Orders</h2>
                <p className="orders-loading">Loading orders...</p>
            </div>
        )
    }

    return (
        <div className="orders-page">

            <div className="orders-header">
                <h2>Orders</h2>
                <p>Manage all customer orders</p>
            </div>

            {orders.length === 0 ? (

                <div className="no-orders">
                    <h3>No Orders Found</h3>
                    <p>There are no customer orders yet.</p>
                </div>

            ) : (

                <div className="order-list">
                    {sortOrdersByPriority(orders).map(order => {
                        const status = order.orderStatus || 'Pending'
                        const isUpdating = updatingOrderId === order._id
                        const remaining = getRemainingMs(order)

                        const preparationFinished = remaining !== null && remaining <= 0

                        return(
                            <div className="order-card" key={order._id}>
                                <div className="order-card-top">
                                    <div>
                                        <div className="order-title-row">
                                            <h3>
                                                Order #{order._id.slice(-6).toUpperCase()}
                                            </h3>

                                            {order.isPriorityOrder === true && (
                                                <span className="order-priority-badge">
                                                    ★ PREMIUM PRIORITY
                                                </span>
                                            )}
                                        </div>
                                        <p>
                                            {new Date(order.createdAt).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className="order-status-control">
                                        {status === 'Pending' && (
                                            <button type="button" className="accept-order-btn" disabled={isUpdating || (order.paymentMethod !== 'Cash on Delivery' && order.paymentStatus !== 'Paid')} onClick={() => updateStatus(order._id, 'Processing')}>
                                                {isUpdating ? 'Please wait...' : (order.paymentMethod === 'Cash on Delivery' || order.paymentStatus === 'Paid') ? 'Accept Order' : 'Payment Pending'}
                                            </button>
                                        )}

                                        {status === 'Processing' && (
                                            <div className="preparation-status">
                                                <span>{preparationFinished ? 'Preparation complete' : remaining === null ? 'Preparation start time missing' : `Preparing: ${formatRemainingTime(remaining)}`}</span>

                                                <select className="order-status-select" value={status} disabled aria-label="Current order status">
                                                    <option value="Processing">Processing</option>
                                                </select>

                                                <button type="button" className="dispatch-order-btn" disabled={isUpdating || !preparationFinished} onClick={() => updateStatus(order._id, 'Out for Delivery') }>
                                                    {isUpdating ? 'Please wait...' : 'Out for Delivery'}
                                                </button>
                                            </div>
                                        )}

                                        {status === 'Out for Delivery' && (
                                            <div className="preparation-status">
                                                <select className="order-status-select" value={status} disabled aria-label="Current order status">
                                                    <option value="Out for Delivery">Out for Delivery</option>
                                                </select>

                                                <button type="button" className="dispatch-order-btn" disabled={isUpdating} onClick={() => updateStatus(order._id, 'Delivered')}>
                                                    {isUpdating ? 'Please wait...' : 'Mark Delivered'}
                                                </button>
                                            </div>
                                        )}

                                        {(status === 'Delivered' || status === 'Cancelled') && (
                                            <div className="order-final-actions">
                                                <span className={`order-final-status ${status === 'Cancelled' ? 'cancelled' : ''}`}>
                                                    {status}
                                                </span>

                                                {status === 'Cancelled' && order.paymentMethod === 'Stripe' && order.paymentStatus === 'Paid' && (
                                                    order.refundStatus === 'Refunded' ? (
                                                        <span className="refund-completed">
                                                            Refunded
                                                        </span>
                                                    ) : (
                                                        <button type="button" className="refund-order-btn" disabled={isUpdating || order.refundStatus === 'Processing' || Boolean(order.stripeRefundId)} onClick={() => requestRefund(order)}>
                                                            {isUpdating ? 'Please wait...' : order.refundStatus === 'Processing' ? 'Refund Processing' : order.refundStatus === 'Failed' ? 'Retry Refund' : 'Issue Refund'}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Rider Assignment */}
                                {status !== "Delivered" && status !== "Cancelled" && (
                                    <div className="rider-assignment">
                                        <h4>Rider Assignment</h4>

                                        <p>
                                            <strong>Assigned Rider: </strong>
                                            {riders.find(rider => rider._id === (typeof order.assignedRider === "object" ? order.assignedRider?._id : order.assignedRider))?.name || "Not Assigned"}
                                        </p>

                                        <div className="rider-assignment-controls">
                                            <select value={selectedRiders[order._id] || ""} onChange={(event) => setSelectedRiders(previous => ({...previous, [order._id]: event.target.value}))} disabled={Boolean(updatingOrderId)}>
                                                <option value="">Select Rider</option>

                                                {riders.map(rider => (
                                                    <option key={rider._id} value={rider._id}>
                                                        {rider.name} - {rider.vehicleType}
                                                    </option>
                                                ))}
                                            </select>

                                            <button type="button" onClick={() => assignRider(order._id)} disabled={Boolean(updatingOrderId) || !selectedRiders[order._id]}>
                                                {isUpdating ? "Assigning..." : "Assign Rider"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Branch Information */}
                                <div className="branch-information">
                                    <h4>Branch Information</h4>
                                    <p>
                                        <strong>Assigned Branch: </strong>
                                        {order.branchId?.name || "Not Available"}
                                    </p>

                                    <p>
                                        <strong>Branch Code: </strong>
                                        {order.branchId?.code || "N/A"}
                                    </p>

                                    <p>
                                        <strong>Delivery Distance: </strong>
                                        {order.deliveryDistanceKm != null ? `${Number(order.deliveryDistanceKm).toFixed(2)} km` : "N/A"}
                                    </p>

                                    <p>
                                        <strong>Delivery Coverage: </strong>
                                        {order.branchId?.deliveryRadiusKm != null ? `${order.branchId.deliveryRadiusKm} km` : "N/A"}
                                    </p>
                                </div>

                                {/* Customer Location Change Request */}
                                {order.locationChangeStatus && order.locationChangeStatus !== "Not Requested" && (
                                    <div className="location-approval">
                                        <h4>Customer Location Change</h4>
                                        <p>
                                            <strong>Status: </strong>
                                            {order.locationChangeStatus}
                                        </p>
                                        {order.customerConfirmedLocation && Number.isFinite(Number(order.customerConfirmedLocation.latitude)) && Number.isFinite(Number(order.customerConfirmedLocation.longitude)) && (
                                            <div className="location-approval-details">
                                                
                                                <p>
                                                    <strong>New Latitude: </strong>
                                                    {order.customerConfirmedLocation.latitude}
                                                </p>

                                                <p>
                                                    <strong>New Longitude: </strong>
                                                    {order.customerConfirmedLocation.longitude}
                                                </p>

                                                <a href={`https://www.google.com/maps?q=${order.customerConfirmedLocation.latitude},${order.customerConfirmedLocation.longitude}`} target="_blank" rel="noopener noreferrer">
                                                    View New Location on Google Maps
                                                </a>

                                            </div>
                                        )}

                                        {order.locationChangeStatus === "Pending" && (
                                            <div className="location-approval-actions">
                                                
                                                <button type="button" className="approve-location-btn" disabled={Boolean(updatingOrderId)} onClick={() => updateLocationApproval(order._id, "approve")}>
                                                    {isUpdating ? "Processing..." : "Approve Location"}
                                                </button>

                                                <button type="button" className="reject-location-btn" disabled={Boolean(updatingOrderId)} onClick={() => updateLocationApproval(order._id, "reject")}>
                                                    {isUpdating ? "Processing..." : "Reject Location"}
                                                </button>

                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="order-info">
                                    <div className="order-customer">
                                        <h4>Customer</h4>
                                        <p>{[order.address?.firstName, order.address?.lastName].filter(Boolean).join(" ") || order.userId?.name || order.name || "Unknown User"}</p>
                                        <p>{order.address?.email || order.userId?.email || order.email || ""}</p>
                                        {order.cancellationReason && (
                                            <p className="cancellation-reason">
                                                <strong>Cancellation Reason:</strong>{" "}{order.cancellationReason}
                                            </p>
                                        )}
                                    </div>

                                    <div className="order-items">
                                        <h4>Items</h4>
                                        {Array.isArray(order.items) && order.items.map((item, index) => (
                                            <div className="order-item" key={index}>
                                                <span>{item.name || 'Food Item'}</span>
                                                <span>x{item.quantity}</span>
                                                <span> ${Number(item.price || 0).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="order-total">
                                        <h4>Total</h4>
                                        <p>${(Number(order.amount ?? order.totalAmount ?? 0) + Number(order.deliveryFee || 0)).toFixed(2)}</p>
                                        
                                        {order.refundStatus && (
                                            <p className="refund-status">
                                                Refund Status: {order.refundStatus}
                                            </p>
                                        )}

                                        {order.refundAmount > 0 && (
                                            <p className="refunded-amount">
                                                Refunded Amount: ${Number(order.refundAmount).toFixed(2)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

            )}

            {/* Refund Reason Modal */}
            {selectedRefundOrder && (
                <div className="refund-modal-overlay" onClick={(event) => {if(event.target === event.currentTarget){closeRefundModal()}}}>
                    <div className="refund-modal" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">

                        <div className="refund-modal-header">
                            <h2 id="refund-modal-title">
                                Issue Refund
                            </h2>

                            <button type="button" className="refund-modal-close" onClick={closeRefundModal} disabled={updatingOrderId === selectedRefundOrder._id} aria-label="Close refund modal">
                                &times;
                            </button>
                        </div>

                        <div className="refund-modal-description">
                            Enter the reason before confirming the Stripe refund.
                        </div>

                        <div className="refund-modal-amount">
                            <span>Order Total</span>
                            <strong>${(Number(selectedRefundOrder.amount ?? selectedRefundOrder.totalAmount ?? 0) + Number(selectedRefundOrder.deliveryFee || 0)).toFixed(2)}</strong>
                        </div>

                        <label className="refund-reason-label" htmlFor="refund-reason">
                            Refund Reason
                        </label>

                        <textarea id="refund-reason" className="refund-reason-input" placeholder="Enter the reason for this refund..." value={refundReasonInput} onChange={(e) => setRefundReasonInput(e.target.value)} rows={4} maxLength={500} disabled={updatingOrderId === selectedRefundOrder._id}/>
                        
                        <p className="refund-reason-hint">
                            {refundReasonInput.length}/500 characters
                        </p>

                        <div className="refund-modal-actions">

                            <button type="button" className="refund-cancel-btn" onClick={closeRefundModal} disabled={updatingOrderId === selectedRefundOrder._id}>
                                Cancel
                            </button>

                            <button type="button" className="refund-confirm-btn" onClick={confirmRefund} disabled={!refundReasonInput.trim() || updatingOrderId === selectedRefundOrder._id}>
                                {updatingOrderId === selectedRefundOrder._id ? "Processing..." : "Confirm Refund"}
                            </button>
                            
                        </div>

                    </div>
                </div>
            )}

        </div>
    )
}

export default Orders