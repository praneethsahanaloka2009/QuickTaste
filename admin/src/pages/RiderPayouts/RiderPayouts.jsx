import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, CircleCheck, Clock3, HandCoins, RefreshCw, Plus, X, Search, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import { API_URL } from "../../config/api";
import "./RiderPayouts.css";

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const getId = (value) => {
    if(!value){
        return "";
    }

    if(typeof value === "object"){
        return String(value._id || value.id || "");
    }

    return String(value);
};

const isTestPayout = (payout) => payout.environment === "test" || payout.payoutMode === "Automatic Test";

const canStartMockTransfer = (payout) => {
    const isFirstAttempt = payout.status === "Pending" && payout.payoutMode === "Manual" && payout.environment === "manual";

    const isRetry = payout.status === "Failed" && payout.payoutMode === "Automatic Test" && payout.environment === "test";

    return isFirstAttempt || isRetry;
};

const RiderPayouts = () => {
    const [payouts, setPayouts] = useState([]);
    const [testTransactions, setTestTransactions] = useState([]);
    const [showTransactionHistory, setShowTransactionHistory] = useState(false);
    const [selectedHistoryPayout, setSelectedHistoryPayout] = useState(null);
    const [orders, setOrders] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [statusFilter, setStatusFilter] = useState("All");
    const [search, setSearch] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
    const [showMockConfirmation, setShowMockConfirmation] = useState(false);
    const [selectedMockPayout, setSelectedMockPayout] = useState(null);
    const [showTestCompletion, setShowTestCompletion] = useState(false);
    const [selectedTestPayout, setSelectedTestPayout] = useState(null);
    const [selectedTestOutcome, setSelectedTestOutcome] = useState(null);

    const [selectedBranch, setSelectedBranch] = useState("");
    const [selectedRider, setSelectedRider] = useState("");
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [createNotes, setCreateNotes] = useState("");

    const [selectedPayout, setSelectedPayout] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentNotes, setPaymentNotes] = useState("");

    const [riderBankDetails, setRiderBankDetails] = useState(null);
    const [bankLoading, setBankLoading] = useState(false);
    const [bankError, setBankError] = useState("");
    const [bankTransferVerified, setBankTransferVerified] = useState(false);

    const getHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        "Content-Type": "application/json"
    });

    const request = async (path, options = {}) => {
        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                ...getHeaders(),
                ...(options.headers || {})
            }
        });

        const data = await response.json();

        if(!response.ok || data.success === false){
            throw new Error(data.message || "Request failed.");
        }

        return data;
    };

    const loadData = useCallback(async (options = {}) => {
        
        const { manual = false } = options;

        try {
            // Manual refresh keeps existing data visible
            if(manual){
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const [payoutData, orderData, branchData, transactionData] = await Promise.all([
                
                request("/api/rider-payout/list", {
                    cache: "no-store"
                }),

                request("/api/order/admin/orders", {
                    cache: "no-store"
                }),

                request("/api/branch/list", {
                    cache: "no-store"
                }),

                request("/api/rider-payout/test-transactions", {
                    cache: "no-store"
                })

            ]);

            // Test Transactions
            setTestTransactions(
                Array.isArray(transactionData.transactions) ? transactionData.transactions : []
            );

            // Rider Payouts
            setPayouts(
                Array.isArray(payoutData.payouts) ? payoutData.payouts : []
            );

            // Orders
            setOrders(
                Array.isArray(orderData.orders) ? orderData.orders : Array.isArray(orderData.data) ? orderData.data : []
            );

            // Branches
            setBranches(
                Array.isArray(branchData.branches) ? branchData.branches : []
            );

            // Success only for manual refresh
            if(manual){
                toast.success(
                    "Rider payouts refreshed successfully!",
                    {
                        autoClose: 1800
                    }
                );
            }

            return true;

        } catch (error) {
            console.error("Load Rider Payouts Error:", error);

            toast.error(error.message || "Failed to load rider payouts.");

            return false;

        } finally {
            if(manual){
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }

    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Refresh Rider Payouts without hiding the dashboard
    const handleRefresh = async () => {
        
        if(loading || refreshing || submitting){
            return;
        }

        await loadData({ manual: true });

    };

    const summary = useMemo(() => {
        const totals = {
            total: 0,
            paid: 0,
            simulatedPaid: 0,
            pending: 0,
            processing: 0,
            failed: 0,
            paidBatches: 0
        };

        for(const payout of payouts){
            const cents = Math.round(Number(payout.totalAmount || 0) * 100);

            const isSimulated = payout.environment === "test" || payout.payoutMode === "Automatic Test";

            totals.total += cents;

            if(payout.status === "Paid"){
                if(isSimulated){
                    totals.simulatedPaid += cents;
                } else {
                    totals.paid += cents;
                    totals.paidBatches += 1;
                }
            } else if(payout.status === "Processing"){
                totals.processing += cents;
            } else if (payout.status === "Failed"){
                totals.failed += cents;
            } else {
                totals.pending += cents;
            }
        }

        return {
            total: totals.total / 100,
            paid: totals.paid / 100,
            simulatedPaid: totals.simulatedPaid / 100,
            pending: totals.pending / 100,
            processing: totals.processing / 100,
            failed: totals.failed / 100,
            paidBatches: totals.paidBatches
        }
    }, [payouts]);

    const usedOrderIds = useMemo(() => {
        return new Set(
            payouts.flatMap((payout) =>(payout.orders || []).map((order) => getId(order)))
        );
    }, [payouts]);

    const eligibleOrders = useMemo(() => {
        return orders.filter((order) => {
            return (
                order.orderStatus === "Delivered" && order.paymentStatus === "Paid" && order.deliveredAt && order.riderEarningCalculatedAt && Number(order.riderEarning) > 0 && getId(order.branchId) && getId(order.assignedRider) && !usedOrderIds.has(String(order._id))
            );
        });
    }, [orders, usedOrderIds]);

    const riders = useMemo(() => {
        const map = new Map();

        eligibleOrders.filter((order) => getId(order.branchId) === selectedBranch).forEach((order) => {
            const id = getId(order.assignedRider);
            if(!id){
                return;
            }

            map.set(id, {id, name: order.assignedRider?.name || `Rider ${id.slice(-6)}`});
        });

        return [...map.values()];
    }, [eligibleOrders, selectedBranch]);

    const availableOrders = useMemo(() => {
        return eligibleOrders.filter((order) => getId(order.branchId) === selectedBranch && getId(order.assignedRider) === selectedRider);
    }, [eligibleOrders, selectedBranch, selectedRider]);

    const selectedTotal = useMemo(() => {
        const cents = availableOrders.filter((order) => selectedOrders.includes(String(order._id))).reduce((sum, order) => sum + Math.round(Number(order.riderEarning) * 100), 0);

        return cents / 100;
    }, [availableOrders, selectedOrders]);

    const getProcessingTestTransaction = (payoutId) => {
        return testTransactions.find(
            (transaction) => getId(transaction.payoutId) === String(payoutId) && transaction.status === "Processing" && transaction.environment === "test" && transaction.provider === "mock"
        );
    };

    const getPayoutTransactionHistory = (payoutId) => {
        return testTransactions.filter((transaction) => getId(transaction.payoutId) === String(payoutId) && transaction.environment === "test" && transaction.provider === "mock").sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    };

    const openTransactionHistory = (payout) => {
        setSelectedHistoryPayout(payout); 
        setShowTransactionHistory(true);
    };

    const closeTransactionHistory = () => {
        setShowTransactionHistory(false);
        setSelectedHistoryPayout(null);
    };

    const filteredPayouts = useMemo(() => {
        return payouts.filter((payout) => {
            if(statusFilter !== "All" && payout.status !== statusFilter){
                return false;
            }

            const text = [payout._id, payout.branchId?.name, payout.riderId?.name, payout.riderId?.email].join(" ").toLowerCase();

            return text.includes(search.toLowerCase().trim());
        });
    }, [payouts, statusFilter, search]);

    const openCreate = () => {
        setSelectedBranch("");
        setSelectedRider("");
        setSelectedOrders([]);
        setCreateNotes("");
        setShowCreate(true);
    };

    const toggleOrder = (id) => {
        setSelectedOrders((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
    };

    const createPayout = async (event) => {
        event.preventDefault();

        if(!selectedBranch || !selectedRider || selectedOrders.length === 0){
            toast.error("Select a branch, rider and at least one order.");
            return;
        }

        try {
            setSubmitting(true);

            await request("/api/rider-payout/create", {
                method: "POST",
                body: JSON.stringify({
                    branchId: selectedBranch,
                    riderId: selectedRider,
                    orderIds: selectedOrders,
                    notes: createNotes
                })
            });

            toast.success("Rider payout created successfully.");
            setShowCreate(false);
            await loadData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const loadRiderBankDetails = async (riderId) => {
        setRiderBankDetails(null);
        setBankError("");
        setBankLoading(true);

        try {
            if(!riderId){
                throw new Error("Rider ID is missing.");
            }

            const data = await request(`/api/admin/riders/${riderId}/bank-details`);
            setRiderBankDetails(data.bankDetails || null);
        } catch (error) {
            setBankError(error.message || "Unable to load bank details.");
        } finally {
            setBankLoading(false);
        }
    };

    const openConfirm = (payout) => {
        setBankTransferVerified(false);
        setSelectedPayout(payout);
        setPaymentMethod("Bank Transfer");
        setPaymentReference("");
        setPaymentNotes("");
        setRiderBankDetails(null);
        setBankError("");
        setShowConfirm(true);
        const riderId = getId(payout.riderId);
        loadRiderBankDetails(riderId);
    };

    const confirmPayout = async (event) => {
        event.preventDefault();

        if(!selectedPayout || submitting){
            return;
        }

        // Bank Transfer Reference Validation
        if(paymentMethod === "Bank Transfer" && !paymentReference.trim()){
            toast.error("Bank transfer transaction reference is required.");
            return;
        }

        if(paymentMethod === "Bank Transfer"){
            if(bankLoading || bankError || !riderBankDetails?.hasAccountNumber){
                toast.error("Valid rider bank details are required.");
                return;
            }
        }

        setShowFinalConfirmation(true);
    };

    const finalizePayout = async () => {
        if(!selectedPayout || submitting || !bankTransferVerified){
            return;
        }

        try {
            setSubmitting(true);

            await request(
                `/api/rider-payout/${selectedPayout._id}/confirm`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        paymentMethod,
                        paymentReference,
                        notes: paymentNotes.trim() || selectedPayout.notes || ""
                    })
                }
            );

            toast.success("Rider payment recorded successfully.");

            setShowFinalConfirmation(false);
            setShowConfirm(false);
            setSelectedPayout(null);

            await loadData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const initiateMockTransfer = (payout) => {
        if(submitting || loading){
            return;
        }

        if(!canStartMockTransfer(payout)){
            toast.error("This payout is not eligible for a mock transfer.");
            return;
        }

        setSelectedMockPayout(payout);
        setShowMockConfirmation(true);
    }

    const closeMockConfirmation = () => {
        if(submitting){
            return;
        }

        setShowMockConfirmation(false);
        setSelectedMockPayout(null);
    };

    const confirmMockTransfer = async () => {
        if(!selectedMockPayout || submitting || loading){
            return;
        }

        if(!canStartMockTransfer(selectedMockPayout)){
            toast.error("This payout is not eligible for a mock transfer.");
            closeMockConfirmation();
            return;
        }

        const isRetry = selectedMockPayout.status === "Failed";

        try {
            setSubmitting(true);

            const data = await request(
                `/api/rider-payout/${selectedMockPayout._id}/test-transfer`,
                {
                    method: "POST"
                }
            );

            if(data.environment !== "test" || data.realMoneyTransferred !== false){
                throw new Error("Unexpected test transfer response.");
            }

            toast.success(isRetry ? "Mock transfer retry initiated — TEST ONLY." : "Mock transfer initiated — TEST ONLY.");

            setShowMockConfirmation(false);
            setSelectedMockPayout(null);

            await loadData();

        } catch (error) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const openTestCompletion = (payout, outcome) => {
        if(submitting || loading){
            return;
        }

        if(payout.status !== "Processing" || !isTestPayout(payout) || !["success", "failure"].includes(outcome)){
            toast.error("Invalid test payout completion request.");
            return;
        }

        const transaction = getProcessingTestTransaction(payout._id);

        if(!transaction?._id){
            toast.error("Processing mock transaction not found.");
            return;
        }

        setSelectedTestPayout(payout);
        setSelectedTestOutcome(outcome);
        setShowTestCompletion(true);
    }

    const closeTestCompletion = () => {
        if(submitting){
            return;
        }

        setShowTestCompletion(false);
        setSelectedTestPayout(null);
        setSelectedTestOutcome(null);
    }

    const completeTestTransfer = async () => {
        if(!selectedTestPayout || !["success", "failure"].includes(selectedTestOutcome) || submitting || loading){
            return;
        }

        const transaction = getProcessingTestTransaction(selectedTestPayout._id);

        if(!transaction?._id){
            toast.error("Processing mock transaction not found.");
            return;
        }

        try {
            setSubmitting(true);

            const data = await request(
                `/api/rider-payout/test-transactions/${transaction._id}/complete`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        outcome: selectedTestOutcome
                    })
                }
            );

            if(data.environment !== "test" || data.realMoneyTransferred !== false){
                throw new Error("Unexpected test completion response.");
            }

            toast.success(selectedTestOutcome === "success" ? "Mock transfer completed successfully — TEST ONLY." : "Mock transfer marked as failed — TEST ONLY.");

            setShowTestCompletion(false);
            setSelectedTestPayout(null);
            setSelectedTestOutcome(null);

            await loadData();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="rider-payouts-page">
            <div className="rp-header">
                <div>
                    <h1>Rider Payouts</h1>
                    <p>Manage rider earnings and payout records for QuickTaste branches.</p>
                </div>

                <div className="rp-header-actions">
                    
                    <button type="button" className="rp-btn rp-btn-outline rp-refresh-btn" onClick={handleRefresh} disabled={loading || refreshing || submitting} aria-label={refreshing ? "Refreshing rider payouts" : "Refresh rider payouts"} aria-busy={refreshing}>
                        <RefreshCw size={18} className={refreshing ? "rp-refresh-spinning" : ""}/>
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>

                    <button className="rp-btn rp-btn-primary" onClick={openCreate}>
                        <Plus size={18}/>
                        Create Payout
                    </button>

                </div>
            </div>

            <div className="rp-stats">

                <div className="rp-stat-card">
                    <Wallet size={25}/>
                    <span>Total Payouts</span>
                    <strong>{money(summary.total)}</strong>
                </div>

                <div className="rp-stat-card">
                    <CircleCheck size={25}/>
                    <span>Real Paid</span>
                    <strong>{money(summary.paid)}</strong>
                </div>

                <div className="rp-stat-card">
                    <Clock3 size={25}/>
                    <span>Pending Payouts</span>
                    <strong>{money(summary.pending)}</strong>
                </div>

                <div className="rp-stat-card">
                    <HandCoins size={25}/>
                    <span>Paid Batches</span>
                    <strong>{summary.paidBatches}</strong>
                </div>

                <div className="rp-stat-card rp-stat-test">
                    <Wallet size={25}/>
                    <span>Simulated Paid</span>
                    <strong>{money(summary.simulatedPaid)}</strong>
                </div>

                <div className="rp-stat-card rp-stat-processing">
                    <Clock3 size={25}/>
                    <span>Processing Payouts</span>
                    <strong>{money(summary.processing)}</strong>
                </div>

                <div className="rp-stat-card rp-stat-failed">
                    <AlertCircle size={25}/>
                    <span>Failed Payouts</span>
                    <strong>{money(summary.failed)}</strong>
                </div>

            </div>

            <div className="rp-table-card">
                <div className="rp-table-header">
                    <h2>Payout Records</h2>

                    <div className="rp-filters">
                        <div className="rp-search">
                            <Search size={17}/>
                            <input type="text" placeholder="Search payouts..." value={search} onChange={(event) => setSearch(event.target.value)}/>
                        </div>

                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="All">All Payouts</option>
                            <option value="Pending">Pending</option>
                            <option value="Processing">Processing</option>
                            <option value="Paid">Paid (Real & Test)</option>
                            <option value="Failed">Failed</option>
                        </select>
                    </div>
                </div>

                <div className="rp-table-scroll">
                    <table className="rp-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Branch</th>
                                <th>Rider</th>
                                <th>Orders</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="rp-empty">
                                        Loading payouts...
                                    </td>
                                </tr>
                            ) : filteredPayouts.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="rp-empty">
                                        No payout records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredPayouts.map((payout) => (
                                    <tr key={payout._id}>
                                        <td>
                                            {new Date(payout.createdAt).toLocaleDateString()}
                                        </td>

                                        <td>
                                            {payout.branchId?.name || "Unknown Branch"}
                                        </td>

                                        <td>
                                            {payout.riderId?.name || "Unknown Rider"}
                                        </td>

                                        <td>
                                            {payout.orders?.length || 0}
                                        </td>

                                        <td className="rp-amount">
                                            {money(payout.totalAmount)}
                                        </td>

                                        <td>
                                            <span className={`rp-status ${payout.status === "Paid" ? isTestPayout(payout) ? "rp-status-test" : "rp-status-paid" : payout.status === "Processing" ? "rp-status-processing" : payout.status === "Failed" ? "rp-status-failed" : "rp-status-pending"}`}>
                                                {payout.status === "Paid" && isTestPayout(payout)? "Simulated" : payout.status}
                                            </span>
                                        </td>

                                        <td>
                                            {isTestPayout(payout) ? "Mock Transfer" : payout.status === "Paid" ? (payout.paymentMethod || "Manual Payment") : "Unpaid"}
                                        </td>

                                        <td>
                                            {payout.status === "Pending" && !isTestPayout(payout) ? (

                                                <div className="rp-action-buttons">
                                                    
                                                    {/* Existing Manual Payment */}
                                                    <button type="button" className="rp-confirm-button" onClick={() => openConfirm(payout)} disabled={submitting || loading}>
                                                        Confirm Payment
                                                    </button>

                                                    {/* Mock Transfer - TEST ONLY */}
                                                    <button type="button" className="rp-mock-button" onClick={() => initiateMockTransfer(payout)} disabled={submitting || loading}>
                                                        Mock Transfer
                                                    </button>

                                                </div>

                                            ) : payout.status === "Processing" && isTestPayout(payout) ? (

                                                <div className="rp-action-buttons">
                                                    
                                                    {getProcessingTestTransaction(payout._id) ? (
                                                        <>
                                                            <button type="button" className="rp-confirm-button" disabled={submitting || loading} onClick={() => openTestCompletion(payout, "success")}>
                                                                Simulate Success
                                                            </button>

                                                            <button type="button" className="rp-mock-button" disabled={submitting || loading} onClick={() => openTestCompletion(payout, "failure")}>
                                                                Simulate Failure
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="rp-confirmed">
                                                            Transaction unavailable
                                                        </span>
                                                    )}

                                                </div>

                                            ) : payout.status === "Failed" && isTestPayout(payout) ? (

                                                <div className="rp-action-buttons">
                                                    <button type="button" className="rp-mock-button" onClick={() => initiateMockTransfer(payout)} disabled={submitting || loading}>
                                                        <RefreshCw size={15}/>
                                                        Retry Mock Transfer
                                                    </button>
                                                </div>

                                            ) : payout.status === "Paid" ? (

                                                <span className="rp-confirmed">
                                                    <CircleCheck size={16}/>
                                                    {isTestPayout(payout) ? "Simulated" : "Confirmed"}
                                                </span>

                                            ) : (

                                                <span className="rp-confirmed">
                                                    {isTestPayout(payout) ? `${payout.status} — TEST ONLY` : payout.status}
                                                </span>

                                            )}

                                            {/* View Mock Transaction History */}
                                            {isTestPayout(payout) && (
                                                <div className="rp-history-action">
                                                    <button type="button" className="rp-history-button" onClick={() => openTransactionHistory(payout)} disabled={loading}>
                                                        View History
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreate && (
                <div className="rp-modal-overlay">
                    <div className="rp-modal">
                        <div className="rp-modal-header">
                            <h2>Create Rider Payout</h2>
                            <button className="rp-close" onClick={() => setShowCreate(false)} disabled={submitting}>
                                <X size={22}/>
                            </button>
                        </div>

                        <form onSubmit={createPayout}>
                            <div className="rp-modal-body">
                                <p className="rp-info">
                                    Select delivered orders with calculated rider earnings. Orders already included in a payout cannot be selected.
                                </p>

                                <label>Branch</label>
                                <select required value={selectedBranch} onChange={(event) => {setSelectedBranch(event.target.value); setSelectedRider(""); setSelectedOrders([]);}}>
                                    <option value="">Select Branch</option>
                                    {branches.map((branch) => (
                                        <option key={branch._id} value={branch._id}>
                                            {branch.name || branch.branchName || "Unnamed Branch"}
                                        </option>
                                    ))}
                                </select>

                                <label>Rider</label>
                                <select required value={selectedRider} disabled={!selectedBranch} onChange={(event) => {setSelectedRider(event.target.value); setSelectedOrders([]);}}>
                                    <option value="">Select Rider</option>
                                    {riders.map((rider) => (
                                        <option key={rider.id} value={rider.id}>
                                            {rider.name}
                                        </option>
                                    ))}
                                </select>

                                <label>Eligible Orders</label>
                                <div className="rp-order-list">
                                    {availableOrders.length === 0 ? (
                                        <p className="rp-empty-orders">
                                            No eligible unpaid rider earnings found.
                                        </p>
                                    ) : (
                                        availableOrders.map((order) => (
                                            <label className="rp-order-item" key={order._id}>
                                                <input type="checkbox" checked={selectedOrders.includes(String(order._id))} onChange={() => toggleOrder(String(order._id))}/>
                                                <span>Order #{String(order._id).slice(-8)}</span>
                                                <strong>{money(order.riderEarning)}</strong>
                                            </label>
                                        ))
                                    )}
                                </div>

                                <p style={{ fontSize: "12px", color: "#777" }}>
                                    Debug: {availableOrders.length} available orders, {eligibleOrders.length} eligible orders, {orders.length} loaded orders
                                </p>

                                <label>Notes (Optional)</label>
                                <textarea rows={3} value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} placeholder="Enter payout notes (optional)" maxLength={1000}/>
                                
                                <div className="rp-total">
                                    <span>Selected Payout Amount</span>
                                    <strong>{money(selectedTotal)}</strong>
                                </div>
                            </div>

                            <div className="rp-modal-footer">
                                <button type="button" className="rp-btn rp-btn-outline" onClick={() => setShowCreate(false)} disabled={submitting}>
                                    Cancel
                                </button>

                                <button type="submit" className="rp-btn rp-btn-primary" disabled={submitting || selectedOrders.length === 0}>
                                    {submitting ? "Creating..." : "Create Payout"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showConfirm && selectedPayout && (
                <div className="rp-modal-overlay">
                    <div className="rp-modal">
                        <div className="rp-modal-header">
                            <h2>Confirm Rider Payment</h2>
                            <button className="rp-close" onClick={() => setShowConfirm(false)} disabled={submitting}>
                                <X size={22}/>
                            </button>
                        </div>

                        <form onSubmit={confirmPayout}>
                            <div className="rp-modal-body">
                                <div className="rp-warning">
                                    <AlertCircle size={20}/>
                                    Only confirm after the rider has actually received payment. This action records payment; it does not transfer money.
                                </div>

                                <div className="rp-payment-summary">

                                    <span>Rider</span>
                                    <strong>
                                        {selectedPayout.riderId?.name || "Unknown Rider"}
                                    </strong>

                                    <span>Amount</span>
                                    <strong>
                                        {money(selectedPayout.totalAmount)}
                                    </strong>

                                </div>

                                <div className="rp-bank-card">
                                    <h3>Rider Bank Details</h3>

                                    {bankLoading ? (
                                        <p>Loading bank details...</p>
                                    ) : bankError ? (
                                        <p className="rp-bank-error">{bankError}</p>
                                    ) : riderBankDetails ? (
                                        <div className="rp-bank-grid">
                                            <span>Bank Name</span>
                                            <strong>{riderBankDetails.bankName || "Not provided"}</strong>

                                            <span>Account Holder</span>
                                            <strong>
                                                {riderBankDetails.accountHolderName || "Not provided"}
                                            </strong>

                                            <span>Branch</span>
                                            <strong>
                                                {riderBankDetails.branchName || "Not provided"}
                                            </strong>

                                            <span>Account Number</span>
                                            <strong>
                                                {riderBankDetails.maskedAccountNumber || "Not provided"}
                                            </strong>
                                        </div>
                                    ) : (
                                        <p>No bank details available for this rider.</p>
                                    )}
                                </div>

                                <label>Payment Method</label>
                                <select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Other">Other</option>
                                </select>

                                <label>Payment Reference {paymentMethod === "Bank Transfer" && " *"}</label>
                                <input type="text" required={paymentMethod === "Bank Transfer"} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={200} placeholder={paymentMethod === "Bank Transfer" ? "Enter bank transaction reference" : "Transaction or receipt reference (optional)"}/>

                                <label>Notes (Optional)</label>
                                <textarea rows={3} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Enter payment notes (optional)" maxLength={1000}/>
                            </div>

                            <div className="rp-modal-footer">
                                <button type="button" className="rp-btn rp-btn-outline" onClick={() => setShowConfirm(false)} disabled={submitting}>
                                    Cancel
                                </button>

                                <button type="submit" className="rp-btn rp-btn-primary" disabled={submitting}>
                                    {submitting ? "Confirming..." : "Confirm Payment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showFinalConfirmation && selectedPayout && (
                <div className="rp-modal-overlay">
                    <div className="rp-final-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="rp-final-title" aria-describedby="rp-final-description">
                        <div className="rp-final-icon">
                            <AlertCircle size={30}/>
                        </div>

                        <h2 id="rp-final-title">Confirm Rider Payment</h2>

                        <p id="rp-final-description" className="rp-final-description">
                            Are you sure you want to mark this rider payout as
                            <strong> Paid</strong>?
                        </p>

                        <div className="rp-final-details">

                            <div>
                                <span>Rider</span>
                                <strong>
                                    {selectedPayout.riderId?.name || "Unknown Rider"}
                                </strong>
                            </div>

                            <div>
                                <span>Payment Amount</span>
                                <strong>{money(selectedPayout.totalAmount)}</strong>
                            </div>

                            <div>
                                <span>Payment Method</span>
                                <strong>{paymentMethod}</strong>
                            </div>

                        </div>

                        <div className="rp-final-warning">
                            <AlertCircle size={18}/>
                            <span>
                                Please confirm that the rider has already received the payment. This action only records the payment and does not transfer money.
                            </span>
                        </div>

                        {/* Add checkbox here */}
                        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "18px", fontSize: "13px", lineHeight: "1.6", cursor: "pointer" }}>
                            <input type="checkbox" checked={bankTransferVerified} onChange={(event) => setBankTransferVerified(event.target.checked)} style={{ marginTop: "4px" }}/>
                            <span>
                                I confirm that the payment has actually been completed and independently verified.
                                I understand that marking this payout as Paid does not initiate a bank transfer.
                            </span>
                        </label>

                        <div className="rp-final-actions">
                            <button type="button" className="rp-btn rp-btn-outline" onClick={() => setShowFinalConfirmation(false)} disabled={submitting}>
                                Cancel
                            </button>

                            {/* Confirm Payment Button */}
                            <button type="button" className="rp-btn rp-btn-primary" onClick={finalizePayout} disabled={submitting || !bankTransferVerified}>
                                {submitting ? "Processing..." : "Yes, Mark as Paid"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mock Transfer Confirmation Modal */}
            {showMockConfirmation && selectedMockPayout && (
                <div className="rp-modal-overlay">
                    <div className="rp-mock-modal" role="alertdialog" aria-modal="true" aria-labelledby="rp-mock-title" aria-describedby="rp-mock-description">
                        <div className="rp-mock-modal-icon">
                            <Wallet size={28}/>
                        </div>

                        <h2 id="rp-mock-title">
                            {selectedMockPayout.status === "Failed" ? "Confirm Mock Transfer Retry" : "Confirm Mock Transfer"}
                        </h2>

                        <p id="rp-mock-description" className="rp-mock-modal-description">
                            TEST MODE ONLY — No real money will be transferred.
                        </p>

                        <div className="rp-mock-modal-details">
                            <div>
                                <span>Rider</span>
                                <strong>
                                    {selectedMockPayout.riderId?.name || "Unknown Rider"}
                                </strong>
                            </div>

                            <div>
                                <span>Branch</span>
                                <strong>
                                    {selectedMockPayout.branchId?.name || "Unknown Branch"}
                                </strong>
                            </div>

                            <div>
                                <span>Transfer Amount</span>
                                <strong>
                                    {money(selectedMockPayout.totalAmount)}
                                </strong>
                            </div>
                        </div>

                        <div className="rp-mock-modal-warning">
                            <AlertCircle size={19}/>
                            <span>
                                {selectedMockPayout.status === "Failed" ? "This action retries the failed mock transfer using a new test transaction. The previous failed attempt remains in transaction history. No real money will be transferred." : "This action starts a simulated bank transfer. It will update the payout status to Processing. No actual bank transaction will occur."}
                            </span>
                        </div>

                        <div className="rp-mock-modal-actions">
                            <button type="button" className="rp-btn rp-btn-outline" onClick={closeMockConfirmation} disabled={submitting}>
                                Cancel
                            </button>

                            <button type="button" className="rp-btn rp-btn-primary" onClick={confirmMockTransfer} disabled={submitting}>
                                {submitting ? "Processing..." : selectedMockPayout.status === "Failed" ? "Retry Mock Transfer" : "Start Mock Transfer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Transfer Completion Confirmation Modal */}
            {showTestCompletion && selectedTestPayout && (
                <div className="rp-modal-overlay">
                    <div className="rp-mock-modal" role="alertdialog" aria-modal="true" aria-labelledby="rp-test-completion-title" aria-describedby="rp-test-completion-description">

                        <div className="rp-mock-modal-icon">
                            <Wallet size={28}/>
                        </div>

                        <h2 id="rp-test-completion-title">
                            {selectedTestOutcome === "success" ? "Simulate Successful Transfer" : "Simulate Failed Transfer"}
                        </h2>

                        <p id="rp-test-completion-description" className="rp-mock-modal-description">
                            TEST MODE ONLY — No real money will be transferred.
                        </p>

                        <div className="rp-mock-modal-details">
                            <div>
                                <span>Rider</span>
                                <strong>
                                    {selectedTestPayout.riderId?.name || "Unknown Rider"}
                                </strong>
                            </div>

                            <div>
                                <span>Amount</span>
                                <strong>
                                    {money(selectedTestPayout.totalAmount)}
                                </strong>
                            </div>

                            <div>
                                <span>Simulated Result</span>
                                <strong>
                                    {selectedTestOutcome === "success" ? "Succeeded" : "Failed"}
                                </strong>
                            </div>
                        </div>

                        <div className="rp-mock-modal-warning">
                            <AlertCircle size={19}/>
                            <span>
                                This action updates the mock transaction and payout status for testing purposes only. It does not transfer real money.
                            </span>
                        </div>

                        <div className="rp-mock-modal-actions">

                            <button type="button" className="rp-btn rp-btn-outline" onClick={closeTestCompletion} disabled={submitting}>
                                Cancel
                            </button>

                            <button type="button" className="rp-btn rp-btn-primary" onClick={completeTestTransfer} disabled={submitting}>
                                {submitting ? "Processing..." : selectedTestOutcome === "success" ? "Confirm Simulated Success" : "Confirm Simulated Failure"}
                            </button>

                        </div>

                    </div>
                </div>
            )}

            {/* Mock Transaction History Modal */}
            {showTransactionHistory && selectedHistoryPayout && (
                <div className="rp-modal-overlay">
                    <div className="rp-modal" role="dialog" aria-modal="true" aria-labelledby="rp-history-title">
                        <div className="rp-modal-header">
                            <h2 id="rp-history-title">
                                Transaction History
                            </h2>

                            <button type="button" className="rp-close" onClick={closeTransactionHistory} aria-label="Close transaction history">
                                <X size={22}/>
                            </button>
                        </div>

                        <div className="rp-modal-body">
                            
                            <p className="rp-info">
                                Simulated transactions only. No real money was transferred.
                            </p>

                            <div className="rp-payment-summary">
                                <span>Rider</span>
                                <strong>
                                    {selectedHistoryPayout.riderId?.name || "Unknown Rider"}
                                </strong>

                                <span>Payout Amount</span>
                                <strong>
                                    {money(selectedHistoryPayout.totalAmount)}
                                </strong>
                            </div>

                            {getPayoutTransactionHistory(selectedHistoryPayout._id).length === 0 ? (
                                <p className="rp-empty-orders">
                                    No mock transactions found.
                                </p>
                            ) : (
                                getPayoutTransactionHistory(selectedHistoryPayout._id).map((transaction, index) => (
                                    <div className="rp-bank-card rp-history-card" key={transaction._id}>
                                        
                                        <div className="rp-history-status-header">

                                            <h3>
                                                Attempt {index + 1}
                                            </h3>

                                            <span className={`rp-history-status ${transaction.status === "Succeeded" ? "rp-history-success" : transaction.status === "Failed" ? "rp-history-failed" : transaction.status === "Processing" ? "rp-history-processing" : "rp-history-pending"}`}>
                                                {transaction.status === "Succeeded" ? (
                                                    <CircleCheck size={15}/>
                                                ) : transaction.status === "Failed" ? (
                                                    <AlertCircle size={15} />
                                                ) : transaction.status === "Processing" ? (
                                                    <Clock3 size={15}/>
                                                ) : (
                                                    <Clock3 size={15}/>
                                                )}

                                                {transaction.status}
                                            </span>
                                        </div>

                                        <div className="rp-bank-grid">
                                                <span>Amount</span>
                                                <strong>
                                                    {money(transaction.amount)}
                                                </strong>

                                                <span>Reference</span>
                                                <strong>
                                                    {transaction.providerReference || "Pending"}
                                                </strong>

                                                <span>Initiated</span>
                                                <strong>
                                                    {transaction.initiatedAt ? new Date(transaction.initiatedAt).toLocaleString() : "N/A"}
                                                </strong>

                                                <span>Completed</span>
                                                <strong>
                                                    {transaction.completedAt ? new Date(transaction.completedAt).toLocaleString() : "Not completed"}
                                                </strong>

                                                {transaction.failureReason && (
                                                    <>
                                                        <span>Failure Reason</span>
                                                        <strong>
                                                            {transaction.failureReason}
                                                        </strong>
                                                    </>
                                                )}
                                        </div>
                                    </div>
                                ))
                            )}

                        </div>

                        <div className="rp-modal-footer">
                            <button type="button" className="rp-btn rp-btn-outline" onClick={closeTransactionHistory}>
                                Close
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default RiderPayouts;