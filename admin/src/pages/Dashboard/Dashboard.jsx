import React, { useEffect, useState } from "react";
import "./Dashboard.css";

const Dashboard = () => {

    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeOffers, setActiveOffers] = useState([]);

    const fetchDashboardData = async () => {

        try {

            const token = localStorage.getItem("adminToken");

            const response = await fetch(
                "http://localhost:4911/api/dashboard",
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (data.success) {
                setDashboardData(data.data);
            } else {
                console.log(data.message);
            }

        } catch (error) {

            console.log("Dashboard Fetch Error:", error);

        } finally {

            setLoading(false);

        }

    };

    useEffect(() => {

        fetchDashboardData();

        const fetchActiveOffers = async () => {
            
            try {
                
                const response = await fetch("http://localhost:4911/api/promo/list");

                const data = await response.json();

                if(data.success){
                    
                    const now = new Date();

                    const active = data.promos.filter((promo) => promo.isActive === true && new Date(promo.expiryDate) >= now);

                    setActiveOffers(active);

                }

            } catch (error) {
                
                console.log("Offers Fetch Error:", error);

            }

        };

        fetchActiveOffers();

    }, []);

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dashboard-loading">
                    Loading Dashboard...
                </div>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="dashboard">
                <div className="dashboard-error">
                    Failed to load dashboard data.
                </div>
            </div>
        );
    }

    return (

        <div className="dashboard">

            {/* Dashboard Header */}

            <div className="dashboard-header">

                <div>
                    <h1>Dashboard</h1>
                    <p>
                        Welcome back! Here's what's happening with QuickTaste.
                    </p>
                </div>

            </div>


            {/* Statistics Cards */}

            <div className="dashboard-stats">

                {/* Total Orders */}

                <div className="stat-card">

                    <div className="stat-card-content">

                        <p>Total Orders</p>

                        <h2>
                            {dashboardData.totalOrders}
                        </h2>

                    </div>

                    <div className="stat-icon">
                        🛒
                    </div>

                </div>


                {/* Total Revenue */}

                <div className="stat-card">

                    <div className="stat-card-content">

                        <p>Total Revenue</p>

                        <h2>
                            ${Number(
                                dashboardData.totalRevenue
                            ).toFixed(2)}
                        </h2>

                    </div>

                    <div className="stat-icon">
                        💰
                    </div>

                </div>


                {/* Total Customers */}

                <div className="stat-card">

                    <div className="stat-card-content">

                        <p>Total Customers</p>

                        <h2>
                            {dashboardData.totalCustomers}
                        </h2>

                    </div>

                    <div className="stat-icon">
                        👥
                    </div>

                </div>


                {/* Total Food Items */}

                <div className="stat-card">

                    <div className="stat-card-content">

                        <p>Total Food Items</p>

                        <h2>
                            {dashboardData.totalFoodItems}
                        </h2>

                    </div>

                    <div className="stat-icon">
                        🍔
                    </div>

                </div>

            </div>


            {/* Order Status */}

            <div className="dashboard-section">

                <div className="section-header">

                    <h2>Order Status</h2>

                </div>

                <div className="order-status-cards">

                    <div className="status-card">

                        <div>
                            <p>Pending</p>

                            <h3>
                                {dashboardData.orderStatus.pending}
                            </h3>
                        </div>

                    </div>


                    <div className="status-card">

                        <div>
                            <p>Processing</p>

                            <h3>
                                {dashboardData.orderStatus.processing}
                            </h3>
                        </div>

                    </div>


                    <div className="status-card">

                        <div>
                            <p>Out for Delivery</p>

                            <h3>
                                {dashboardData.orderStatus.outForDelivery}
                            </h3>
                        </div>

                    </div>

                    <div className="status-card">

                        <div>
                            <p>Delivered</p>

                            <h3>
                                {dashboardData.orderStatus.delivered}
                            </h3>
                        </div>

                    </div>

                    <div className="status-card">

                        <div>
                            <p>Cancelled</p>

                            <h3>
                                {dashboardData.orderStatus.cancelled}
                            </h3>
                        </div>

                    </div>

                </div>

            </div>


            {/* Recent Orders */}

            <div className="dashboard-section recent-orders-section">

                <div className="section-header">

                    <h2>Recent Orders</h2>

                </div>


                <div className="recent-orders-table">

                    <div className="recent-orders-header">

                        <span>Order ID</span>
                        <span>Customer</span>
                        <span>Amount</span>
                        <span>Status</span>

                    </div>


                    {dashboardData.recentOrders.length === 0 ? (

                        <div className="no-orders">
                            No orders found.
                        </div>

                    ) : (

                        dashboardData.recentOrders.map((order) => (

                            <div
                                className="recent-order-row"
                                key={order._id}
                            >

                                <span>
                                    #{order._id.slice(-6)}
                                </span>

                                <span>
                                    {order.userId?.name || "Unknown"}
                                </span>

                                <span>
                                    ${Number(order.amount).toFixed(2)}
                                </span>

                                <span>

                                    <span
                                        className={`order-status ${order.orderStatus
                                            .toLowerCase()
                                            .replace(/\s+/g, "-")
                                            }`}
                                    >
                                        {order.orderStatus}
                                    </span>

                                </span>

                            </div>

                        ))

                    )}

                </div>

            </div>

            {/* Active Offers */}

            <div className="dashboard-section offers-section">
                
                <div className="section-header">
                    
                    <h2>Active Offers</h2>

                </div>

                {activeOffers.length === 0 ? (
                    
                    <div className="no-offers">
                        No active offers available.
                    </div>

                ) : (
                    
                    <div className="offers-list">
                        
                        {activeOffers.map((promo) => (
                            
                            <div className="offer-card" key={promo._id}>
                                
                                <div className="offer-card-info">
                                    
                                    <div className="offer-code">
                                        {promo.code}
                                    </div>

                                    <h3>{promo.discountType === "percentage" ? `${promo.discountValue}% OFF` : `$${Number(promo.discountValue).toFixed(2)} OFF`}</h3>

                                    {promo.offerText && (
                                        
                                        <p>{promo.offerText}</p>

                                    )}

                                </div>

                                <div className="offer-card-details">
                                    
                                    <span>Min. Order: ${Number(promo.minOrderAmount).toFixed(2)}</span>

                                    <span>Expires:{" "}{new Date(promo.expiryDate).toLocaleDateString()}</span>

                                    {promo.showOnOfferBar && (
                                        
                                        <span className="offer-bar-active">
                                            Showing on Offer Bar
                                        </span>

                                    )}

                                </div>

                            </div>

                        ))}

                    </div>

                )}

            </div>

        </div>

    );

};

export default Dashboard;