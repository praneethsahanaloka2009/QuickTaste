import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { toast } from "react-toastify";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./MyAddresses.css";

const API_URL = "http://localhost:4911/api/user/addresses";

const EMPTY_FORM = {
    label: "Home",
    fullAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: "Sri Lanka",
    latitude: null,
    longitude: null,
    isDefault: false
};

const LABEL_ICONS = {
    Home: "⌂",
    Work: "▣",
    Other: "⌖"
};

// Map component
const AddressMap = ({ latitude, longitude, onPick }) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onPickRef = useRef(onPick);

    useEffect(() => {
        onPickRef.current = onPick;
    }, [onPick]);

    useEffect(() => {
        if(!containerRef.current || mapRef.current){
            return;
        }

        // Initial map center: Sri Lanka
        const map = L.map(containerRef.current, {zoomControl: true}).setView([7.8731, 80.7718], 8);

        mapRef.current = map;

         L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution:
                    '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }
        ).addTo(map);

        // Circle marker avoids missing default marker icons.
        const marker = L.circleMarker([7.8731, 80.7718], {
            radius: 9,
            color: "#ffffff",
            weight: 3,
            fillColor: "#087c31",
            fillOpacity: 1
        });

        markerRef.current = marker;

        map.on("click", (event) => {
            const lat = Number(event.latlng.lat.toFixed(7));
            const lng = Number(event.latlng.lng.toFixed(7));

            onPickRef.current(lat, lng);
        });

        // Resize map correctly when page layout settles.
        requestAnimationFrame(() => {
            map.invalidateSize();
        });

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        const marker = markerRef.current;

        if(!map || !marker){
            return;
        }

        const valid = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

        if(!valid){
            marker.remove();
            return;
        }

        marker.setLatLng([latitude, longitude]);

        if(!map.hasLayer(marker)){
            marker.addTo(map);
        }

        map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
    }, [latitude, longitude]);

    return (
        <div className="qt-address-map-wrapper">
            <div ref={containerRef} className="qt-address-map" aria-label="Select delivery location on map"/>
            <p className="qt-address-map-hint">
                Click a point on the map to select the exact delivery location.
            </p>
        </div>
    );
};

const MyAddresses = () => {
    const navigate = useNavigate();
    const { token } = useContext(StoreContext);

    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const [saving, setSaving] = useState(false);
    const [actionId, setActionId] = useState(null);
    const [locating, setLocating] = useState(false);
    const [addressToDelete, setAddressToDelete] = useState(null);

    useEffect(() => {
        if(!token){
            navigate("/", { replace: true });
            return;
        }

        let cancelled = false;

        const fetchAddresses = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(API_URL, {
                    headers : {
                        Authorization : `Bearer ${token}`
                    },
                    cache: "no-store"
                });

                const data = await response.json();

                if(!response.ok || !data.success){
                    throw new Error(data.message || "Unable to load saved addresses.");
                }

                if(!cancelled){
                    setAddresses(data.addresses || []);
                }
            } catch (error) {
                if(!cancelled){
                    setError(error.message);
                }
            } finally {
                if(!cancelled){
                    setLoading(false);
                }
            }
        };

        fetchAddresses();

        return () => {
            cancelled = true;
        };
    }, [token, navigate]);

    const changeField = (event) => {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    const startAdd = () => {
        setEditingId(null);
        setForm({
            ...EMPTY_FORM,
            isDefault: addresses.length === 0
        });
        setShowForm(true);
    };

    const startEdit = (address) => {
        setEditingId(address._id);

        setForm({
            label: address.label || "Home",
            fullAddress: address.fullAddress || "",
            city: address.city || "",
            state: address.state || "",
            zipCode: address.zipCode || "",
            country: address.country || "Sri Lanka",
            latitude: address.latitude,
            longitude: address.longitude,
            isDefault: address.isDefault === true
        });

        setShowForm(true);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    const closeForm = () => {
        if(saving){
            return
        }

        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    const handleMapPick = (latitude, longitude) => {
        setForm((previous) => ({
            ...previous,
            latitude,
            longitude
        }));
    };

    const handleUseCurrentLocation = () => {
        if(!navigator.geolocation){
            toast.error("Geolocation is not supported by this browser.");
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition((position) => {
            const latitude = Number(
                position.coords.latitude.toFixed(7)
            );

            const longitude = Number(
                position.coords.longitude.toFixed(7)
            );

            handleMapPick(latitude, longitude);
            setLocating(false);

            toast.success("Current location selected!");
        }, (error) => {
            setLocating(false);

            toast.error(
                error.code === 1 ? "Please allow location access." : "Unable to get your location."
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        });
    };

    const sendRequest = async (endpoint, method, body = undefined) => {
        const response = await fetch(endpoint, {
            method,
            headers: {
                "Content-Type" : "application/json",
                Authorization : `Bearer ${token}`
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        });

        const data = await response.json();

        if(!response.ok || !data.success){
            throw new Error(data.message || "Address request failed.");
        }

        return data;
    };

    const handleSave = async (event) => {
        event.preventDefault();

        if(saving){
            return;
        }

        const fullAddress = form.fullAddress.trim();
        const city = form.city.trim();
        const country = form.country.trim();

        if(!fullAddress || !city || !country){
            toast.error("Please complete your delivery address.");
            return;
        }

        if(!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)){
            toast.error("Please select the exact location on the map.");
            return;
        }

        const payload = {
            label: form.label,
            fullAddress,
            city,
            state: form.state.trim(),
            zipCode: form.zipCode.trim(),
            country,
            latitude: form.latitude,
            longitude: form.longitude,
            isDefault: form.isDefault
        };

        setSaving(true);

        try {
            const endpoint = editingId ? `${API_URL}/${editingId}` : API_URL;

            const method = editingId ? "PUT" : "POST";

            const data = await sendRequest(endpoint, method, payload);

            setAddresses(data.addresses || []);
            setShowForm(false);
            setEditingId(null);
            setForm(EMPTY_FORM);

            toast.success(data.message);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSetDefault = async (addressId) => {
        if(actionId){
            return;
        }

        setActionId(addressId);

        try {
            const data = await sendRequest(`${API_URL}/${addressId}/default`, "PUT");

            setAddresses(data.addresses || []);
            toast.success(data.message);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setActionId(null);
        }
    };

    const handleDelete = async () => {
        if(!addressToDelete || actionId){
            return;
        }

        const addressId = addressToDelete._id;

        setActionId(addressId);

        try {
            const data = await sendRequest(`${API_URL}/${addressId}`, "DELETE");

            setAddresses(data.addresses || []);

            if(editingId === addressId){
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
            }

            setAddressToDelete(null);

            toast.success(data.message);

        } catch (error) {
            toast.error(error.message);
        } finally {
            setActionId(null);
        }
    };

    if(!token){
        return null;
    }

    return(
        <div className="qt-address-page">
            <div className="qt-address-container">
                <div className="qt-address-top">
                    <div>
                        <span className="qt-address-eyebrow">
                            QUICKTASTE ACCOUNT
                        </span>

                        <h1>My Addresses</h1>

                        <p>
                            Save your favorite delivery locations for faster checkout.
                        </p>
                    </div>

                    <Link to="/profile" className="qt-address-back">
                        ← Back to Profile
                    </Link>
                </div>

                <div className="qt-address-toolbar">
                    <div>
                        <h2>Saved Delivery Addresses</h2>
                        <p>
                            {addresses.length} of 5 addresses saved
                        </p>
                    </div>

                    {!showForm && addresses.length < 5 && (
                        <button type="button" className="qt-address-btn-primary" onClick={startAdd}>
                            + Add New Address
                        </button>
                    )}
                </div>

                {showForm && (
                    <section className="qt-address-form-card">
                        <div className="qt-address-section-header">
                            <div>
                                <h2>
                                    {editingId ? "Edit Delivery Address" : "Add Delivery Address"}
                                </h2>
                                <p>
                                    Choose your location and enter the delivery details.
                                </p>
                            </div>

                            <button type="button" className="qt-address-close" onClick={closeForm} disabled={saving} aria-label="Close form">
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="qt-address-field">
                                <label>Address Type</label>

                                <div className="qt-address-label-options">
                                    {["Home", "Work", "Other"].map((label) => (
                                        <button type="button" key={label} className={"qt-address-label-option " + (form.label === label ? "selected" : "")} onClick={() => setForm((prev) => ({...prev, label}))}>
                                            <span>
                                                {LABEL_ICONS[label]}
                                            </span>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="qt-address-fields-grid">
                                <div className="qt-address-field full">
                                    <label htmlFor="qt-full-address">
                                        Full Street Address *
                                    </label>

                                    <input id="qt-full-address" name="fullAddress" value={form.fullAddress} onChange={changeField} placeholder="House number, street, area" maxLength={250} required/>
                                </div>

                                <div className="qt-address-field">
                                    <label htmlFor="qt-city">
                                        City *
                                    </label>

                                    <input id="qt-city" name="city" value={form.city} onChange={changeField} placeholder="Enter city" maxLength={250} required/>
                                </div>

                                <div className="qt-address-field">
                                    <label htmlFor="qt-state">
                                        State / Province
                                    </label>

                                    <input id="qt-state" name="state" value={form.state} onChange={changeField} placeholder="Enter province" maxLength={250}/>
                                </div>

                                <div className="qt-address-field">
                                    <label htmlFor="qt-zip">
                                        Zip / Postal Code
                                    </label>

                                    <input id="qt-zip" name="zipCode" value={form.zipCode} onChange={changeField} placeholder="Postal code" maxLength={250}/>
                                </div>

                                <div className="qt-address-field">
                                    <label htmlFor="qt-country">
                                        Country *
                                    </label>

                                    <input id="qt-country" name="country" value={form.country} onChange={changeField} maxLength={250} required/>
                                </div>
                            </div>

                            <div className="qt-address-map-title">
                                <div>
                                    <h3>Delivery Map Location *</h3>
                                    <p>
                                        Select the exact location where your order should be delivered.
                                    </p>
                                </div>

                                <button type="button" className="qt-address-btn-outline" onClick={handleUseCurrentLocation} disabled={locating}>
                                    {locating ? "Locating..." : "⌖ Use My Location"}
                                </button>
                            </div>

                            <AddressMap key={editingId || "new-address"} latitude={form.latitude} longitude={form.longitude} onPick={handleMapPick}/>

                            <div className="qt-address-coordinates">
                                <span>
                                    Latitude:{" "}
                                    <strong>
                                        {form.latitude ?? "Not selected"}
                                    </strong>
                                </span>

                                <span>
                                    Longitude:{" "}
                                    <strong>
                                        {form.longitude ?? "Not selected"}
                                    </strong>
                                </span>
                            </div>

                            <label className="qt-address-default-option">
                                <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((prev) => ({...prev, isDefault: event.target.checked}))}/>

                                <span>
                                    Set as my default delivery address
                                </span>
                            </label>

                            <div className="qt-address-form-actions">
                                <button type="submit" className="qt-address-btn-primary" disabled={saving}>
                                    {saving ? "Saving Address..." : editingId ? "Save Changes" : "Save Address"}
                                </button>

                                <button type="button" className="qt-address-btn-outline" onClick={closeForm} disabled={saving}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                {loading ? (
                    <div className="qt-address-empty">
                        Loading saved addresses...
                    </div>
                ) : error ? (
                    <div className="qt-address-empty">
                        <p>{error}</p>
                        <button className="qt-address-btn-outline" onClick={() => window.location.reload()}>
                            Retry
                        </button>
                    </div>
                ) : addresses.length === 0 ? (
                    <div className="qt-address-empty">
                        <div className="qt-address-empty-icon">
                            ⌖
                        </div>

                        <h3>No Saved Addresses Yet</h3>

                        <p>
                            Add your first address to make future food orders easier.
                        </p>

                        {!showForm && (
                            <button type="button" className="qt-address-btn-primary" onClick={startAdd}>
                                + Add Your First Address
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="qt-address-card-grid">
                        {addresses.map((address) => (
                            <article className={"qt-address-card " + (address.isDefault ? "default" : "")} key={address._id}>
                                <div className="qt-address-card-top">
                                    <div className="qt-address-card-label">
                                        <span className="qt-address-type-icon">
                                            {LABEL_ICONS[address.label] || "⌖"}
                                        </span>

                                        <h3>{address.label}</h3>
                                    </div>

                                    {address.isDefault && (
                                        <span className="qt-address-badge">
                                            DEFAULT
                                        </span>
                                    )}
                                </div>

                                <p className="qt-address-street">
                                    {address.fullAddress}
                                </p>

                                <p className="qt-address-city">
                                    {[address.city, address.state, address.zipCode, address.country].filter(Boolean).join(", ")}
                                </p>

                                <p className="qt-address-gps">
                                    ⌖ GPS Location Saved
                                </p>

                                <div className="qt-address-card-actions">
                                    <button type="button" className="qt-address-action" onClick={() => startEdit(address)} disabled={Boolean(actionId)}>
                                        Edit
                                    </button>

                                    {!address.isDefault && (
                                        <button type="button" className="qt-address-action" disabled={Boolean(actionId)} onClick={() => handleSetDefault(address._id)}>
                                            {actionId === address._id ? "Updating..." : "Set Default"}
                                        </button>
                                    )}

                                    <button type="button" className="qt-address-action danger" disabled={Boolean(actionId)} onClick={() => setAddressToDelete(address)}>
                                        Remove
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                <div className="qt-address-bottom-note">
                    <strong>Faster checkout</strong>
                    <p>
                        Your default saved address will be available for automatic filling during checkout after we connect the Place Order page.
                    </p>
                    <p>
                        Delivery availability will always be checked again for each order.
                    </p>
                </div>

                {/* Delete Address Confirmation Modal */}
                {addressToDelete && (
                    <div className="qt-address-modal-overlay" onClick={() => {if(actionId){setAddressToDelete(null);}}}>
                        <div className="qt-address-modal" role="dialog" aria-modal="true" aria-labelledby="qt-delete-title" onClick={(event) => event.stopPropagation()}>
                            <div className="qt-address-modal-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18"/>
                                    <path d="M8 6V4h8v2"/>
                                    <path d="M19 6l-1 14H6L5 6"/>
                                    <path d="M10 10v6"/>
                                    <path d="M14 10v6"/>
                                </svg>
                            </div>

                            <h2 id="qt-delete-title">
                                Remove Saved Address?
                            </h2>

                            <p>
                                Are you sure you want to remove your{" "}<strong>{addressToDelete.label}</strong>{" "}address? This action cannot be undone.
                            </p>

                            <div className="qt-address-modal-actions">
                                <button type="button" className="qt-address-modal-cancel" onClick={() => setAddressToDelete(null)} disabled={Boolean(actionId)}>
                                    Keep Address
                                </button>

                                <button type="button" className="qt-address-modal-delete" onClick={handleDelete} disabled={Boolean(actionId)}>
                                    {actionId ? "Removing..." : "Remove Address"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyAddresses;