import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Wallet, CircleDollarSign, Clock3, BadgeCheck, Truck, RefreshCw, History, MapPin, CalendarDays, AlertCircle } from "lucide-react"
import "./Earnings.css";

const API_BASE = "http://localhost:4911/api/rider-payout";

const money = (amount) => {
  const value = Number(amount);
  return `$${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
};

const formatDate = (date) => {
  if(!date){
    return "—";
  }

  const value = new Date(date);

  if(Number.isNaN(value.getTime())){
    return "—";
  }

  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const shortOrderId = (id) => {
  if(!id){
    return "—";
  }

  return `#${String(id).slice(-8).toUpperCase()}`;
};

function Earnings() {
  const [summary, setSummary] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadEarnings = useCallback(async (showLoader = false, signal) => {
    if(showLoader){
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const token = localStorage.getItem("riderToken");

      if(!token){
        throw new Error("Please log in to view your earnings.");
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal
      };

      const [earningsResponse, payoutsResponse] = await Promise.all([
        axios.get(`${API_BASE}/my-earnings`, config),
        axios.get(`${API_BASE}/my-payouts`, config)
      ]);

      if(!earningsResponse.data?.success || !payoutsResponse.data?.success){
        throw new Error("Unable to load earnings information.");
      }

      setSummary(earningsResponse.data.summary || {});
      setDeliveries(earningsResponse.data.recentDeliveries || []);
      setPayouts(payoutsResponse.data.payouts || []);

    } catch (error) {
      if(axios.isCancel(error) || error.code === "ERR_CANCELED"){
        return;
      }

      setError(error.response?.data?.message || error.message || "Failed to load earnings.");
    } finally {
      if(!signal?.aborted){
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadEarnings(true, controller.signal);

    return() => {
      controller.abort();
    }
  }, [loadEarnings]);

  const cards = [
    {
      title: "Total Earnings",
      value: summary?.totalEarnings,
      description: "Earnings from completed deliveries",
      icon: Wallet,
      type: "total"
    },
    {
      title: "Available Earnings",
      value: summary?.availableEarnings,
      description: "Not yet included in a payout",
      icon: CircleDollarSign,
      type: "available"
    },
    {
      title: "Pending Payouts",
      value: summary?.pendingPayouts,
      description: "Awaiting payment confirmation",
      icon: Clock3,
      type: "pending"
    },
    {
      title: "Total Paid",
      value: summary?.totalPaid,
      description: "Confirmed rider payments",
      icon: BadgeCheck,
      type: "paid"
    }
  ];

  return (
    <main className="rider-earnings-page">
      <div className="rider-earnings-container">
        
        <div className="rider-earnings-header">
          <div>
            <p className="rider-earnings-eyebrow">
              QUICKTASTE RIDER PORTAL
            </p>

            <h1>My Earnings</h1>

            <p className="rider-earnings-subtitle">
              Track your delivery earnings and payout history.
            </p>
          </div>

          <button className="rider-earnings-refresh" onClick={() => loadEarnings(false)} disabled={loading || refreshing} type="button">
            <RefreshCw size={18} className={refreshing ? "rider-earnings-spin" : ""}/>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rider-earnings-error">
            <AlertCircle size={20}/>
            <span>{error}</span>
            <button type="button" onClick={() => loadEarnings(true)}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="rider-earnings-loading">
            <RefreshCw size={26} className="rider-earnings-spin"/>
            <p>Loading your earnings...</p>
          </div>
        ) : summary ? (
          <>
            <section className="rider-earnings-stats">
              {cards.map((card) => {
                const Icon = card.icon;

                return (
                  <div className="rider-earnings-stat-card" key={card.type}>
                    <div className="rider-earnings-stat-top">
                      <span>{card.title}</span>

                      <div className={`rider-earnings-stat-icon ${card.type}`}>
                        <Icon size={23}/>
                      </div>
                    </div>

                    <h2>{money(card.value)}</h2>

                    <p>{card.description}</p>
                  </div>
                );
              })}
            </section>

            <section className="rider-earnings-overview">

              <div className="rider-earnings-overview-icon">
                <Truck size={24}/>
              </div>

              <div>
                <span>Completed Deliveries</span>
                <strong>
                  {summary.completedDeliveries ?? 0}
                </strong>
              </div>

              <div className="rider-earnings-overview-divider"/>

              <div>
                <span>Available for Payout</span>
                <strong>{summary.availableOrders ?? 0} orders</strong>
              </div>
              
            </section>

            <section className="rider-earnings-panel">
              
              <div className="rider-earnings-panel-header">
                <div>
                  <h2>Recent Delivery Earnings</h2>
                  <p>
                    Earnings from your latest completed deliveries
                  </p>
                </div>
                
                <Truck size={22}/>
              </div>


              {deliveries.length === 0 ? (
                <div className="rider-earnings-empty">
                  <Truck size={30}/>
                  <h3>No delivery earnings yet</h3>
                  <p>
                    Your completed delivery earnings will appear here.
                  </p>
                </div>
              ) : (
                <div className="rider-earnings-table-wrap">
                  <table className="rider-earnings-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Distance</th>
                        <th>Status</th>
                        <th className="rider-earnings-right">
                          Earnings
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {deliveries.map((delivery) => (
                        <tr key={delivery.orderId}>
                          <td>
                            <span className="rider-earnings-order-id">
                              {shortOrderId(delivery.orderId)}
                            </span>
                          </td>

                          <td>
                            <span className="rider-earnings-cell-icon">
                              <CalendarDays size={15}/>
                              {formatDate(delivery.deliveredAt)}
                            </span>
                          </td>

                          <td>
                            <span className="rider-earnings-cell-icon">
                              <MapPin size={15}/>
                              {delivery.deliveryDistanceKm == null ? "—" : `${Number(delivery.deliveryDistanceKm).toFixed(2)} km`}
                            </span>
                          </td>

                          <td>
                            <span className={`rider-earnings-status ${delivery.payoutStatus === "Available" ? "available" : "batched"}`}>
                              {delivery.payoutStatus}
                            </span>
                          </td>

                          <td className="rider-earnings-right rider-earnings-amount">
                            {money(delivery.earning)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </section>

            <section className="rider-earnings-panel">
              <div className="rider-earnings-panel-header">
                <div>
                  <h2>Payout History</h2>
                  <p>
                    Payments recorded by QuickTaste administration
                  </p>
                </div>

                <History size={22}/>
              </div>

              {payouts.length === 0 ? (
                <div className="rider-earnings-empty">
                  <History size={30}/>
                  <h3>No payouts yet</h3>
                  <p>
                    Your payout records will appear here.
                  </p>
                </div>
              ) : (
                <div className="rider-earnings-table-wrap">
                  <table className="rider-earnings-table">
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th>Orders</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th className="rider-earnings-right">
                          Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {payouts.map((payout) => (
                        <tr key={payout._id}>
                          <td className="rider-earnings-branch">
                            {payout.branchId?.name || "QuickTaste"}
                            <small>
                              {payout.branchId?.city || ""}
                            </small>
                          </td>

                          <td>
                            {payout.orders?.length || 0}
                          </td>

                          <td>
                            {formatDate(payout.paidAt || payout.createdAt)}
                          </td>

                          <td>
                            {payout.isSimulated ? "Mock Transfer" : payout.paymentMethod || "—"}
                          </td>

                          <td>
                            <span className={`rider-earnings-status ${payout.isSimulated ? "pending" : payout.status === "Paid" ? "paid" : "pending"}`}>
                              {payout.isSimulated && payout.status === "Paid" ? "Simulated" : payout.status}
                            </span>
                          </td>

                          <td className="rider-earnings-right rider-earnings-amount">
                            {money(payout.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="rider-earnings-footnote">
              Payouts are recorded after confirmation by QuickTaste administration. A confirmed payout does not itself initiate a bank transfer.
            </p>
          </>
        ) : null}

      </div>
    </main>
  );
}

export default Earnings;