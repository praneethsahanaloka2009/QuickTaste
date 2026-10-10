import React, { useContext, useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { StoreContext } from '../../context/StoreContext'
import './TrackOrder.css'

const TrackOrder = () => {
    const { token } = useContext(StoreContext)
    const { id } = useParams()
    const navigate = useNavigate()
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)

    // Animation State
    const [animatedProgress, setAnimatedProgress] = useState(null)

    // Order Statuses
    const statuses = [ "Pending", "Processing", "Out for Delivery", "Delivered" ]

    // Animation duration 60 seconds
    const animationDuration = 60000

    // Refs
    const fetchKeyRef = useRef(null)
    const animationFrameRef = useRef(null)
    const isFetchingRef = useRef(false)

    // Start / continue animation
    const startProgressAnimation = ( lineIndex, storageKey, currentStatus, startTime ) => {
        
        // Stop previous animation
        if(animationFrameRef.current){
            cancelAnimationFrame(
                animationFrameRef.current
            )
        }

        const animate = () => {
            
            // IMPORTANT: startTime is saved using Date.now(). requestAnimationFrame's currentTime uses a different time system. Therefore we use Date.now() here as well.
            const currentTime = Date.now()

            const elapsed = currentTime - startTime

            const progress = Math.min(elapsed / animationDuration, 1)

            const percentage = progress * 100

            setAnimatedProgress({
                lineIndex,
                progress : percentage
            })

            // Animation still running
            if(progress < 1){
                animationFrameRef.current = requestAnimationFrame(animate)
            }

            // Animation complete
            else {
                // Now save the new status. This is important because the next backend check will know that this status animation is complete.
                sessionStorage.setItem(
                    storageKey, currentStatus
                )

                sessionStorage.removeItem(
                    `${storageKey}_startTime`
                )

                setAnimatedProgress(null)

                animationFrameRef.current = null
            }

        }

        // Start animation
        animationFrameRef.current = requestAnimationFrame(animate)

    }

    // Fetch order
    const fetchOrder = async () => {
        
        if(!token || !id){
            return
        }

        // Prevent multiple requests at same time
        if(isFetchingRef.current){
            return
        }

        isFetchingRef.current = true

        try {
            
            const response = await fetch(`http://localhost:4911/api/order/${id}`,
                {
                    method : "GET",
                    headers : {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                }
            )

            const data = await response.json()

            if(data.success){
                
                const newOrder = data.order

                const currentStatus = newOrder.orderStatus

                const currentStatusIndex = statuses.indexOf(currentStatus)

                // Storage key
                const storageKey = `trackOrderStatus_${id}`

                const startTimeKey = `${storageKey}_startTime`

                // Saved status
                const savedStatus = sessionStorage.getItem(storageKey)

                const previousStatusIndex = savedStatus === null ? -1 : statuses.indexOf(savedStatus)

                // Existing animation start time
                const savedStartTime = sessionStorage.getItem(startTimeKey)

                // First time opening track order
                if(savedStatus === null){
                    
                    // First time: Save current status. No animation because there was no previous status to compare with.
                    sessionStorage.setItem(storageKey,currentStatus)

                    sessionStorage.removeItem(startTimeKey)

                    setAnimatedProgress(null)

                }

                // Status changed + No existing animation
                else if(currentStatusIndex > previousStatusIndex && !savedStartTime){
                    
                    // Admin changed status. Start a NEW 60 second animation.
                    const animationStartTime = Date.now()

                    sessionStorage.setItem(startTimeKey, animationStartTime.toString())

                    // Line index: Pending -> Processing lineIndex = 0
                    // Processing -> Out for Delivery lineIndex = 1
                    // Out for Delivery -> Delivered lineIndex = 2
                    const lineIndex = currentStatusIndex - 1

                    setAnimatedProgress({
                        lineIndex,
                        progress: 0
                    })

                    startProgressAnimation(lineIndex, storageKey, currentStatus, animationStartTime)

                }

                // Status changed + animation already running
                else if(currentStatusIndex > previousStatusIndex && savedStartTime){
                    
                    // Animation already started. DO NOT start it again. Continue from saved start time.
                    const animationStartTime = Number(savedStartTime)

                    const lineIndex = currentStatusIndex - 1

                    startProgressAnimation(lineIndex, storageKey, currentStatus, animationStartTime)

                }

                // Same status + animation exists
                else if(savedStartTime && currentStatusIndex > previousStatusIndex){
                    
                    // Continue existing animation.
                    const animationStartTime = Number(savedStartTime)

                    const lineIndex = currentStatusIndex - 1

                    startProgressAnimation(lineIndex, storageKey, currentStatus, animationStartTime)

                }

                // Same status
                else {
                    
                    // Do nothing. 
                    // IMPORTANT: Do not clear animation here.
                    if(!savedStartTime){
                        setAnimatedProgress(null)
                    }

                }

                // Update order
                setOrder(newOrder)

            } else {
                
                toast.error(data.message || "Unable to load order.")

            }

        } catch(error) {
            
            console.log("Track Order Error:",error)

            // Don't show toast every 3 seconds if one temporary request fails. Only console the error.
            console.log("Unable to refresh order status.")

        } finally {
            
            setLoading(false)
            isFetchingRef.current = false

        }

    }

    // Initial fetch
    useEffect(() => {
        
        const currentKey = `${token}_${id}`

        if(token && id && fetchKeyRef.current !== currentKey){
            
            fetchKeyRef.current = currentKey

            fetchOrder()

        }

    }, [token, id])

    // AUTO REFRESH Checks backend every 3 seconds. User DOES NOT need to refresh page.
    useEffect(() => {
        
        if(!token || !id){
            return
        }

        const interval = setInterval(() =>{
            fetchOrder()
        }, 3000)

        return () => {
            clearInterval(interval)
        }

    }, [token, id])

    //Cleanup animation
    useEffect(() => {
        
        return () => {
            
            if(animationFrameRef.current){
                
                cancelAnimationFrame(
                    animationFrameRef.current
                )

                animationFrameRef.current = null

            }

        }

    }, [])

    // Loading
    if(loading){

        return (
            
            <div className="track-order-page">
                
                <p className="track-loading">
                    Loading order...
                </p>

            </div>

        )

    }

    // Order not found
    if(!order){
        
        return (
            
            <div className="track-order-page">
                
                <div className="track-error">
                    
                    <h2>
                        Order Not Found
                    </h2>

                    <p>
                        We couldn't find this order.
                    </p>

                    <button onClick={() => navigate("/my-orders")}>
                        Back to My Orders
                    </button>

                </div>

            </div>

        )

    }

    // Current status index
    const currentStatusIndex = statuses.indexOf(order.orderStatus)

    // Cancelled order
    if(order.orderStatus === "Cancelled"){
        
        return (
            
            <div className="track-order-page">
                
                <div className="track-order-header">
                    
                    <h2>
                        Track Your Order
                    </h2>

                    <p>Order # {order._id .slice(-6) .toUpperCase()}</p>

                </div>

                <div className="track-order-card">
                    
                    <div className="track-order-top">
                        
                        <div>
                            
                            <h3>Order # {order._id .slice(-6) .toUpperCase()}</h3>

                            <p>{new Date( order.createdAt ).toLocaleString()}</p>

                        </div>

                        <span className="current-status cancelled">
                            Cancelled
                        </span>

                    </div>

                    <div className="cancelled-order-message">
                        
                        <h3>This order has been cancelled</h3>

                        <p>Unfortunately, this order is no longer being processed.</p>

                    </div>

                    {/* Order Items */}
                    <div className="track-order-section">
                        
                        <h4>Order Items</h4>

                        <div className="track-items">
                            
                            {order.items?.map(
                                (item, index) => (
                                    
                                    <div className="track-item" key={index}>
                                        
                                        <div className="track-item-name">
                                            
                                            <span>{item.name}</span>

                                            <span>x {item.quantity}</span>

                                        </div>

                                        <span>$ {Number( item.price * item.quantity ).toFixed(2)}</span>

                                    </div>

                                )
                            )}

                        </div>

                    </div>

                    {/* Total */}
                    <div className="track-total">
                        
                        <span>Total</span>

                        <strong>$ {Number( order.amount || 0 ).toFixed(2)}</strong>

                    </div>

                    <button className="back-orders-btn" onClick={() => navigate("/my-orders") }>
                        Back to My Orders
                    </button>

                </div>

            </div>

        )

    }

    // Normal order tracking
    return (

        <div className="track-order-page">
            
            <div className="track-order-header">
                
                <h2>Track Your Order</h2>

                <p>Order # {order._id .slice(-6) .toUpperCase()}</p>

            </div>

            <div className="track-order-card">
                
                {/* Order header */}
                <div className="track-order-top">
                    
                    <div>
                        
                        <h3>Order # {order._id .slice(-6) .toUpperCase()}</h3>

                        <p>{new Date( order.createdAt ).toLocaleString()}</p>

                    </div>

                    <span className='current-status'>{order.orderStatus}</span>

                </div>

                {/* Order progress */}
                <div className="order-progress">
                    
                    {statuses.map(
                        (status, index) => {
                            
                            // Status before current
                            const isBeforeCurrent = index < currentStatusIndex

                            // Current status
                            const isCurrent = index === currentStatusIndex

                            // Currently animated line
                            const isAnimatedLine = animatedProgress && animatedProgress.lineIndex === index

                            // Completed normal line
                            const isCompletedLine = isBeforeCurrent && !isAnimatedLine

                            // Completed circle
                            const isCompletedCircle = index < currentStatusIndex || ( isCurrent && !animatedProgress )

                            return (
                                
                                <div className={ `progress-step ${ isCompletedCircle ? "completed" : "" } ${ isCurrent ? "current" : "" }` } key={status}>
                                    
                                    {/* Circle */}
                                    <div className="progress-circle">
                                        
                                        { isCompletedCircle ? "✓" : index + 1 }

                                    </div>

                                    {/* Status */}
                                    <p>{status}</p>

                                    {/* Progess Line */}
                                    {index < statuses.length - 1 && (
                                        
                                        <div className={ `progress-line ${ isCompletedLine ? "completed" : "" }` } style={ isAnimatedLine ? { width: `${animatedProgress.progress}%` } : undefined }></div>

                                    )}

                                </div>

                            )

                        }
                    )}

                </div>

                {/* Order Items */}
                <div className="track-order-section">
                    
                    <h4>Order Items</h4>

                    <div className="track-items">
                        
                        {order.items?.map(
                            (item, index) => (
                                
                                <div className="track-item" key={index}>
                                    
                                    <div className="track-item-name">
                                        
                                        <span>{item.name}</span>

                                        <span>x {item.quantity}</span>

                                    </div>

                                    <span>${Number(item.price * item.quantity).toFixed(2)}</span>

                                </div>

                            )
                        )}

                    </div>

                </div>

                {/* Total */}
                <div className="track-total">
                    
                    <span>Total</span>

                    <strong>${Number(order.amount || 0).toFixed(2)}</strong>

                </div>

                {/* Back to orders */}
                <button className="back-orders-btn" onClick={() => navigate("/my-orders") }>Back to My Orders</button>

            </div>

        </div>

    )
}

export default TrackOrder