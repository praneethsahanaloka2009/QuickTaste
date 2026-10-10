import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import './PromoCodes.css'

const PromoCodes = () => {
    
    const [promos, setPromos] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPromo, setEditingPromo] = useState(null)
    const [deletingPromo, setDeletingPromo] = useState(null)

    const [formData, setFormData] = useState({
        code: "",
        discountType: "percentage",
        discountValue: "",
        minOrderAmount: "",
        maxDiscountAmount: "",
        expiryDate: "",
        usageLimit: "",
        offerText: "",
        showOnOfferBar: false
    })

    // Fetch all promo codes
    const fetchPromos = async () => {
        
        try {
            
            const response = await fetch("http://localhost:4911/api/promo/list")
            const data = await response.json()

            if(data.success){
                setPromos(data.promos)
            }

        } catch (error) {
            
            console.log(error)
            toast.error("Failed to load promo codes")

        } finally {
            
            setLoading(false)

        }

    }

    useEffect(() => {
        fetchPromos()
    }, [])

    // Handle input changes
    const handleChange = (e) => {
        
        const { name, value, type, checked } = e.target

        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }))

    }

    // Reset form
    const resetForm = () => {
        
        setFormData({
            code: "",
            discountType: "percentage",
            discountValue: "",
            minOrderAmount: "",
            maxDiscountAmount: "",
            expiryDate: "",
            usageLimit: "",
            offerText: "",
            showOnOfferBar: false
        })

        setEditingPromo(null)
        setShowForm(false)

    }

    // Add / Edit submit
    const handleSubmit = async (e) => {
        
        e.preventDefault()

        try {

            const url = editingPromo ? `http://localhost:4911/api/promo/${editingPromo._id}` : "http://localhost:4911/api/promo/create"

            const method = editingPromo ? "PUT" : "POST"
            
            const response = await fetch(
                url,
                {
                    method,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        code: formData.code,
                        discountType: formData.discountType,
                        discountValue: Number(formData.discountValue),
                        minOrderAmount: formData.minOrderAmount === "" ? 0 : Number(formData.minOrderAmount),
                        maxDiscountAmount: formData.maxDiscountAmount === "" ? "" : Number(formData.maxDiscountAmount),
                        expiryDate: formData.expiryDate,
                        usageLimit: formData.usageLimit === "" ? "" : Number(formData.usageLimit),
                        offerText: formData.offerText,
                        showOnOfferBar: formData.showOnOfferBar
                    })
                })

                const data = await response.json()

                if(data.success){
                    
                    toast.success(data.message)

                    resetForm()

                    fetchPromos()

                } else {
                    
                    toast.error(data.message)

                }

        } catch (error) {
            
            console.log(error)
            toast.error("Something went wrong")

        }

    }

    // Open edit modal
    const handleEdit = (promo) => {
        
        setEditingPromo(promo)

        setFormData({
            code: promo.code || "",
            discountType: promo.discountType || "percentage",
            discountValue: promo.discountValue ?? "",
            minOrderAmount: promo.minOrderAmount ?? "",
            maxDiscountAmount: promo.maxDiscountAmount ?? "",
            expiryDate: promo.expiryDate ? new Date(promo.expiryDate).toISOString().slice(0, 16) : "",
            usageLimit: promo.usageLimit ?? "",
            offerText: promo.offerText || "",
            showOnOfferBar: promo.showOnOfferBar || false
        })

        setShowForm(true)

    }

    // Open delete confirmation
    const handleDeleteClick = (promo) => {
        
        setDeletingPromo(promo)

    }

    // Delete Promo
    const handleDelete = async () => {
        
        if(!deletingPromo){
            return
        }

        try {
            
            const response = await fetch(
                `http://localhost:4911/api/promo/${deletingPromo._id}`,
                {
                    method: "DELETE"
                }
            )

            const data = await response.json()

            if(data.success){
                
                toast.success(data.message)

                setDeletingPromo(null)

                fetchPromos()

            } else {
                
                toast.error(data.message)

            }

        } catch (error) {
            
            console.log(error)
            toast.error("Something went wrong")

        }

    }

    return (
        <div className="promo-codes-page">
            
            <div className="promo-codes-header">
                
                <div>
                    <h2>Promo Codes</h2>
                    <p>Manage discount codes for customers</p>
                </div>

                <button 
                    className="add-promo-btn" 
                    onClick={() => {
                        setEditingPromo(null)
                        setFormData({
                            code: "",
                            discountType: "percentage",
                            discountValue: "",
                            minOrderAmount: "",
                            maxDiscountAmount: "",
                            expiryDate: "",
                            usageLimit: "",
                            offerText: "",
                            showOnOfferBar: false
                        })
                        setShowForm(true)
                    }}>
                    + Add Promo Code
                </button>

            </div>

            {/* Promo Content */}
            <div className="promo-codes-content">
                
                {loading ? (
                    
                    <p className="promo-loading">
                        Loading promo codes...
                    </p>

                ) : promos.length === 0 ? (
                    
                    <div className="no-promos">
                        
                        <h3>No Promo Codes</h3>

                        <p>
                            Create your first promo code to offer discounts to customers.
                        </p>

                    </div>

                ) : (
                    
                    <div className="promo-table-wrapper">
                        
                        <table className="promo-table">
                            
                            <thead>
                                
                                <tr>
                                    <th>Code</th>
                                    <th>Discount</th>
                                    <th>Min. Order</th>
                                    <th>Expiry</th>
                                    <th>Usage</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>

                            </thead>

                            <tbody>
                                
                                {promos.map((promo) => (
                                    
                                    <tr key={promo._id}>
                                        
                                        <td>
                                            <strong>{promo.code}</strong>
                                        </td>

                                        <td>
                                            {promo.discountType === "percentage" ? `${promo.discountValue}%` : `$${Number(promo.discountValue).toFixed(2)}`}
                                        </td>

                                        <td>
                                            ${Number(promo.minOrderAmount).toFixed(2)}
                                        </td>

                                        <td>
                                            {new Date(promo.expiryDate).toLocaleDateString()}
                                        </td>

                                        <td>
                                            {promo.usedCount} / {promo.usageLimit ?? "∞"}
                                        </td>

                                        <td>
                                            <span className={promo.isActive ? "promo-active" : "promo-inactive"}>
                                                {promo.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="promo-actions">
                                                
                                                <button className="edit-promo-btn" onClick={() => handleEdit(promo)}>
                                                    Edit
                                                </button>

                                                <button className="delete-promo-btn" onClick={() => handleDeleteClick(promo)}>
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

            {/* Add Promo Code Modal */}
            {showForm && (
                
                <div className="promo-modal-overlay">
                    
                    <div className="promo-modal">
                        
                        <div className="promo-modal-header">
                            
                            <div>
                                <h3>{editingPromo ? "Edit Promo Code" : "Add Promo Code"}</h3>
                                <p>{editingPromo ? "Update discount code details" : "Create a new discount code"}</p>
                            </div>

                            <button className="promo-close-btn" onClick={resetForm}>
                                ×
                            </button>

                        </div>

                        <form onSubmit={handleSubmit}>
                            
                            <div className="promo-form-group">
                                
                                <label>Promo Code</label>

                                <input type="text" name="code" value={formData.code} onChange={handleChange} placeholder="Example: SAVE10" required/>

                            </div>

                            <div className="promo-form-row">
                                
                                <div className="promo-form-group">
                                    
                                    <label>Discount Type</label>

                                    <select name="discountType" value={formData.discountType} onChange={handleChange}>
                                        
                                        <option value="percentage">
                                            Percentage
                                        </option>

                                        <option value="fixed">
                                            Fixed Amount
                                        </option>

                                    </select>

                                </div>

                                <div className="promo-form-group">
                                    
                                    <label>Discount Value</label>

                                    <input type="number" name="discountValue" value={formData.discountValue} onChange={handleChange} placeholder={ formData.discountType === "percentage" ? "10" : "5.00" } min="0" step="0.01" required/>

                                </div>

                            </div>

                            {/* Minimum + Maximum */}
                            <div className="promo-form-row">
                                
                                <div className="promo-form-group">
                                    
                                    <label>Minimum Order Amount</label>

                                    <input type="number" name="minOrderAmount" value={formData.minOrderAmount} onChange={handleChange} placeholder="0.00" min="0" step="0.01"/>

                                </div>

                                <div className="promo-form-group">
                                    
                                    <label>Maximum Discount</label>

                                    <input type="number" name="maxDiscountAmount" value={formData.maxDiscountAmount} onChange={handleChange} placeholder="Optional" min="0" step="0.01"/>

                                </div>

                            </div>

                            {/* Expiry + Usage */}
                            <div className="promo-form-row">
                                
                                <div className="promo-form-group">
                                    
                                    <label>Expiry Date</label>

                                    <input type="datetime-local" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required/>

                                </div>

                                <div className="promo-form-group">
                                    
                                    <label>Usage Limit</label>

                                    <input type="number" name="usageLimit" value={formData.usageLimit} onChange={handleChange} placeholder="Unlimited" min="1"/>

                                </div>

                            </div>

                            {/* Offer Bar */}
                            <div className="promo-form-group">
                                
                                <label>Offer Bar Text</label>

                                <input type="text" name="offerText" value={formData.offerText} onChange={handleChange} placeholder="Example: 20% OFF on First Purchase"/>

                            </div>

                            <div className="promo-offer-bar-option">
                                
                                <label>

                                    <input type="checkbox" name="showOnOfferBar" checked={formData.showOnOfferBar} onChange={handleChange}/>
                                    
                                    <span>Show this promo on the Offer Bar</span>

                                </label>

                            </div>

                            <div className="promo-form-buttons">
                                
                                <button type="button" className="promo-cancel-btn" onClick={resetForm}>Cancel</button>

                                <button type="submit" className="promo-save-btn">{editingPromo ? "Update Promo Code" : "Create Promo Code"}</button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

            {/* Delete Confirmation Modal */}
            {deletingPromo && (
                
                <div className="promo-modal-overlay">
                    
                    <div className="promo-delete-modal">
                        
                        <div className="promo-delete-icon">
                            !
                        </div>

                        <h3>
                            Delete Promo Code?
                        </h3>

                        <p>
                            Are you sure you want to delete<strong> {deletingPromo.code}</strong>?
                        </p>

                        <p className="promo-delete-warning">
                            This action cannot be undone.
                        </p>

                        <div className="promo-form-buttons">
                            
                            <button type="button" className="promo-cancel-btn" onClick={() => setDeletingPromo(null)}>Cancel</button>

                            <button type="button" className="delete-promo-btn" onClick={handleDelete}>Delete</button>

                        </div>

                    </div>

                </div>

            )}

        </div>
    )

}

export default PromoCodes