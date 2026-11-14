import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Package, RefreshCw, Truck, UserRound, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api.js";
import { useRider } from "../../context/RiderContext.jsx";
import "./Dashboard.css";

const PERIODS = [
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "all", label: "All Time" }
];

const COLORS = ["#009b43", "#c8f48a", "#ff821c", "#57a8e8", "#a78bfa", "#f3c452"];

const formatDate = (date) => {
  if(!date){
    return "—"
  };

  const parsed = new Date(date);

  if(Number.isNaN(parsed.getTime())){
    return "—";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const formatMoney = (value) => {
  const amount = Number(value);

  if(!Number.isFinite(amount)){
    return "—";
  }

  return `$${amount.toFixed(2)}`;
};

const getArea = (order) => {
  const address = order?.address;

  if(!address){
    return "Unknown Area";
  }

  if(typeof address === "string"){
    const parts = address.split(",").map((part) => part.trim());
    return parts.length > 1 ? parts[parts.length - 1] : address;
  }

  return(address.city?.trim() || address.state?.trim() || "Unknown Area");
};

const getStatusClass = (status) => {
  switch(status){
    case "Delivered" : return "completed";
    case "Out for Delivery" : return "out";
    case "Processing" : return "processing";
    case "Pending" : return "pending";
    case "Cancelled" : return "cancelled";
    default : return "pending";
  }
};

// Use the local calendar date instead of UTC.
const getDateKey = (value) => {
  if(!value){
    return null;
  }

  const date = new Date(value);

  if(Number.isNaN(date.getTime())){
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMonthTitle = (date) => {
  return date.toLocaleDateString("en-US", {month: "long", year: "numeric"});
};

function Dashboard(){
  const { rider } = useRider();

  const [orders, setOrders] = useState([]);
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [selectedDate, setSelectedDate] = useState(() => getDateKey(new Date()));

  const fetchOrders = async (refresh = false) => {
    try {
      if(refresh){
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      
      const response = await api.get("/orders");

      if(response.data?.success === false){
        throw new Error(response.data?.message || "Unable to load deliveries.");
      }

      const payload = response.data;

      const orderList = Array.isArray(payload) ? payload : Array.isArray(payload?.orders) ? payload.orders : Array.isArray(payload?.data?.orders) ? payload.data.orders : Array.isArray(payload?.data) ? payload.data : null;

      if(!orderList){
        throw new Error("Unexpected orders response from server.");
      }

      setOrders(orderList);

      if(refresh){
        toast.success("Dashboard updated successfully!");
      }
      
    } catch (fetchError) {
      console.error("Dashboard orders error:", fetchError);
      setError(fetchError.response?.data?.message || fetchError.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Existing statistics period filter.
  const filteredOrders = useMemo(() => {
    if(period === "all"){
      return orders;
    }

    const days = Number(period);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days - 1));
    cutoff.setHours(0, 0, 0, 0);

    return orders.filter((order) => {
      if(!order.createdAt){
        return false;
      }

      const date = new Date(order.createdAt);

      return (!Number.isNaN(date.getTime()) && date >= cutoff);
    });
  }, [orders, period]);

  const statistics = useMemo(() => {
    const completed = filteredOrders.filter((order) => order.orderStatus === "Delivered").length;

    const active = filteredOrders.filter((order) => ["Pending", "Processing", "Out for Delivery"].includes(order.orderStatus)).length;

    return {
      total: filteredOrders.length,
      completed,
      active
    };
  }, [filteredOrders]);

  const areaStatistics = useMemo(() => {
    const counts = {};

    filteredOrders.forEach((order) => {
      const area = getArea(order);
      counts[area] = (counts[area] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    const topAreas = sorted.slice(0, 5).map(([name, count]) => ({ name, count }));

    const otherCount = sorted.slice(5).reduce((total, [, count]) => total + count, 0);

    if(otherCount > 0){
      topAreas.push({
        name: "Other Areas",
        count: otherCount
      });
    }

    return topAreas.map((area, index) => ({
      ...area,
      percentage: statistics.total ? (area.count / statistics.total) * 100 : 0,
      color: COLORS[index % COLORS.length]
    }));
  }, [filteredOrders, statistics.total]);

  const donutGradient = useMemo(() => {
    if(areaStatistics.length === 0){
      return "conic-gradient(#e9eeeb 0% 100%)";
    }

    let current = 0;

    const segments = areaStatistics.map((area) => {
      const start = current;
      current += area.percentage;

      return `${area.color} ${start}% ${current}%`;
    });

    return `conic-gradient(${segments.join(", ")})`;
  }, [areaStatistics]);

  const recentOrders = useMemo(() => {
    return [...filteredOrders].sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6);
  }, [filteredOrders]);

  // Calendar uses actual completion timestamps.
  const completedOrders = useMemo(() => {
    return orders.filter(
      (order) => order.orderStatus === "Delivered" && getDateKey(order.deliveredAt)
    );
  }, [orders]);

  const deliveriesByDate = useMemo(() => {
    const grouped = {};

    completedOrders.forEach((order) => {
      const dateKey = getDateKey(order.deliveredAt);

      if(!dateKey){
        return;
      }

      if(!grouped[dateKey]){
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(order);
    });

    return grouped;
  }, [completedOrders]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];

    for(let i = 0; i < firstDay; i++){
      cells.push(null);
    }

    for(let day = 1; day <= daysInMonth; day++){
      cells.push(new Date(year, month, day));
    }

    while(cells.length % 7 !== 0){
      cells.push(null);
    }

    return cells;
  }, [calendarMonth]);

  const selectedOrders = useMemo(() => {
    return [...(deliveriesByDate[selectedDate] || [])].sort(
      (a, b) => new Date(b.deliveredAt || 0) - new Date(a.deliveredAt || 0)
    );
  }, [deliveriesByDate, selectedDate]);

  const selectedEarnings = useMemo(() => {
    const recordedOrders = selectedOrders.filter(
      (order) => order.riderEarning !== null && order.riderEarning !== undefined && Number.isFinite(Number(order.riderEarning))
    );

    const total = recordedOrders.reduce(
      (sum, order) => sum + Number(order.riderEarning), 0
    );

    return {
      total,
      recordedCount: recordedOrders.length,
      missingCount: selectedOrders.length - recordedOrders.length
    };
  }, [selectedOrders]);

  const monthlyDeliveries = useMemo(() => {
    return completedOrders.filter((order) => {
      const date = new Date(order.deliveredAt);

      return (
        date.getFullYear() === calendarMonth.getFullYear() && date.getMonth() === calendarMonth.getMonth()
      );
    }).length;
  }, [completedOrders, calendarMonth]);

  const changeMonth = (offset) => {
    const newMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);

    setCalendarMonth(newMonth);
    setSelectedDate(getDateKey(newMonth));
  };

  const todayKey = getDateKey(new Date());

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const selectedDateLabel = selectedDate ? formatDate(`${selectedDate}T12:00:00`) : "Select a date";

  return (
    <main className="rider-dashboard">
      <div className="rider-dashboard-container">
        
        {/* Welcome */}
        <div className="rider-dashboard-heading">
          <div>
            <p className="rider-dashboard-eyebrow">
              QUICKTASTE RIDER PORTAL
            </p>

            <h1>
              Hello, {rider?.name?.split(" ")[0] || "Rider"}!
            </h1>

            <p className="rider-dashboard-subtitle">
              Here is your delivery overview.
            </p>
          </div>

          <div className="rider-dashboard-date">
            <CalendarDays size={18}/>
            <span>{today}</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="rider-dashboard-toolbar">
          <div className="rider-dashboard-period">
            <CalendarDays size={18}/>

            <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Select statistics period">
              {PERIODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="rider-dashboard-refresh" onClick={() => fetchOrders(true)} disabled={loading || refreshing}>
            <RefreshCw size={17} className={refreshing ? "rider-spinning" : ""}/>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rider-dashboard-error">
            <p>{error}</p>

            <button type="button" onClick={() => fetchOrders()}>
              Try Again
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="rider-dashboard-stats">
          
          <div className="rider-dashboard-stat-card">
            <div className="rider-dashboard-stat-top">
              <span>Total Deliveries</span>
              <div className="rider-stat-icon green">
                <Package size={24}/>
              </div>
            </div>

            <h2>{loading ? "—" : statistics.total}</h2>
            <p>Assigned orders in selected period</p>
          </div>

          <div className="rider-dashboard-stat-card">
            <div className="rider-dashboard-stat-top">
              <span>Active Deliveries</span>
              <div className="rider-stat-icon orange">
                <Truck size={24}/>
              </div>
            </div>

            <h2>{loading ? "—" : statistics.active}</h2>
            <p>Deliveries currently in progress</p>
          </div>

          <div className="rider-dashboard-stat-card">
            <div className="rider-dashboard-stat-top">
              <span>Completed Deliveries</span>
              <div className="rider-stat-icon lime">
                <CheckCircle2 size={24}/>
              </div>
            </div>

            <h2>{loading ? "—" : statistics.completed}</h2>
            <p>Orders marked as delivered</p>
          </div>

        </div>

        {/* Main Dashboard Content */}
        <div className="rider-dashboard-main-grid">
          
          {/* Statistics Donut Chart */}
          <section className="rider-dashboard-panel rider-dashboard-chart-panel">
            <div className="rider-dashboard-panel-header">
              <h2>Statistics</h2>
              <span className="rider-dashboard-panel-caption">
                Delivery areas
              </span>
            </div>

            <div className="rider-dashboard-area-list">
              {areaStatistics.length > 0 ? (
                areaStatistics.map((area) => (
                  <div key={area.name} className="rider-dashboard-area-item">
                    <div className="rider-dashboard-area-name">
                      <span className="rider-dashboard-area-dot" style={{ backgroundColor: area.color }}/>
                      <span>{area.name}</span>
                    </div>

                    <strong>
                      {area.percentage.toFixed(1)}%
                    </strong>
                  </div>
                ))
              ) : (
                <p className="rider-dashboard-no-areas">
                  No delivery areas available.
                </p>
              )}
            </div>

            <div className="rider-dashboard-donut-wrapper">
              <div className="rider-dashboard-donut" style={{ background: donutGradient }} role="img" aria-label={`Delivery area distribution for ${statistics.total} orders`}>
                <div className="rider-dashboard-donut-hole">
                  <span>Total orders</span>
                  <strong>
                    {loading ? "—" : statistics.total}
                  </strong>
                </div>
              </div>
            </div>

            <p className="rider-dashboard-chart-note">
              <MapPin size={14}/>
              Based on assigned order delivery addresses
            </p>
          </section>

          {/* Orders History */}
          <section className="rider-dashboard-panel rider-dashboard-history-panel">
            <div className="rider-dashboard-panel-header">
              <h2>Orders History</h2>

              <Link to="/orders" className="rider-dashboard-view-all">
                View all <ArrowRight size={16}/>
              </Link>
            </div>

            {loading ? (
              <div className="rider-dashboard-empty">
                <p>Loading deliveries...</p>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="rider-dashboard-empty">
                <Package size={38}/>
                <h3>No deliveries found</h3>
                <p>Assigned orders will appear here.</p>
              </div>
            ) : (
              <div className="rider-dashboard-table-scroll">
                <table className="rider-dashboard-table">
                  <thead>
                    <tr>
                      <th>Order Number</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Area</th>
                      <th>Info</th>
                    </tr>
                  </thead>

                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order._id}>
                        <td>
                          <span className="rider-dashboard-order-id">
                            #{String(order._id).slice(-8).toUpperCase()}
                          </span>
                        </td>

                        <td>
                          <span className={`rider-dashboard-status ${getStatusClass(order.orderStatus)}`}>
                            {order.orderStatus || "Pending"}
                          </span>
                        </td>

                        <td>{formatDate(order.createdAt)}</td>

                        <td>{getArea(order)}</td>

                        <td>
                          <Link to="/orders" className="rider-dashboard-order-link" aria-label="View delivery details">
                            <ArrowRight size={17}/>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>

        {/* Monthly Delivery Calendar */}
        <section className="rider-dashboard-panel rider-dashboard-calendar-panel">
          <div className="rider-dashboard-calendar-heading">
            <div>
              <div className="rider-dashboard-calendar-title">
                <CalendarDays size={22}/>
                <h2>Delivery Calendar</h2>
              </div>

              <p>
                Track your completed deliveries by date.
              </p>
            </div>

            <div className="rider-dashboard-calendar-navigation">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={19}/>
              </button>

              <strong>{getMonthTitle(calendarMonth)}</strong>

              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
                <ChevronRight size={19}/>
              </button>
            </div>
          </div>

          <div className="rider-dashboard-calendar-layout">
            <div className="rider-dashboard-calendar-left">
              
              <div className="rider-dashboard-calendar-summary">
                <div>
                  <span>Monthly Completed</span>
                  <strong>{loading ? "—" : monthlyDeliveries}</strong>
                </div>

                <button type="button" onClick={() => {const current = new Date(); setCalendarMonth(new Date(current.getFullYear(), current.getMonth(), 1)); setSelectedDate(getDateKey(current));}}>
                  Today
                </button>
              </div>

              <div className="rider-dashboard-calendar-weekdays">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (<span key={day}>{day}</span>))}
              </div>

              <div className="rider-dashboard-calendar-days">
                {calendarDays.map((date, index) => {
                  if(!date){
                    return(
                      <div key={`empty-${index}`} className="rider-dashboard-calendar-blank"/>
                    );
                  }

                  const dateKey = getDateKey(date);
                  const dayOrders = deliveriesByDate[dateKey] || [];

                  const isSelected = selectedDate === dateKey;
                  const isToday = todayKey === dateKey;

                  return (
                    <button type="button" key={dateKey} className={["rider-dashboard-calendar-day", dayOrders.length > 0 ? "has-deliveries" : "", isSelected ? "selected" : "", isToday ? "today" : ""].filter(Boolean).join(" ")} onClick={() => setSelectedDate(dateKey)} aria-pressed={isSelected} aria-label={`${formatDate(date)}, ${dayOrders.length} completed deliveries`}>
                      <span>{date.getDate()}</span>

                      {dayOrders.length > 0 && (
                        <small>{dayOrders.length}</small>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rider-dashboard-calendar-legend">
                <span>
                  <i className="legend-completed"/>
                  Completed deliveries
                </span>

                <span>
                  <i className="legend-selected"/>
                  Selected date
                </span>
              </div>

            </div>

            <div className="rider-dashboard-calendar-details">
              <div className="rider-dashboard-calendar-details-header">
                <div>
                  <span>SELECTED DATE</span>
                  <h3>{selectedDateLabel}</h3>
                </div>

                <div className="rider-dashboard-calendar-completed-icon">
                  <CheckCircle2 size={23}/>
                </div>
              </div>

              <div className="rider-dashboard-calendar-detail-stats">
                <div>
                  <span>Completed</span>
                  <strong>{loading ? "—" : selectedOrders.length}</strong>
                </div>

                <div>
                  <span>Recorded Earnings</span>
                  <strong>{loading ? "—" : selectedEarnings.recordedCount > 0 ? formatMoney(selectedEarnings.total) : "—"}</strong>
                </div>
              </div>

              {selectedEarnings.missingCount > 0 && !loading && (
                <p className="rider-dashboard-calendar-earnings-note">
                  Earnings are not recorded for{" "}{selectedEarnings.missingCount} delivery(s).
                </p>
              )}

              <h4>Completed Orders</h4>

              {loading ? (
                <div className="rider-dashboard-calendar-empty">
                  <RefreshCw size={24}/>
                  <p>Loading deliveries...</p>
                </div>
              ) : selectedOrders.length === 0 ? (
                <div className="rider-dashboard-calendar-empty">
                  <CalendarDays size={30}/>
                  <p>No completed deliveries on this date.</p>
                </div>
              ) : (
                <div className="rider-dashboard-calendar-order-list">
                  {selectedOrders.map((order) => (
                    <div key={order._id} className="rider-dashboard-calendar-order">
                      <div className="rider-dashboard-calendar-order-top">
                        <strong>
                          #{String(order._id).slice(-8).toUpperCase()}
                        </strong>

                        <span>
                          <CheckCircle2 size={13}/>
                          Delivered
                        </span>
                      </div>

                      <div className="rider-dashboard-calendar-order-meta">
                        <span>
                          <MapPin size={14}/>
                          {getArea(order)}
                        </span>

                        <span>
                          <Clock3 size={14}/>
                          {new Date(order.deliveredAt).toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit"})}
                        </span>
                      </div>

                      <div className="rider-dashboard-calendar-order-bottom">
                        <span>
                          <Wallet size={15}/>
                          Rider Earning
                        </span>

                        <strong>
                          {order.riderEarning !== null && order.riderEarning !== undefined ? formatMoney(order.riderEarning) : "Not recorded"}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="rider-dashboard-quick-actions">
          <div className="rider-dashboard-quick-heading">
            <h2>Quick Actions</h2>
            <p>Access your rider tools</p>
          </div>

          <div className="rider-dashboard-action-grid">
            <Link to="/orders" className="rider-dashboard-action">
              <div className="rider-dashboard-action-icon">
                <Truck size={23}/>
              </div>

              <div>
                <h3>My Deliveries</h3>
                <p>View assigned orders</p>
              </div>

              <ArrowRight size={19}/>
            </Link>

            <Link to="/profile" className="rider-dashboard-action">
              <div className="rider-dashboard-action-icon">
                <UserRound size={23}/>
              </div>

              <div>
                <h3>My Profile</h3>
                <p>Manage rider information</p>
              </div>

              <ArrowRight size={19}/>
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}

export default Dashboard;