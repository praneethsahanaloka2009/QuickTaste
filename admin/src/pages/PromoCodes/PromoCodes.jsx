import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { API_URL } from "../../config/api";
import './PromoCodes.css'

const initialFormData = {
    code: "",
    discountType: "percentage",
    discountValue: "",
    discountType2: "",
    discountValue2: "",
    minOrderAmount: "",
    maxDiscountAmount: "",
    maxDiscountAmount2: "",
    expiryDate: "",
    usageLimit: "",
    offerText: "",
    showOnOfferBar: false,
    isActive: true
}

const PromoCodes = () => {
    const getAdminHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`
    });

    const [promos, setPromos] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPromo, setEditingPromo] = useState(null)
    const [deletingPromo, setDeletingPromo] = useState(null)
    const [formData, setFormData] = useState({ ...initialFormData })

    const fetchPromos = async () => {
        try{
            const response = await fetch(`${API_URL}/api/promo/list`, {
                headers: getAdminHeaders()
            });

            const data = await response.json()

            if(data.success){
                setPromos(data.promos)
            }else{
                toast.error(data.message || "Failed to load promo codes")
            }
        }catch (error){
            console.log(error)
            toast.error("Failed to load promo codes")
        }finally{
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPromos()
    }, [])

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target

        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }))
    }

    const resetForm = () => {
        setFormData({ ...initialFormData })
        setEditingPromo(null)
        setShowForm(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if(formData.discountType2 && formData.discountValue2 === ""){
            toast.error("Please enter the second discount value")
            return
        }

        if(!formData.discountType2 && formData.discountValue2 !== ""){
            toast.error("Please select the second discount type")
            return
        }

        if (formData.discountType === "percentage" && Number(formData.discountValue) > 100){
            toast.error("Percentage discount cannot exceed 100%")
            return
        }

        if(formData.discountType2 === "percentage" && Number(formData.discountValue2) > 100){
            toast.error("Second percentage discount cannot exceed 100%")
            return
        }

        try {
            const url = editingPromo ? `${API_URL}/api/promo/${editingPromo._id}` : `${API_URL}/api/promo/create`;

            const method = editingPromo ? "PUT" : "POST"

            const payload = {
                code: formData.code.trim().toUpperCase(),
                discountType: formData.discountType,
                discountValue: Number(formData.discountValue),

                discountType2: formData.discountType2 || null,
                discountValue2: formData.discountType2 ? Number(formData.discountValue2) : null,

                minOrderAmount: formData.minOrderAmount === "" ? 0 : Number(formData.minOrderAmount),

                maxDiscountAmount: formData.maxDiscountAmount === "" ? null : Number(formData.maxDiscountAmount),
                maxDiscountAmount2: formData.maxDiscountAmount2 === "" ? null : Number(formData.maxDiscountAmount2),

                expiryDate: formData.expiryDate,

                usageLimit: formData.usageLimit === "" ? null : Number(formData.usageLimit),

                offerText: formData.offerText,
                showOnOfferBar: formData.showOnOfferBar,
                isActive: formData.isActive
            }

            const response = await fetch(url, {
                method,
                headers: getAdminHeaders(),
                body: JSON.stringify(payload)
            })

            const data = await response.json()

            if(data.success){
                toast.success(data.message || "Promo code saved")
                resetForm()
                await fetchPromos()
            }else{
                toast.error(data.message || "Failed to save promo code")
            }
        } catch (error) {
            console.log(error)
            toast.error("Something went wrong")
        }
    }

    const formatDateTimeLocal = (date) => {
        if (!date) return ""

        const d = new Date(date)
        const offset = d.getTimezoneOffset()

        return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16)
    }

    const handleEdit = (promo) => {
        setEditingPromo(promo)

        setFormData({
            code: promo.code || "",
            discountType: promo.discountType || "percentage",
            discountValue: promo.discountValue ?? "",

            discountType2: promo.discountType2 || "",
            discountValue2: promo.discountValue2 ?? "",

            minOrderAmount: promo.minOrderAmount ?? "",
            maxDiscountAmount: promo.maxDiscountAmount ?? "",
            maxDiscountAmount2: promo.maxDiscountAmount2 ?? "",

            expiryDate: formatDateTimeLocal(promo.expiryDate),
            usageLimit: promo.usageLimit ?? "",
            offerText: promo.offerText || "",
            showOnOfferBar: promo.showOnOfferBar ?? false,
            isActive: promo.isActive ?? true
        })

        setShowForm(true)
    }

    const handleDeleteClick = (promo) => {
        setDeletingPromo(promo)
    }

    const handleDelete = async () => {
        if(!deletingPromo){
            return
        }

        try {
            const response = await fetch(
                `${API_URL}/api/promo/${deletingPromo._id}`,
                {
                    method: "DELETE",
                    headers: getAdminHeaders()
                }
            );

            const data = await response.json()

            if(data.success) {
                toast.success(data.message)
                setDeletingPromo(null)
                await fetchPromos()
            } else {
                toast.error(data.message || "Failed to delete promo")
            }
        } catch (error) {
            console.log(error)
            toast.error("Something went wrong")
        }
    }

    const discountLabel = (type, value) => {
        if (!type) return ""
        if (type === "freeDelivery") return "Free Delivery"
        if (type === "percentage") return `${value}% OFF`

        return `$${Number(value).toFixed(2)} OFF`
    }

    const openAddForm = () => {
        setEditingPromo(null)
        setFormData({ ...initialFormData })
        setShowForm(true)
    }

    return (
        <div className="promo-codes-page">

            <div className="promo-codes-header">
                <div>
                    <h2>Promo Codes</h2>
                    <p>Manage discount codes for customers</p>
                </div>

                <button className="add-promo-btn" onClick={openAddForm}>
                    + Add Promo Code
                </button>
            </div>

            <div className="promo-codes-content">
                {loading ? (
                    <p className="promo-loading">Loading promo codes...</p>
                ) : promos.length === 0 ? (
                    <div className="no-promos">
                        <h3>No Promo Codes</h3>
                        <p>Create your first promo code to offer discounts to customers.</p>
                    </div>
                ) : (
                    <div className="promo-table-wrapper">
                        <table className="promo-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Discount Offers</th>
                                    <th>Min. Order</th>
                                    <th>Expiry</th>
                                    <th>Usage</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {promos.map(promo => (
                                    <tr key={promo._id}>
                                        <td><strong>{promo.code}</strong></td>

                                        <td>
                                            <div>
                                                {discountLabel(
                                                    promo.discountType,
                                                    promo.discountValue
                                                )}
                                            </div>

                                            {promo.discountType2 && (
                                                <div>
                                                    {discountLabel(
                                                        promo.discountType2,
                                                        promo.discountValue2
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        <td>
                                            ${Number(promo.minOrderAmount || 0).toFixed(2)}
                                        </td>

                                        <td>
                                            {new Date(promo.expiryDate).toLocaleDateString()}
                                        </td>

                                        <td>
                                            {promo.usedCount} / {promo.usageLimit ?? "∞"}
                                        </td>

                                        <td>
                                            <span className={
                                                promo.isActive
                                                    ? "promo-active"
                                                    : "promo-inactive"
                                            }>
                                                {promo.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="promo-actions">
                                                <button
                                                    className="edit-promo-btn"
                                                    onClick={() => handleEdit(promo)}
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    className="delete-promo-btn"
                                                    onClick={() => handleDeleteClick(promo)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="promo-modal-overlay">
                    <div className="promo-modal">
                        <div className="promo-modal-header">
                            <div>
                                <h3>{editingPromo ? "Edit Promo Code" : "Add Promo Code"}</h3>
                                <p>
                                    {editingPromo
                                        ? "Update discount code details"
                                        : "Create a promo code with one or two discount offers"}
                                </p>
                            </div>

                            <button type="button" className="promo-close-btn" onClick={resetForm}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="promo-form-group">
                                <label>Promo Code</label>
                                <input type="text" name="code"value={formData.code} onChange={handleChange} placeholder="Example: QUICKTASTE" required/>
                            </div>

                            <h4>Offer 1 (Required)</h4>

                            <div className="promo-form-row">
                                <div className="promo-form-group">
                                    <label>Discount Type 1</label>
                                    <select name="discountType"value={formData.discountType} onChange={handleChange} required>
                                        <option value="percentage">Percentage</option>
                                        <option value="fixed">Fixed Amount</option>
                                        <option value="freeDelivery">Free Delivery</option>
                                    </select>
                                </div>

                                <div className="promo-form-group">
                                    <label>Discount Value 1</label>
                                    <input type="number" name="discountValue" value={formData.discountValue} onChange={handleChange} placeholder="e.g. 5 or 10" min="0" max={formData.discountType === "percentage" ? "100" : undefined} step="0.01" required/>
                                </div>
                            </div>

                            <div className="promo-form-group">
                                <label>Maximum Discount 1</label>
                                <input type="number" name="maxDiscountAmount" value={formData.maxDiscountAmount} onChange={handleChange} placeholder="Optional" min="0"  step="0.01"/>
                            </div>

                            <h4>Offer 2 (Optional)</h4>

                            <div className="promo-form-row">
                                <div className="promo-form-group">
                                    <label>Discount Type 2</label>
                                    <select name="discountType2" value={formData.discountType2} onChange={handleChange}>
                                        <option value="">No second offer</option>
                                        <option value="percentage">Percentage</option>
                                        <option value="fixed">Fixed Amount</option>
                                        <option value="freeDelivery">Free Delivery</option>
                                    </select>
                                </div>

                                <div className="promo-form-group">
                                    <label>Discount Value 2</label>
                                    <input type="number" name="discountValue2" value={formData.discountValue2} onChange={handleChange} placeholder={formData.discountType2 === "percentage" ? "e.g. 10" : "e.g. 5.00"} min="0" max={formData.discountType2 === "percentage" ? "100" : undefined} step="0.01" disabled={!formData.discountType2} required={Boolean(formData.discountType2)}/>
                                </div>
                            </div>

                            <div className="promo-form-group">
                                <label>Maximum Discount 2</label>
                                <input type="number" name="maxDiscountAmount2" value={formData.maxDiscountAmount2} onChange={handleChange} placeholder="Optional" min="0" step="0.01" disabled={!formData.discountType2}/>
                            </div>

                            <div className="promo-form-row">
                                <div className="promo-form-group">
                                    <label>Minimum Order Amount</label>
                                    <input type="number" name="minOrderAmount" value={formData.minOrderAmount} onChange={handleChange} placeholder="0.00" min="0" step="0.01"/>
                                </div>

                                <div className="promo-form-group">
                                    <label>Usage Limit</label>
                                    <input type="number" name="usageLimit" value={formData.usageLimit} onChange={handleChange} placeholder="Unlimited" min="1" />
                                </div>
                            </div>

                            <div className="promo-form-row">
                                <div className="promo-form-group">
                                    <label>Expiry Date</label>
                                    <input type="datetime-local" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required />
                                </div>

                                {editingPromo && (
                                    <div className="promo-form-group">
                                        <label>Promo Status</label>
                                        <select name="isActive"value={String(formData.isActive)} onChange={e => setFormData(prev => ({...prev, isActive: e.target.value === "true"}))}>
                                            <option value="true">Active</option>
                                            <option value="false">Inactive</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="promo-form-group">
                                <label>Offer Bar Text</label>
                                <input type="text" name="offerText" value={formData.offerText} onChange={handleChange} placeholder="Describe the promo offer"/>
                            </div>

                            <div className="promo-offer-bar-option">
                                <label>
                                    <input type="checkbox" name="showOnOfferBar" checked={formData.showOnOfferBar} onChange={handleChange}/>
                                    <span>Show this promo on the Offer Bar</span>
                                </label>
                            </div>

                            <div className="promo-form-buttons">
                                <button type="button" className="promo-cancel-btn" onClick={resetForm}>
                                    Cancel
                                </button>

                                <button type="submit" className="promo-save-btn">
                                    {editingPromo ? "Update Promo Code" : "Create Promo Code"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deletingPromo && (
                <div className="promo-modal-overlay">
                    <div className="promo-delete-modal">
                        <div className="promo-delete-icon">!</div>

                        <h3>Delete Promo Code?</h3>

                        <p>
                            Are you sure you want to delete
                            <strong> {deletingPromo.code}</strong>?
                        </p>

                        <p className="promo-delete-warning">
                            This action cannot be undone.
                        </p>

                        <div className="promo-form-buttons">
                            <button type="button" className="promo-cancel-btn" onClick={() => setDeletingPromo(null)}>
                                Cancel
                            </button>

                            <button type="button" className="delete-promo-btn" onClick={handleDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PromoCodes
