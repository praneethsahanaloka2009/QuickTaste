import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Wallet, Clock3, CheckCircle2, RefreshCw, Plus, X, CalendarDays, Banknote } from "lucide-react";
import "./CODSettlements.css";

const API_URL = "http://localhost:4911";

const getId = (value) => {
    if(!value){
        return "";
    }
    return String(typeof value === "object" ? value._id || "" : value);
};

const getSriLankaDate = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date(value));

    const getPart = (type) => parts.find((part) => part.type === type)?.value || "";

    return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

const toCents = (amount) => Math.round(Number(amount) * 100);

const formatMoney = (amount) => `$${Number(amount || 0).toFixed(2)}`;

const formatDate = (date) => {
    if(!date){
        return "N/A";
    }

    return new Date(date).toLocaleDateString("en-GB", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "short",
        day: "numeric"
    });
};

const CODSettlements = () => {
    const [settlements, setSettlements] = useState([]);
    const [branches, setBranches] = useState([]);
    const [riders, setRiders] = useState([]);
    const [orders, setOrders] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState("All");
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedSettlement, setSelectedSettlement] = useState(null);
    const [receivedAmount, setReceivedAmount] = useState("");
    const [confirming, setConfirming] = useState(false);

    const [form, setForm] = useState({
        branchId: "",
        riderId: "",
        settlementDate: getSriLankaDate()
    });

    const [selectedOrderIds, setSelectedOrderIds] = useState([]);

    const fetchJson = useCallback(async (path, options = {}) => {
        const token = localStorage.getItem("adminToken");

        if(!token){
            throw new Error("Admin login is required.");
        }

        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...options.headers
            }
        });

        const data = await response.json();

        if(!response.ok || !data.success){
            throw new Error(
                data.message || "Request failed."
            );
        }

        return data;
    }, []);

    const fetchSettlements = useCallback(async (options = {}) => {
        const { manual = false } = options;

        try {
            if(manual){
                // Keep settlement cards and records visible
                setRefreshing(true);
            } else {
                // Initial load and post-action reload
                setLoading(true);
            }

            const data = await fetchJson(
                "/api/cod-settlement/list",
                {
                    cache: "no-store"
                }
            );

            setSettlements(Array.isArray(data.settlements) ? data.settlements : []);

            // Only show success toast for manual refresh
            if(manual){
                toast.success(
                    "COD settlements refreshed successfully!",
                    {
                        autoClose: 1800
                    }
                );
            }

            return true;

        } catch (error) {
            console.error("Fetch COD Settlements Error:", error);

            toast.error(error.message || "Failed to load settlements.");

            return false;

        } finally {
            if(manual){
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, [fetchJson]);

    useEffect(() => {
        fetchSettlements();
    }, [fetchSettlements]);

    // Refresh COD settlements without hiding existing data
    const handleRefresh = async () => {
        
        if(loading || refreshing || saving || confirming){
            return;
        }

        await fetchSettlements({ manual: true });

    };

    const loadCreateData = async () => {
        try {
            const [branchesData, ridersData, ordersData, settlementsData] = await Promise.all([fetchJson("/api/branch/list"), fetchJson("/api/admin/riders"), fetchJson("/api/order/admin/orders"), fetchJson("/api/cod-settlement/list")]);

            // Support common list response shapes.
            const branchList = branchesData.branches;
            const riderList = ridersData.riders;
            const orderList = ordersData.orders;

            if(!Array.isArray(branchList) || !Array.isArray(riderList) || !Array.isArray(orderList)){
                throw new Error(
                    "Unexpected branch, rider or order API response."
                );
            }

            setBranches(branchList);
            setRiders(riderList);
            setOrders(orderList);
            setSettlements(settlementsData.settlements || []);

            setForm({
                branchId: "",
                riderId: "",
                settlementDate: getSriLankaDate()
            });

            setSelectedOrderIds([]);
            setShowCreateModal(true);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const settledOrderIds = useMemo(() => {
        const ids = new Set();

        settlements.forEach((settlement) => {
            (settlement.orders || []).forEach((order) => {
                ids.add(getId(order));
            });
        });

        return ids;
    }, [settlements]);

    const eligibleOrders = useMemo(() => {
        if(!form.branchId || !form.riderId || !form.settlementDate){
            return [];
        }

        return orders.filter((order) => {
            const collected = Number(
                order.riderCashCollectedAmount
            );

            const expected = Number(order.amount) + Number(order.deliveryFee);

            return (
                order.paymentMethod === "Cash on Delivery" && order.paymentStatus === "Paid" && order.orderStatus === "Delivered" && order.riderCashCollected === true && getId(order.branchId) === form.branchId && getId(order.assignedRider) === form.riderId && order.deliveredAt && getSriLankaDate(order.deliveredAt) === form.settlementDate && !settledOrderIds.has(getId(order._id)) && Number.isFinite(collected) && Number.isFinite(expected) && collected > 0 && toCents(collected) === toCents(expected)
            );
        });
    }, [orders, form, settledOrderIds]);

    const selectedOrders = useMemo(() => {
        const selected = new Set(selectedOrderIds);

        return eligibleOrders.filter((order) =>
            selected.has(getId(order._id))
        );
    }, [eligibleOrders, selectedOrderIds]);

    const expectedAmount = useMemo(() => {
        const cents = selectedOrders.reduce(
            (total, order) => total + toCents(order.riderCashCollectedAmount), 0
        );

        return cents / 100;
    }, [selectedOrders]);

    const summary = useMemo(() => {
        const pending = settlements.filter(
            (item) => item.status === "Pending"
        );

        const settled = settlements.filter(
            (item) => item.status === "Settled"
        );

        return {
            expected: settlements.reduce(
                (total, item) =>
                    total + Number(item.expectedAmount || 0),
                0
            ),

            received: settled.reduce(
                (total, item) =>
                    total + Number(item.receivedAmount || 0),
                0
            ),

            pending: pending.reduce(
                (total, item) =>
                    total + Number(item.expectedAmount || 0),
                0
            ),

            settledCount: settled.length
        };
    }, [settlements]);

    const filteredSettlements = useMemo(() => {
        if (statusFilter === "All") return settlements;

        return settlements.filter(
            (item) => item.status === statusFilter
        );
    }, [settlements, statusFilter]);

    const updateForm = (field, value) => {
        setForm((previous) => ({
            ...previous,
            [field]: value
        }));

        setSelectedOrderIds([]);
    };

    const toggleOrder = (orderId) => {
        setSelectedOrderIds((previous) => previous.includes(orderId) ? previous.filter((id) => id !== orderId) : [...previous, orderId]);
    };

    const toggleAllOrders = () => {
        const eligibleIds = eligibleOrders.map(
            (order) => getId(order._id)
        );

        const allSelected = eligibleIds.every((id) =>
            selectedOrderIds.includes(id)
        );

        setSelectedOrderIds(
            allSelected ? [] : eligibleIds
        );
    };

    const handleCreateSettlement = async (event) => {
        event.preventDefault();

        if(!form.branchId || !form.riderId){
            toast.error("Select a branch and rider.");
            return;
        }

        if(selectedOrders.length === 0){
            toast.error("Select at least one COD order.");
            return;
        }

        setSaving(true);

        try {
            const data = await fetchJson(
                "/api/cod-settlement/create",
                {
                    method: "POST",
                    body: JSON.stringify({
                        branchId: form.branchId,
                        riderId: form.riderId,
                        settlementDate: form.settlementDate,
                        orderIds: selectedOrders.map(
                            (order) => getId(order._id)
                        )
                    })
                }
            );

            toast.success(data.message || "COD settlement created successfully.");

            setShowCreateModal(false);
            setSelectedOrderIds([]);
            await fetchSettlements();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const openConfirmModal = (settlement) => {
        if(settlement.status !== "Pending"){
            toast.error("Only pending settlements can be confirmed.");
            return;
        }

        setSelectedSettlement(settlement);
        setReceivedAmount("");
        setShowConfirmModal(true);
    };

    const closeConfirmModal = () => {
        if(confirming){
            return;
        }

        setShowConfirmModal(false);
        setSelectedSettlement(null);
        setReceivedAmount("");
    };

    const handleConfirmSettlement = async (event) => {
        event.preventDefault();

        if(!selectedSettlement || confirming){
            return;
        }

        const amountText = receivedAmount.trim();

        if(!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(Number(amountText))){
            toast.error("Enter a valid received cash amount.");
            return;
        }

        const actualAmount = Number(amountText);
        const expectedAmount = Number(selectedSettlement.expectedAmount);

        if(toCents(actualAmount) !== toCents(expectedAmount)){
            toast.error(`Received cash must equal ${formatMoney(expectedAmount)}.`);
            return;
        }

        setConfirming(true);

        try {
            const data = await fetchJson(
                `/api/cod-settlement/${selectedSettlement._id}/confirm`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        receivedAmount: actualAmount
                    })
                }
            );

            toast.success(data.message || "Cash receipt confirmed successfully.");

            setShowConfirmModal(false);
            setSelectedSettlement(null);
            setReceivedAmount("");

            await fetchSettlements();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setConfirming(false);
        }
    };

    return(
        <div className="cod-settlements-page">
            
            <div className="cod-page-header">
                <div>
                    <h2>COD Cash Settlements</h2>
                    <p>
                        Manage daily rider cash settlements for QuickTaste branches.
                    </p>
                </div>

                <div className="cod-header-actions">
                    <button type="button" className="cod-refresh-btn" onClick={handleRefresh} disabled={loading || refreshing || saving || confirming} aria-label={refreshing ? "Refreshing COD settlements" : "Refresh COD settlements"} aria-busy={refreshing}>
                        <RefreshCw size={17} className={refreshing ? "cod-refresh-spinning" : ""}/>
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>

                    <button type="button" className="cod-create-btn" onClick={loadCreateData}>
                        <Plus size={18}/>
                        Create Settlement
                    </button>
                </div>
            </div>

            <div className="cod-summary-grid">
                <div className="cod-summary-card">
                    <Wallet size={24}/>
                    <p>Total Expected Cash</p>
                    <h3>{formatMoney(summary.expected)}</h3>
                </div>

                <div className="cod-summary-card">
                    <CheckCircle2 size={24}/>
                    <p>Total Received Cash</p>
                    <h3>{formatMoney(summary.received)}</h3>
                </div>

                <div className="cod-summary-card">
                    <Clock3 size={24}/>
                    <p>Pending Cash</p>
                    <h3>{formatMoney(summary.pending)}</h3>
                </div>

                <div className="cod-summary-card">
                    <CheckCircle2 size={24}/>
                    <p>Settled Batches</p>
                    <h3>{summary.settledCount}</h3>
                </div>
            </div>

            <div className="cod-table-section">
                <div className="cod-table-header">
                    <h3>Settlement Records</h3>

                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="All">All Settlements</option>
                        <option value="Pending">Pending</option>
                        <option value="Settled">Settled</option>
                    </select>
                </div>

                {loading ? (
                    <p className="cod-empty-message">
                        Loading settlements...
                    </p>
                ) : filteredSettlements.length === 0 ? (
                    <p className="cod-empty-message">
                        No settlement records found.
                    </p>
                ) : (
                    <div className="cod-table-wrapper">
                        <table className="cod-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Branch</th>
                                    <th>Rider</th>
                                    <th>Orders</th>
                                    <th>Expected</th>
                                    <th>Received</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredSettlements.map(
                                    (settlement) => (
                                        <tr key={settlement._id}>
                                            <td>
                                                {formatDate(settlement.settlementDate)}
                                            </td>
                                            <td>
                                                {settlement.branchId?.name || "N/A"}
                                            </td>
                                            <td>
                                                {settlement.riderId?.name || "N/A"}
                                            </td>
                                            <td>
                                                {settlement.orders?.length || 0}
                                            </td>
                                            <td>
                                                {formatMoney(settlement.expectedAmount)}
                                            </td>
                                            <td>
                                                {formatMoney(settlement.receivedAmount)}
                                            </td>
                                            <td>
                                                <span className={settlement.status === "Settled" ? "cod-status settled" : "cod-status pending"}>
                                                    {settlement.status}
                                                </span>
                                            </td>
                                            <td>
                                                {settlement.status === "Pending" ? (
                                                    <button type="button" className="cod-confirm-action-btn" onClick={() => openConfirmModal(settlement)}>
                                                        <Banknote size={16}/>
                                                        Confirm Cash
                                                    </button>
                                                ) : (
                                                    <span className="cod-confirmed-label">
                                                        <CheckCircle2 size={15}/>
                                                        Confirmed
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="cod-modal-overlay" role="presentation">
                    <div className="cod-modal" role="dialog" aria-modal="true" aria-labelledby="cod-modal-title">
                        <div className="cod-modal-header">
                            <div>
                                <h3 id="cod-modal-title">
                                    Create Daily Settlement
                                </h3>
                                <p>
                                    Select delivered COD orders for one rider and branch.
                                </p>
                            </div>

                            <button type="button" className="cod-modal-close" onClick={() => setShowCreateModal(false)} disabled={saving} aria-label="Close">
                                <X size={20}/>
                            </button>
                        </div>

                        <form onSubmit={handleCreateSettlement}>
                            <div className="cod-modal-body">
                                
                                <div className="cod-form-grid">

                                    <label className="cod-form-field">
                                        <span>Branch</span>
                                        <select required value={form.branchId} onChange={(event) => updateForm("branchId", event.target.value)}>

                                            <option value="">
                                                Select Branch
                                            </option>

                                            {branches.map((branch) => (
                                                <option key={branch._id} value={branch._id}>
                                                    {branch.name}
                                                </option>
                                            ))}

                                        </select>
                                    </label>

                                    <label className="cod-form-field">
                                        <span>Rider</span>
                                        <select required value={form.riderId} onChange={(event) => updateForm("riderId", event.target.value)}>
                                            
                                            <option value="">
                                                Select Rider
                                            </option>

                                            {riders.map((rider) => (
                                                <option key={rider._id} value={rider._id}>
                                                    {rider.name}
                                                </option>
                                            ))}

                                        </select>
                                    </label>

                                    <label className="cod-form-field">
                                        <span>Settlement Date</span>
                                        <div className="cod-date-field">
                                            <CalendarDays size={17}/>
                                            <input type="date" required value={form.settlementDate} onChange={(event) => updateForm("settlementDate", event.target.value)}/>
                                        </div>
                                    </label>

                                </div>

                                <div className="cod-order-selection">
                                    <div className="cod-order-selection-header">
                                        <div>
                                            <h4>Eligible COD Orders</h4>
                                            <p>
                                                {eligibleOrders.length} orders available
                                            </p>
                                        </div>

                                        {eligibleOrders.length > 0 && (
                                            <button type="button" className="cod-select-all-btn" onClick={toggleAllOrders}>
                                                {selectedOrderIds.length === eligibleOrders.length ? "Deselect All" : "Select All"}
                                            </button>
                                        )}
                                    </div>

                                    {eligibleOrders.length === 0 ? (
                                        <p className="cod-no-orders">
                                            No eligible COD orders found for the selected branch,rider and date.
                                        </p>
                                    ) : (
                                        <div className="cod-order-list">
                                            {eligibleOrders.map((order) => {
                                                const id = getId(order._id);

                                                return (
                                                    <label key={id} className="cod-order-item">
                                                        <input type="checkbox" checked={selectedOrderIds.includes(id)} onChange={() => toggleOrder(id)}/>
                                                        <div>
                                                            <strong>#{id.slice(-8)}</strong>
                                                            <span>{formatDate(order.deliveredAt)}</span>
                                                        </div>

                                                        <strong>{formatMoney(order.riderCashCollectedAmount)}</strong>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="cod-create-summary">
                                    <div>
                                        <span>Selected Orders</span>
                                        <strong>{selectedOrders.length}</strong>
                                    </div>

                                    <div>
                                        <span>Expected Cash</span>
                                        <strong>{formatMoney(expectedAmount)}</strong>
                                    </div>
                                </div>

                            </div>

                            <div className="cod-modal-footer">
                                <button type="button" className="cod-cancel-btn" onClick={() => setShowCreateModal(false)} disabled={saving}>
                                    Cancel
                                </button>

                                <button type="submit" className="cod-submit-btn" disabled={saving || selectedOrders.length === 0}>
                                    {saving ? "Creating..." : "Create Settlement"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Cash Receipt Modal */}
            {showConfirmModal && selectedSettlement && (
                <div className="cod-modal-overlay" role="presentation">
                    <div className="cod-modal cod-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="cod-confirm-title">
                        <div className="cod-modal-header">
                            <div>
                                <h3 id="cod-confirm-title">
                                    Confirm Cash Receipt
                                </h3>
                                <p>
                                    Verify the cash received from the rider.
                                </p>
                            </div>

                            <button type="button" className="cod-modal-close" onClick={closeConfirmModal} disabled={confirming} aria-label="Close confirmation">
                                <X size={20}/>
                            </button>
                        </div>

                        <form onSubmit={handleConfirmSettlement}>
                            <div className="cod-modal-body">
                                
                                <div className="cod-confirm-details">
                                    <div>
                                        <span>Branch</span>
                                        <strong>
                                            {selectedSettlement.branchId?.name || "N/A"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Rider</span>
                                        <strong>
                                            {selectedSettlement.riderId?.name || "N/A"}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Settlement Date</span>
                                        <strong>
                                            {formatDate(selectedSettlement.settlementDate)}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>COD Orders</span>
                                        <strong>
                                            {selectedSettlement.orders?.length || 0}
                                        </strong>
                                    </div>
                                </div>

                                <div className="cod-confirm-expected">
                                    <span>Expected Cash</span>
                                    <strong>
                                        {formatMoney(selectedSettlement.expectedAmount)}
                                    </strong>
                                </div>

                                <label className="cod-form-field cod-confirm-amount-field">
                                    <span>Actual Cash Received ($)</span>
                                    <input type="number" min="0" step="0.01" required placeholder="Enter actual received amount" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} disabled={confirming}/>
                                </label>

                                <p className="cod-confirm-note">
                                    Confirm only after physically receiving and counting the cash. Rider earnings are tracked and paid separately.
                                </p>

                            </div>

                            <div className="cod-modal-footer">
                                
                                <button type="button" className="cod-cancel-btn" onClick={closeConfirmModal} disabled={confirming}>
                                    Cancel
                                </button>

                                <button type="submit" className="cod-submit-btn" disabled={confirming}>
                                    {confirming ? "Confirming..." : "Confirm Cash Receipt"}
                                </button>

                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CODSettlements;