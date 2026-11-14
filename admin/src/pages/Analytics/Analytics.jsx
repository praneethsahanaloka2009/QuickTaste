import React, { useEffect, useRef, useState } from "react";
import { BarChart3, TrendingUp, ShoppingBag, CheckCircle2, RefreshCw, DollarSign, RotateCcw, AlertCircle, UtensilsCrossed, Layers3 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { toast } from "react-toastify";
import "./Analytics.css";

const API_URL = "http://localhost:4911";

const STATUS_COLORS = {
    Pending: "#a3c9ae",
    Processing: "#65a97b",
    "Out for Delivery": "#318454",
    Delivered: "#065d23",
    Cancelled: "#ef4444"
};

const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);

const Analytics = () => {
    const [period, setPeriod] = useState("30d");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [overview, setOverview] = useState(null);
    const [revenue, setRevenue] = useState(null);
    const [orders, setOrders] = useState(null);
    const [foods, setFoods] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const [refreshing, setRefreshing] = useState(false);
    const manualRefreshRef = useRef(false);

    useEffect(() => {
        const controller = new AbortController();

        const isManualRefresh = manualRefreshRef.current;
        manualRefreshRef.current = false;

        const fetchAnalytics = async () => {
            if(period === "custom" && (!startDate || !endDate)){
                setLoading(false);
                setRefreshing(false);
                setError("");
                return;
            }

            // Show full loading screen only for normal loads
            if(!isManualRefresh){
                setLoading(true);
            }

            setError("");

            try {
                const token = localStorage.getItem("adminToken");

                if(!token){
                    throw new Error("Admin authentication required.");
                }

                const params = new URLSearchParams({ period });

                if(period === "custom"){
                    params.set("startDate", startDate);
                    params.set("endDate", endDate);
                }

                const headers = {
                    Authorization: `Bearer ${token}`
                };

                const endpoints = [
                    `${API_URL}/api/analytics/overview`,
                    `${API_URL}/api/analytics/revenue?${params}`,
                    `${API_URL}/api/analytics/orders?${params}`,
                    `${API_URL}/api/analytics/foods?${params}`
                ];

                const responses = await Promise.all(
                    endpoints.map((url) => fetch(url, {
                        headers,
                        signal: controller.signal,
                        cache: "no-store"
                    }))
                );

                const results = await Promise.all(
                    responses.map((response) => response.json())
                );

                for(let i = 0; i < responses.length; i++){
                    if(!responses[i].ok || !results[i].success){
                        throw new Error(
                            results[i].message || `Analytics request failed (${responses[i].status}).`
                        );
                    }
                }

                if(controller.signal.aborted){
                    return
                }

                setOverview(results[0].data);
                setRevenue(results[1].data);
                setOrders(results[2].data);
                setFoods(results[3].data);

                // Success notification on manual refresh only
                if(isManualRefresh){
                    toast.success("Analytics data refreshed successfully!", { autoClose: 1800 });
                }
                
            } catch (error) {
                
                if(controller.signal.aborted){
                    return;
                }

                console.error("Analytics Fetch Error:", error);

                setError(error.message || "Failed to load analytics.");

                if(isManualRefresh){
                    toast.error("Unable to refresh analytics data.");
                }

            } finally {
                
                if(!controller.signal.aborted){
                    setLoading(false);
                    setRefreshing(false);
                }

            }
        };

        fetchAnalytics();

        return () => {
            controller.abort();
        }
        
    }, [period, startDate, endDate, refreshKey]);

    // Refresh analytics without hiding the dashboard
    const handleRefresh = () => {
        if(refreshing || loading){
            return;
        }

        if(period === "custom" && (!startDate || !endDate)){
            toast.error("Please select both start and end dates.");
            return;
        }

        manualRefreshRef.current = true;

        setRefreshing(true);

        setRefreshKey((previous) => previous + 1);
    };

    const revenueSummary = revenue?.summary || {};
    const orderSummary = orders?.summary || {};

    const revenueChart = revenue?.chart || [];
    const orderChart = orders?.orderTrends || [];

    const statusData = (orders?.statusDistribution || []).filter((item) => item.count > 0);

    // Food Analytics Data
    const foodSummary = foods?.summary || {};
    const topFoods = foods?.topProducts || [];
    const foodCategories = foods?.categories || [];
    const foodProducts = foods?.products || [];

    const foodCards = [
        {
            title: "Total Items Sold",
            value: foodSummary.totalItemsSold ?? 0,
            icon: ShoppingBag
        },
        {
            title: "Products Sold",
            value: foodSummary.uniqueProductsSold ?? 0,
            icon: UtensilsCrossed
        },
        {
            title: "Gross Food Sales",
            value: money(foodSummary.grossItemSales),
            icon: DollarSign
        },
        {
            title: "Categories Sold",
            value: foodSummary.categoriesSold ?? 0,
            icon: Layers3
        }
    ];

    const cards = [
        {
            title: "Recorded Revenue",
            value: money(revenueSummary.recordedRevenue),
            icon: DollarSign,
            color: "green"
        },
        {
            title: "Net Revenue",
            value: money(revenueSummary.netRevenue),
            icon: TrendingUp,
            color: "green"
        },
        {
            title: "Total Orders",
            value: orderSummary.totalOrders ?? 0,
            icon: ShoppingBag,
            color: "green"
        },
        {
            title: "Delivered Orders",
            value: orderSummary.deliveredOrders ?? 0,
            icon: CheckCircle2,
            color: "green"
        },
        {
            title: "Refunds",
            value: money(revenueSummary.refunds),
            icon: RotateCcw,
            color: "green"
        },
        {
            title: "Average Order Value",
            value: money(orderSummary.averageOrderValue),
            icon: BarChart3,
            color: "green"
        }
    ];

    return (
        <div className="analytics-page">
            <div className="analytics-topbar">
                <div>
                    <h1>Advanced Analytics</h1>
                    <p>
                        Track QuickTaste revenue, orders and business performance.
                    </p>
                </div>

                <button type="button" className="analytics-refresh" onClick={handleRefresh} disabled={loading || refreshing} aria-label={refreshing ? "Refreshing analytics" : "Refresh analytics"}>
                    <RefreshCw size={17} className={refreshing ? "analytics-refresh-spinning" : ""}/>
                    {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="analytics-filters">
                <div className="analytics-filter-heading">
                    <span>Reporting Period</span>
                    <small>Order creation date · UTC</small>
                </div>

                <div className="analytics-period-buttons">
                    {[["7d", "7 Days"], ["30d", "30 Days"], ["90d", "90 Days"], ["12m", "12 Months"], ["custom", "Custom"]].map(([value, label]) => (
                        <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>
                            {label}
                        </button>
                    ))}
                </div>

                {period === "custom" && (
                    <div className="analytics-custom-dates">
                        <label>
                            Start Date
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}/>
                        </label>

                        <label>
                            End Date
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}/>
                        </label>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="analytics-state">
                    <div className="analytics-spinner"/>
                    <p>Loading analytics data...</p>
                </div>
            ) : error ? (
                <div className="analytics-state analytics-error">
                    <AlertCircle size={28}/>
                    <h3>Unable to load analytics</h3>
                    <p>{error}</p>
                    <button onClick={() => setRefreshKey((v) => v + 1)}>
                        Try Again
                    </button>
                </div>
            ) : period === "custom" && (!startDate || !endDate) ? (
                <div className="analytics-state">
                    <p>Select a start date and end date to view analytics.</p>
                </div>
            ) : (
                <>
                    <div className="analytics-summary-grid">
                        {cards.map((card) => {
                            const Icon = card.icon;

                            return (
                                <div className="analytics-stat-card" key={card.title}>
                                    <div className="analytics-stat-top">
                                        <span>{card.title}</span>

                                        <div className={`analytics-stat-icon ${card.color}`}>
                                            <Icon size={19}/>
                                        </div>
                                    </div>

                                    <h2>{card.value}</h2>
                                </div>
                            );
                        })}
                    </div>

                    <div className="analytics-charts-grid">
                        <section className="analytics-chart-card">
                            <div className="analytics-chart-header">
                                <h2>Revenue Trends</h2>
                                <p>Recorded revenue and net revenue</p>
                            </div>

                            {revenueChart.length === 0 ? (
                                <div className="analytics-empty">
                                    No revenue data for this period.
                                </div>
                            ) : (
                                <div className="analytics-chart-area">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={revenueChart}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="date" tick={{ fontSize: 11 }}/>
                                            <YAxis tick={{ fontSize: 11 }}/>
                                            <Tooltip formatter={(value) => money(value)}/>
                                            <Legend/>
                                            <Line type="monotone" dataKey="revenue" name="Recorded Revenue" stroke="#065d23" strokeWidth={3} dot={{ r: 4, fill: "#ffffff", stroke: "#065d23", strokeWidth: 2 }} activeDot={{ r: 8, fill: "#065d23", stroke: "#ffffff", strokeWidth: 3 }}/>
                                            <Line type="monotone" dataKey="netRevenue" name="Net Revenue" stroke="#0ac448" strokeWidth={2} dot={{ r: 4, fill: "#ffffff", stroke: "#0ac448", strokeWidth: 2 }} activeDot={{ r: 8, fill: "#0ac448", stroke: "#ffffff", strokeWidth: 3 }}/>
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </section>

                        <section className="analytics-chart-card">
                            <div className="analytics-chart-header">
                                <h2>Order Trends</h2>
                                <p>Orders created during the selected period</p>
                            </div>

                            {orderChart.length === 0 ? (
                                <div className="analytics-empty">
                                    No orders found for this period.
                                </div>
                            ) : (
                                <div className="analytics-chart-area">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={orderChart}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="date" tick={{ fontSize: 11 }}/>
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }}/>
                                            <Tooltip/>
                                            <Legend/>
                                            <Bar dataKey="totalOrders" name="Total Orders" fill="#65a97b" radius={[5, 5, 0, 0]}/>
                                            <Bar dataKey="deliveredOrders" name="Delivered" fill="#065d23" radius={[5, 5, 0, 0]}/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </section>

                        <section className="analytics-chart-card">
                            <div className="analytics-chart-header">
                                <h2>Order Status Distribution</h2>
                                <p>Current status of orders in the selected period</p>
                            </div>

                            {statusData.length === 0 ? (
                                <div className="analytics-empty">
                                    No order status data available.
                                </div>
                            ) : (
                                <div className="analytics-chart-area">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart accessibilityLayer={false}>
                                            <Pie data={statusData} dataKey="count" nameKey="status" innerRadius={65} outerRadius={95} paddingAngle={3}>
                                                {statusData.map((item) => (
                                                    <Cell key={item.status} fill={STATUS_COLORS[item.status] || "#94a3b8"}/>
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => [`${value} Orders`, "Count"]}/>
                                            <Legend/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </section>

                        <section className="analytics-chart-card">
                            <div className="analytics-chart-header">
                                <h2>Order Performance</h2>
                                <p>Completion and cancellation statistics</p>
                            </div>

                            <div className="analytics-performance">
                                <div className="analytics-performance-item">
                                    <div>
                                        <span>Delivery Completion Rate</span>
                                        <strong>{orderSummary.deliveryCompletionRate ?? 0}%</strong>
                                    </div>
                                    <div className="analytics-progress-track">
                                        <div className="analytics-progress-fill success" style={{width: `${orderSummary.deliveryCompletionRate || 0}%`}}/>
                                    </div>
                                </div>

                                <div className="analytics-performance-item">
                                    <div>
                                        <span>Cancellation Rate</span>
                                        <strong>{orderSummary.cancellationRate ?? 0}%</strong>
                                    </div>
                                    <div className="analytics-progress-track">
                                        <div className="analytics-progress-fill danger" style={{width: `${orderSummary.cancellationRate || 0}%`}}/>
                                    </div>
                                </div>

                                <div className="analytics-performance-stats">
                                    <div>
                                        <span>Paid Orders</span>
                                        <strong>{orderSummary.paidOrders ?? 0}</strong>
                                    </div>

                                    <div>
                                        <span>Pending Orders</span>
                                        <strong>{orderSummary.pendingOrders ?? 0}</strong>
                                    </div>

                                    <div>
                                        <span>Processing</span>
                                        <strong>{orderSummary.processingOrders ?? 0}</strong>
                                    </div>

                                    <div>
                                        <span>Out for Delivery</span>
                                        <strong>{orderSummary.outForDeliveryOrders ?? 0}</strong>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="analytics-food-section">

                        <div className="analytics-food-heading">
                            <div>
                                <h2>Food Performance Analytics</h2>
                                <p>Monitor best-selling foods, product sales and category performance.</p>
                            </div>
                        </div>

                        <div className="analytics-food-summary-grid">
                            {foodCards.map((card) => {
                                const Icon = card.icon;

                                return (
                                    <div className="analytics-stat-card" key={card.title}>
                                        <div className="analytics-stat-top">
                                            <span>{card.title}</span>

                                            <div className="analytics-stat-icon green">
                                                <Icon size={19}/>
                                            </div>
                                        </div>

                                        <h2>{card.value}</h2>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Food Charts */}
                        <div className="analytics-charts-grid">

                            {/* Top Selling Foods */}
                            <section className="analytics-chart-card">
                                
                                <div className="analytics-chart-header">
                                    <h2>Top 5 Best Selling Foods</h2>
                                    <p>Products ranked by quantity sold</p>
                                </div>

                                {topFoods.length === 0 ? (
                                    <div className="analytics-empty">
                                        No food sales found for this period.
                                    </div>
                                ) : (
                                    <div className="analytics-chart-area">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={topFoods} layout="vertical" margin={{top: 10, right: 25, left: 15, bottom: 10}}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }}/>
                                                <YAxis type="category" dataKey="name" width={135} tick={{ fontSize: 11 }}/>
                                                <Tooltip cursor={{ fill: "rgba(6, 93, 35, 0.05)" }}/>
                                                <Bar dataKey="quantitySold" name="Quantity Sold" fill="#065d23" radius={[0, 6, 6, 0]} maxBarSize={35}/>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                            </section>

                            {/* Category Sales */}
                            <section className="analytics-chart-card">
                                
                                <div className="analytics-chart-header">
                                    <h2>Category Sales</h2>
                                    <p>Gross food sales by category (USD)</p>
                                </div>

                                {foodCategories.length === 0 ? (
                                    <div className="analytics-empty">
                                        No category sales available.
                                    </div>
                                ) : (
                                    <div className="analytics-chart-area">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={foodCategories}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                                <XAxis dataKey="category" tick={{ fontSize: 11 }}/>
                                                <YAxis tick={{ fontSize: 11 }}/>
                                                <Tooltip formatter={(value) => money(value)} cursor={{ fill: "rgba(6, 93, 35, 0.05)" }}/>
                                                <Bar dataKey="grossItemSales" name="Gross Food Sales" fill="#65a97b" radius={[6, 6, 0, 0]} maxBarSize={65}/>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                            </section>

                        </div>

                        {/* Top Products Table */}
                        <section className="analytics-chart-card analytics-food-table-card">
                            
                            <div className="analytics-chart-header">
                                <h2>Best Selling Products</h2>
                                <p>Detailed product sales performance</p>
                            </div>

                            {foodProducts.length === 0 ? (
                                <div className="analytics-empty">
                                    No product sales data available.
                                </div>
                            ) : (
                                <div className="analytics-food-table-wrapper">
                                    
                                    <table className="analytics-food-table">
                                        
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Category</th>
                                                <th>Quantity Sold</th>
                                                <th>Orders</th>
                                                <th>Gross Sales</th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {foodProducts.map((food) => (
                                                <tr key={food.foodId}>
                                                    
                                                    <td>
                                                        <div className="analytics-food-product">
                                                            
                                                            {food.image ? (
                                                                <img src={`${API_URL}/images/${encodeURIComponent(food.image)}`} alt={food.name} loading="lazy"/>
                                                            ) : (
                                                                <div className="analytics-food-placeholder">
                                                                    <UtensilsCrossed size={18}/>
                                                                </div>
                                                            )}

                                                            <span>{food.name}</span>

                                                        </div>
                                                    </td>

                                                    <td>
                                                        <span className="analytics-category-badge">
                                                            {food.category}
                                                        </span>
                                                    </td>

                                                    <td>{food.quantitySold}</td>

                                                    <td>{food.orderCount}</td>

                                                    <td className="analytics-food-sales">
                                                        {money(food.grossItemSales)}
                                                    </td>

                                                </tr>
                                            ))}
                                        </tbody>

                                    </table>

                                </div>
                            )}

                        </section>

                    </section>

                    <div className="analytics-footer-note">
                        <AlertCircle size={15}/>
                        <span>
                            Revenue is grouped by order creation date. Recorded revenue is not the same as settled cash or net profit. All figures are in USD.
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default Analytics;