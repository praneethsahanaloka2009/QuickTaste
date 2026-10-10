import React, { useEffect, useState } from 'react'
import './Orders.css'
import { toast } from 'react-toastify'

const Orders = () => {

    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(Date.now())
    const [updatingOrderId, setUpdatingOrderId] = useState(null)

    useEffect(() => {
        fetchOrders()

        // Update preparation countdown every second
        const timer = setInterval(() => {
            setCurrentTime(Date.now())
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    const fetchOrders = async () => {

        try {

            const token = localStorage.getItem("adminToken")

            if (!token) {
                toast.error("Please login as admin first!")
                setLoading(false)
                return
            }

            const response = await fetch(
                "http://localhost:4911/api/order/admin/orders",
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                }
            )

            const data = await response.json()

            if (data.success) {
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
                `http://localhost:4911/api/order/admin/update-status/${orderId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: newStatus })
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
                    {orders.map(order => {
                        const status = order.orderStatus || 'Pending'
                        const isUpdating = updatingOrderId === order._id
                        const remaining = getRemainingMs(order)

                        const preparationFinished = remaining !== null && remaining <= 0

                        return(
                            <div className="order-card" key={order._id}>
                                <div className="order-card-top">
                                    <div>
                                        <h3>
                                            Order #{order._id.slice(-6).toUpperCase()}
                                        </h3>
                                        <p>
                                            {new Date(order.createdAt).toLocaleString()}
                                        </p>
                                    </div>

                                    <div className="order-status-control">
                                        {status === 'Pending' && (
                                            <button type="button" className="accept-order-btn" disabled={isUpdating || order.paymentStatus !== 'Paid'} onClick={() => updateStatus(order._id, 'Processing')}>
                                                {isUpdating ? 'Please wait...' : order.paymentStatus !== 'Paid' ? 'Payment Pending' : 'Accept Order'}
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

                                        {(status === 'Delivered' || status === 'Cancelled') && (<span className={`order-final-status ${status === 'Cancelled' ? 'cancelled' : ''}`}>{status}</span>)}
                                    </div>
                                </div>

                                <div className="order-info">
                                    <div className="order-customer">
                                        <h4>Customer</h4>
                                        <p>{order.userId?.name || order.name || 'Unknown User'}</p>
                                        <p>{order.userId?.email || order.email || ''}</p>
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
                                        <p>${(Number(order.amount || order.totalAmount || 0) + Number(order.deliveryFee || 0)).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

            )}

        </div>
    )
}

export default Orders