import React, { useCallback, useEffect, useMemo, useState } from "react";
import {Store, Search, Plus, Pencil, Power, RefreshCw, MapPin, X, Save, AlertCircle, CheckCircle2, Clock3, Ban, Trash2} from "lucide-react";
import { toast } from "react-toastify";
import "./Branches.css";

const API_URL = "http://localhost:4911/api/branch";
const PROVINCES = ["Western", "Central", "Southern", "Northern", "Eastern", "North Western", "North Central", "Uva", "Sabaragamuwa"];
const STATUSES = ["Planned", "Operational", "Temporarily Closed"];
const emptyForm = {name: "", code: "", province: "Western", city: "", address: "", phone: "", email: "", latitude: "", longitude: "", deliveryRadiusKm: "10", status: "Planned", isActive: false};

const getAdminToken = () => {
    return localStorage.getItem("adminToken");
}

const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAdminToken()}`
});

const readResponse = async (response) => {
    const data = await response.json().catch(() => ({}));

    if(!response.ok || data.success === false) {
        throw new Error(data.message || "Request failed.");
    }
    
    return data;
};

const Branches = () => {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingBranchId, setDeletingBranchId] = useState(null);

    const [search, setSearch] = useState("");
    const [provinceFilter, setProvinceFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    const [showModal, setShowModal] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const fetchBranches = useCallback(async (options = {}) => {
        const { manual = false } = options;

        try {
            // Manual Refresh - keep existing table visible
            if(manual){
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await fetch(`${API_URL}/list`, {
                headers: {
                    Authorization: `Bearer ${getAdminToken()}`
                },
                cache: "no-store"
            });

            const data = await readResponse(response);

            setBranches(
                Array.isArray(data.branches) ? data.branches : []
            );


            if(manual){
                toast.success("Branches refreshed successfully!", { autoClose: 1800 });
            }

            return true;

        } catch (error) {
            console.error("Fetch Branches Error:", error);
            toast.error(error.message || "Failed to load branches.");
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
        fetchBranches();
    }, [fetchBranches]);

    // Refresh branches without hiding existing data
    const handleRefresh = async () => {
        
        if(loading || refreshing){
            return;
        }

        await fetchBranches({ manual: true });

    };

    const stats = useMemo(() => {
        return {
            total: branches.length,
            operational: branches.filter((branch) => branch.status === "Operational").length,
            planned: branches.filter((branch) => branch.status === "Planned").length,
            closed: branches.filter((branch) => branch.status === "Temporarily Closed").length,
            active: branches.filter((branch) => branch.isActive === true).length
        };
    }, [branches]);

    const filteredBranches = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return branches
        .filter((branch) => {
            const matchesSearch = !keyword || [branch.name, branch.code, branch.city, branch.province, branch.address].some((value) => String(value || "").toLowerCase().includes(keyword));
            const matchesProvince = provinceFilter === "All" || branch.province === provinceFilter;
            const matchesStatus = statusFilter === "All" || branch.status === statusFilter;

            return matchesSearch && matchesProvince && matchesStatus;
        }).sort((a, b) => (a.name || "").localeCompare(b.name || "", "en", {sensitivity: "base"}));
    }, [branches, search, provinceFilter, statusFilter]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        setForm((previous) => ({
            ...previous,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const openCreateModal = () => {
        setEditingBranch(null);
        setForm({ ...emptyForm });
        setShowModal(true);
    };

    const openEditModal = (branch) => {
        setEditingBranch(branch);

        setForm({
            name: branch.name || "",
            code: branch.code || "",
            province: branch.province || "Western",
            city: branch.city || "",
            address: branch.address || "",
            phone: branch.phone || "",
            email: branch.email || "",
            latitude: branch.location?.latitude ?? "",
            longitude: branch.location?.longitude ?? "",
            deliveryRadiusKm: String(branch.deliveryRadiusKm ?? 10),
            status: branch.status || "Planned",
            isActive: Boolean(branch.isActive)
        });

        setShowModal(true);
    };

    const closeModal = () => {
        if(saving){
            return;
        }

        setShowModal(false);
        setEditingBranch(null);
        setForm({ ...emptyForm });
    };

    const handleSave = async (event) => {
        event.preventDefault();

        if(saving){
            return;
        }

        const name = form.name.trim();
        const code = form.code.trim().toUpperCase();
        const city = form.city.trim();
        const address = form.address.trim();

        if(!name || !city || (!editingBranch && !code)){
            toast.error("Please complete the required fields.");
            return;
        }

        const hasLatitude = String(form.latitude).trim() !== "";
        const hasLongitude = String(form.longitude).trim() !== "";

        if(hasLatitude !== hasLongitude){
            toast.error("Please provide both latitude and longitude.");
            return;
        }

        const latitude = hasLatitude ? Number(form.latitude) : null;
        const longitude = hasLongitude ? Number(form.longitude) : null;
        const deliveryRadiusKm = Number(form.deliveryRadiusKm);
        
        if((hasLatitude && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (hasLongitude && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))){
            toast.error("Please enter valid GPS coordinates.");
            return;
        }

        if(!Number.isFinite(deliveryRadiusKm) || deliveryRadiusKm < 0){
            toast.error("Please enter a valid delivery radius.");
            return;
        }

        if(form.isActive && (form.status !== "Operational" || !address || !hasLatitude || !hasLongitude)){
            toast.error("An active branch must be Operational and have an address and GPS coordinates.");
            return;
        }

        const payload = {
            name,
            province: form.province,
            city,
            address,
            phone: form.phone.trim(),
            email: form.email.trim(),
            location: {
                latitude,
                longitude
            },
            deliveryRadiusKm,
            status: form.status,
            isActive: Boolean(form.isActive)
        };

        if(!editingBranch){
            payload.code = code;
        }

        try {
            setSaving(true);

            const endpoint = editingBranch ? `${API_URL}/${editingBranch._id}` : `${API_URL}/create`;

            const response = await fetch(endpoint, {
                method: editingBranch ? "PUT" : "POST",
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            await readResponse(response);

            toast.success(editingBranch ? "Branch updated successfully." : "Branch created successfully.");

            setShowModal(false);
            setEditingBranch(null);
            setForm({ ...emptyForm });

            await fetchBranches();
        } catch (error) {
            toast.error(error.message || "Failed to save branch.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (branch) => {
        if(!branch.isActive && branch.status === "Temporarily Closed"){
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to deactivate ${branch.name}?`);

        if(!confirmed){
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/${branch._id}/deactivate`,
                {
                    method: "PUT",
                    headers: getHeaders()
                }
            );

            await readResponse(response);

            toast.success("Branch deactivated successfully.");
            await fetchBranches();
        } catch (error) {
            toast.error(error.message || "Failed to deactivate branch.");
        }
    };

    const handleDelete = async (branch) => {
        if(deletingBranchId){
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to permanently delete "${branch.name}"?\n\nThis action cannot be undone.`);

        if(!confirmed){
            return;
        }

        try {
            setDeletingBranchId(branch._id);

            const response = await fetch(
                `${API_URL}/${branch._id}`,
                {
                    method: "DELETE",
                    headers: getHeaders()
                }
            );

            await readResponse(response);

            toast.success("Branch deleted successfully.");

            await fetchBranches();
        } catch (error) {
            toast.error(error.message || "Failed to delete branch.");
        } finally {
            setDeletingBranchId(null);
        }
    }

    return (
        <div className="branches-page">
            
            <div className="branches-header">
                <div>
                    <div className="branches-heading">
                        <Store size={28}/>
                        <h2>Branch Management</h2>
                    </div>

                    <p>
                        Manage QuickTaste branches across Sri Lanka.
                    </p>
                </div>

                <div className="branches-header-actions">
                    <button type="button" className="branches-refresh-btn" onClick={handleRefresh} disabled={loading || refreshing} aria-label={refreshing ? "Refreshing branches" : "Refresh branches"}>
                        <RefreshCw size={17} className={refreshing ? "branches-refresh-spinning" : ""}/>
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </button>

                    <button type="button" className="branches-add-btn" onClick={openCreateModal}>
                        <Plus size={18}/>
                        Add Branch
                    </button>
                </div>
            </div>

            <div className="branches-stats">
                
                <div className="branches-stat-card">
                    <div className="branches-stat-top">
                        <span>Total Branches</span>
                        <Store size={21}/>
                    </div>
                    <h3>{stats.total}</h3>
                    <p>Registered locations</p>
                </div>

                <div className="branches-stat-card">
                    <div className="branches-stat-top">
                        <span>Operational</span>
                        <CheckCircle2 size={21}/>
                    </div>
                    <h3>{stats.operational}</h3>
                    <p>{stats.active} currently active</p>
                </div>

                <div className="branches-stat-card">
                    <div className="branches-stat-top">
                        <span>Planned</span>
                        <Clock3 size={21}/>
                    </div>
                    <h3>{stats.planned}</h3>
                    <p>Upcoming branches</p>
                </div>

                <div className="branches-stat-card">
                    <div className="branches-stat-top">
                        <span>Temporarily Closed</span>
                        <Ban size={21}/>
                    </div>
                    <h3>{stats.closed}</h3>
                    <p>Unavailable locations</p>
                </div>

            </div>

            <div className="branches-content">
                
                <div className="branches-content-header">
                    <div>
                        <h3>All Branches</h3>
                        <p>Showing {filteredBranches.length} of {branches.length} branches</p>
                    </div>
                </div>

                <div className="branches-filters">
                    
                    <div className="branches-search">
                        <Search size={18}/>
                        <input type="text" placeholder="Search branches..." value={search} onChange={(event) => setSearch(event.target.value)}/>
                    </div>

                    <select value={provinceFilter} onChange={(event) => setProvinceFilter(event.target.value)}> 
                        <option value="All">All Provinces</option>
                        {PROVINCES.map((province) => (
                            <option key={province} value={province}>
                                {province}
                            </option>
                        ))}
                    </select>

                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="All">All Statuses</option>
                        {STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>

                </div>

                <div className="branches-table-wrapper">
                    <table className="branches-table">
                        <thead>
                            <tr>
                                <th>Branch</th>
                                <th>Code</th>
                                <th>Province</th>
                                <th>City</th>
                                <th>Status</th>
                                <th>Availability</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="branches-empty">
                                        Loading branches...
                                    </td>
                                </tr>
                            ) : filteredBranches.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="branches-empty">
                                        <AlertCircle size={24}/>
                                        <span>No branches found.</span>
                                    </td>
                                </tr>
                            ) : (
                                filteredBranches.map((branch) => (
                                    <tr key={branch._id}>
                                        
                                        <td>
                                            <div className="branches-name-cell">
                                                <div className="branches-name-icon">
                                                    <Store size={18}/>
                                                </div>

                                                <div>
                                                    <strong>{branch.name}</strong>
                                                    <small>
                                                        <MapPin size={12}/>
                                                        {branch.address || "Address not configured"}
                                                    </small>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="branches-code">
                                            {branch.code}
                                        </td>

                                        <td>{branch.province}</td>

                                        <td>{branch.city}</td>

                                        <td>
                                            <span className={`branches-status ${branch.status === "Operational" ? "operational" : branch.status === "Planned" ? "planned" : "closed"}`}>
                                                {branch.status}
                                            </span>
                                        </td>

                                        <td>
                                            <span className={`branches-availability ${branch.isActive ? "active" : "inactive"}`}>
                                                <span className="branches-dot"/>
                                                {branch.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="branches-actions">

                                                <button type="button" className="branches-edit-btn" title="Edit Branch" onClick={() => openEditModal(branch)} disabled={Boolean(deletingBranchId)}>
                                                    <Pencil size={16}/>
                                                </button>

                                                <button type="button" className="branches-deactivate-btn" title="Deactivate Branch" disabled={Boolean(deletingBranchId) || (!branch.isActive && branch.status === "Temporarily Closed")} onClick={() => handleDeactivate(branch)}>
                                                    <Power size={16}/>
                                                </button>

                                                <button type="button" className="branches-delete-btn" title="Delete Branch" disabled={Boolean(deletingBranchId)} onClick={() => handleDelete(branch)}>
                                                    <Trash2 size={16}/>
                                                </button>

                                            </div>
                                        </td>

                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </div>

            {showModal && (
                <div className="branches-modal-overlay" onClick={closeModal}>
                    <div className="branches-modal" onClick={(event) => event.stopPropagation()}>
                        
                        <div className="branches-modal-header">
                            <div>
                                <h3>
                                    {editingBranch ? "Edit Branch" : "Add New Branch"}
                                </h3>
                                <p>
                                    Configure branch information and availability.
                                </p>
                            </div>

                            <button type="button" onClick={closeModal} disabled={saving}>
                                <X size={21}/>
                            </button>
                        </div>

                        <form onSubmit={handleSave}>
                            
                            <div className="branches-modal-body">
                                
                                <div className="branches-form-grid">
                                    
                                    <div className="branches-form-group">
                                        <label>Branch Name *</label>
                                        <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="QuickTaste Colombo" required/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Branch Code *</label>
                                        <input type="text" name="code" value={form.code} onChange={handleChange} placeholder="QT-COLOMBO-001" disabled={Boolean(editingBranch)} required/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Province *</label>
                                        <select name="province" value={form.province} onChange={handleChange} required>
                                            {PROVINCES.map((province) => (<option key={province} value={province}>{province}</option>))}
                                        </select>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>City *</label>
                                        <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="Colombo" required/>
                                    </div>

                                    <div className="branches-form-group branches-full">
                                        <label>Branch Address</label>
                                        <textarea name="address" value={form.address} onChange={handleChange} rows="3" placeholder="Enter the actual branch address"/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Phone Number</label>
                                        <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+94..."/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Email Address</label>
                                        <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="branch@example.com"/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Latitude</label>
                                        <input type="number" name="latitude" value={form.latitude} onChange={handleChange} placeholder="Latitude" min="-90" max="90" step="any"/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Longitude</label>
                                        <input type="number" name="longitude" value={form.longitude} onChange={handleChange} placeholder="Longitude" min="-180" max="180" step="any"/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Delivery Radius (km)</label>
                                        <input type="number" name="deliveryRadiusKm" value={form.deliveryRadiusKm} onChange={handleChange} min="0" step="0.1" required/>
                                    </div>

                                    <div className="branches-form-group">
                                        <label>Branch Status</label>
                                        <select name="status" value={form.status} onChange={(event) => {const status = event.target.value; setForm((previous) => ({...previous, status, isActive: status === "Operational" ? previous.isActive : false}));}}>{STATUSES.map((status) => (<option key={status} value={status}>{status}</option>))}</select>
                                    </div>

                                    <div className="branches-form-group branches-full">
                                        <label className="branches-checkbox">
                                            <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} disabled={form.status !== "Operational"}/>
                                        </label>

                                        <small className="branches-form-hint">
                                            Activation requires Operational status, a real address, and valid GPS coordinates.
                                        </small>
                                    </div>

                                </div>

                            </div>

                            <div className="branches-modal-footer">

                                <button type="button" className="branches-cancel-btn" onClick={closeModal} disabled={saving}>
                                    Cancel
                                </button>

                                <button type="submit" className="branches-save-btn" disabled={saving}>
                                    <Save size={17}/>
                                    {saving ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
                                </button>

                            </div>

                        </form>

                    </div>
                </div>
            )}

        </div>
    );
};

export default Branches;