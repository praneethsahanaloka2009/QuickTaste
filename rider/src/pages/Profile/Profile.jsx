import { useEffect, useState, useRef } from "react";
import {UserRound, Mail, Phone, Bike, Save, RotateCcw, ShieldCheck, Camera, Upload, Landmark, CreditCard, Building2} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api.js";
import { useRider } from "../../context/RiderContext.jsx";
import "./Profile.css";

function Profile(){
  const { rider, setRider, token } = useRider();

  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    branchName: ""
  });

  const [bankInfo, setBankInfo] = useState(null);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankSaving, setBankSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    vehicleType: "Motorcycle"
  });

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState({});

  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const avatarUrl = previewUrl || (rider?.avatar ? rider.avatar.startsWith("http") ? rider.avatar : `http://localhost:4911${rider.avatar}` : "");

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];

    if(!file){
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if(!allowedTypes.includes(file.type)){
      toast.error("Please select a JPG, PNG, SVG or WebP image.");
      event.target.value = "";
      return;
    }

    if(file.size > 5 * 1024 * 1024){
      toast.error("Image size must be 5 MB or less.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);

    setPreviewUrl((previousUrl) => {
      if(previousUrl){
        URL.revokeObjectURL(previousUrl);
      }
      return URL.createObjectURL(file);
    });
  };

  const handleAvatarUpload = async () => {
    if(!selectedFile){
      toast.error("Please select a profile picture first.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", selectedFile);

    setUploadingAvatar(true);

    try {
      const response = await api.put(
        "/profile/avatar",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      const updatedRider = response.data?.rider;

      if(!updatedRider){
        throw new Error("The server did not return updated rider details.");
      }

      setRider((previousRider) => ({
        ...previousRider,
        ...updatedRider
      }));

      localStorage.setItem(
        "rider",
        JSON.stringify({
          ...rider,
          ...updatedRider
        })
      );

      setSelectedFile(null);
      setPreviewUrl((previousUrl) => {
        if(previousUrl) URL.revokeObjectURL(previousUrl);
        return "";
      });

      if(fileInputRef.current){
        fileInputRef.current.value = "";
      }

      toast.success(
        response.data?.message || "Profile picture updated successfully!"
      );

    } catch (error) {
      console.error("Avatar upload error:", error);

      toast.error(error.response?.data?.message || error.message || "Failed to upload profile picture.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setLoading(true);

      try {
        const response = await api.get("/profile");

        const data = response.data?.rider || response.data?.data?.rider || response.data?.data || response.data;

        if(cancelled){
          return;
        }

        const profile = {
          ...rider,
          ...data
        };

        setFormData({
          name: profile.name || "",
          phone: profile.phone || "",
          vehicleType: profile.vehicleType || "Motorcycle"
        });

        setEmail(profile.email || "");
        setRider(profile);

        localStorage.setItem("rider", JSON.stringify(profile));
      } catch (error) {
        if(cancelled){
          return
        }

        console.error("Profile loading error:", error);

        setFormData({
          name: rider?.name || "",
          phone: rider?.phone || "",
          vehicleType: rider?.vehicleType || "Motorcycle"
        });

        setEmail(rider?.email || "");

        toast.error(error.response?.data?.message || "Unable to load the latest profile details.");
      } finally {
        if(!cancelled){
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token])

  useEffect(() => {
    let cancelled = false;

    const loadBankDetails = async () => {
      setBankLoading(true);

      try {
        const response = await api.get("/bank-details");

        if(cancelled){
          return;
        }

        const bank = response.data?.bankDetails || {};

        setBankInfo(bank);

        setBankForm({
          bankName: bank.bankName || "",
          accountHolderName: bank.accountHolderName || "",
          accountNumber: "",
          branchName: bank.branchName || ""
        });

      } catch (error) {
        if(!cancelled){
          toast.error(
            error.response?.data?.message || "Unable to load bank details."
          );
        }
      } finally {
        if(!cancelled){
          setBankLoading(false);
        }
      }
    };

    if(token){
      loadBankDetails();
    } else {
      setBankLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name] : value
    }));

    setErrors((previous) => ({
      ...previous,
      [name] : ""
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if(!formData.name.trim()){
      newErrors.name = "Please enter your full name.";
    }

    if(!formData.phone.trim()){
      newErrors.phone = "Please enter your phone number.";
    } else if(!/^\+?[0-9\s()-]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = "Please enter a valid phone number.";
    }

    if(!["Motorcycle", "Bicycle", "Scooter", "Other"].includes(formData.vehicleType)){
      newErrors.vehicleType = "Please select a valid vehicle type.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if(!validateForm()){
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        vehicleType: formData.vehicleType
      };

      const response = await api.put("/profile", payload);

      const responseData = response.data?.rider || response.data?.data?.rider || response.data?.data;

      const updatedRider = {
        ...rider,
        ...(responseData && typeof responseData === "object" ? responseData : {}),
        ...payload,
        email: responseData?.email || email || rider?.email || ""
      };

      setRider(updatedRider);
      localStorage.setItem("rider", JSON.stringify(updatedRider));

      toast.success(response.data?.message || "Profile updated successfully!");
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(error.response?.data?.message || "Failed to update your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleBankChange = (event) => {
    const { name, value } = event.target;

    setBankForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleBankSubmit = async (event) => {
    event.preventDefault();

    const bankName = bankForm.bankName.trim();
    const accountHolderName = bankForm.accountHolderName.trim();
    const branchName = bankForm.branchName.trim();
    const accountNumber = bankForm.accountNumber.trim();

    if(!bankName || !accountHolderName || !branchName){
      toast.error("Please complete all bank details.");
      return;
    }

    if(!bankInfo?.hasAccountNumber && !accountNumber){
      toast.error("Please enter your bank account number.");
      return;
    }

    if(accountNumber && !/^[0-9]{6,20}$/.test(accountNumber)){
      toast.error("Account number must contain 6 to 20 digits.");
      return;
    }

    const payload = { bankName, accountHolderName, branchName };

    // Only send the account number when changing it.
    if(accountNumber){
      payload.accountNumber = accountNumber;
    }

    setBankSaving(true);

    try {
      const response = await api.put("/bank-details", payload)
      const updatedBank = response.data?.bankDetails;

      if(!updatedBank){
        throw new Error("The server did not return updated bank details.");
      }

      setBankInfo(updatedBank);

      setBankForm({
        bankName: updatedBank.bankName || "",
        accountHolderName: updatedBank.accountHolderName || "",
        accountNumber: "",
        branchName: updatedBank.branchName || ""
      });

      toast.success(response.data?.message || "Bank details saved successfully!");

    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save bank details.");
    } finally {
      setBankSaving(false);
    }
  }

  const handleReset = () => {
    setFormData({
      name: rider?.name || "",
      phone: rider?.phone || "",
      vehicleType: rider?.vehicleType || "Motorcycle"
    });

    setErrors({});
  };

  if(loading){
    return (
      <main className="rider-profile-page">
        <div className="rider-profile-loading">
          <div className="rider-profile-spinner"/>
          <p>Loading your profile...</p>
        </div>
      </main>
    );
  }

  return(
    <main className="rider-profile-page">
      <div className="rider-profile-container">
        
        {/* Page Heading */}
        <div className="rider-profile-heading">
          <div>
            <span className="rider-profile-eyebrow">
              RIDER ACCOUNT
            </span>

            <h1>My Profile</h1>

            <p>
              Manage your personal information and delivery details.
            </p>
          </div>

          <div className="rider-profile-heading-icon">
            <UserRound size={28}/>
          </div>
        </div>

        {/* Profile Overview */}
        <section className="rider-profile-overview">
          <div className="rider-profile-avatar-area">
            <div className="rider-profile-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Rider profile"/>
              ) : (
                <UserRound size={43}/>
              )}

              <button type="button" className="rider-avatar-camera-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} aria-label="Choose profile picture" title="Choose profile picture">
                <Camera size={17}/>
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="rider-avatar-file-input" onChange={handleAvatarSelect}/>

            <span className="rider-avatar-help">
              JPG, PNG or WebP · Max 5 MB
            </span>
          </div>

          <div className="rider-profile-overview-info">
            <h2>{formData.name || "Rider Name"}</h2>
            <p>{email || "Email address not available"}</p>

            <span className="rider-profile-status">
              <span className="rider-profile-status-dot"/>
              Rider Account
            </span>

            {selectedFile && (
              <p className="rider-avatar-selected-name">
                Selected: {selectedFile.name}
              </p>
            )}

            <div className="rider-avatar-actions">
              <button type="button" className="rider-avatar-choose-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                <Camera size={16}/>
                Choose Photo
              </button>

              {selectedFile && (
                <button type="button" className="rider-avatar-upload-btn" onClick={handleAvatarUpload} disabled={uploadingAvatar}>
                  <Upload size={16}/>
                  {uploadingAvatar ? "Uploading..." : "Upload Photo"}
                </button>
              )}
            </div>
          </div>

          <div className="rider-profile-verified">
            <ShieldCheck size={18}/>
            <span>Rider Portal</span>
          </div>
        </section>

        {/* Profile Form */}
        <section className="rider-profile-card">
          <div className="rider-profile-card-heading">
            <div>
              <h2>Personal Information</h2>
              <p>Keep your contact details up to date.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="rider-profile-form-grid">
              
              {/* Full Name */}
              <div className="rider-profile-field">
                <label htmlFor="rider-name">
                  Full Name
                </label>

                <div className={`rider-profile-input-wrap ${errors.name ? "has-error" : ""}`}>
                  <UserRound size={19}/>
                  <input id="rider-name" type="text" name="name" placeholder="Enter your full name" value={formData.name} onChange={handleChange} autoComplete="name" maxLength={100} required/>
                </div>

                {errors.name && (
                  <span className="rider-profile-error">
                    {errors.name}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="rider-profile-field">
                <label htmlFor="rider-email">
                  Email Address
                </label>

                <div className="rider-profile-input-wrap rider-profile-readonly">
                  <Mail size={19}/>
                  <input id="rider-email" type="email" value={email} placeholder="Email address" readOnly/>
                </div>

                <span className="rider-profile-hint">
                  Your registered email address.
                </span>
              </div>

              {/* Phone */}
              <div className="rider-profile-field">
                <label htmlFor="rider-phone">
                  Phone Number
                </label>

                <div className={`rider-profile-input-wrap ${errors.phone ? "has-error" : ""}`}>
                  <Phone size={19}/>
                  <input id="rider-phone" type="tel" name="phone" placeholder="Enter your phone number" value={formData.phone} onChange={handleChange} autoComplete="tel" maxLength={20} required/>
                </div>

                {errors.phone && (
                  <span className="rider-profile-error">
                    {errors.phone}
                  </span>
                )}
              </div>

              {/* Vehicle Type */}
              <div className="rider-profile-field">
                <label htmlFor="rider-vehicle">
                  Vehicle Type
                </label>

                <div className={`rider-profile-input-wrap rider-profile-select-wrap ${errors.vehicleType ? "has-error" : ""}`}>
                  <Bike size={19}/>
                  <select id="rider-vehicle" name="vehicleType" value={formData.vehicleType} onChange={handleChange} required>
                    
                    <option value="Motorcycle">
                      Motorcycle
                    </option>

                    <option value="Bicycle">
                      Bicycle
                    </option>

                    <option value="Scooter">
                      Scooter
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>
                </div>

                {errors.vehicleType && (
                  <span className="rider-profile-error">
                    {errors.vehicleType}
                  </span>
                )}
              </div>

            </div>

            {/* Form Actions */}
            <div className="rider-profile-actions">
              <button type="button" className="rider-profile-reset-btn" onClick={handleReset} disabled={saving}>
                <RotateCcw size={17}/>
                Reset
              </button>

              <button type="submit" className="rider-profile-save-btn" disabled={saving}>
                {saving ? (
                  <>
                    <span className="rider-profile-button-spinner"/>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18}/>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="rider-profile-card rider-bank-card">
          <div className="rider-profile-card-heading">
            <div>

              <h2>
                <Landmark size={22}/>
                Bank Account Details
              </h2>

              <p>Manage your bank details for rider earnings payouts.</p>

            </div>
          </div>

          {bankLoading ? (
            <p className="rider-bank-loading">
              Loading bank details...
            </p>
          ) : (
            <form onSubmit={handleBankSubmit} noValidate>
              <div className="rider-profile-form-grid">
                
                {/* Bank Name */}
                <div className="rider-profile-field">
                  <label htmlFor="rider-bank-name">
                    Bank Name
                  </label>

                  <div className="rider-profile-input-wrap">
                    <Landmark size={19}/>
                    <input id="rider-bank-name" type="text" name="bankName" placeholder="Enter bank name" value={bankForm.bankName} onChange={handleBankChange} maxLength={100} required/>
                  </div>
                </div>

                {/* Account Holder */}
                <div className="rider-profile-field">
                  <label htmlFor="rider-account-holder">
                    Account Holder Name
                  </label>

                  <div className="rider-profile-input-wrap">
                    <UserRound size={19}/>
                    <input id="rider-account-holder" type="text" name="accountHolderName" placeholder="Name on bank account" value={bankForm.accountHolderName} onChange={handleBankChange} maxLength={100} required/>
                  </div>
                </div>

                {/* Account Number */}
                <div className="rider-profile-field">
                  <label htmlFor="rider-account-number">
                    Account Number
                  </label>

                  <div className="rider-profile-input-wrap">
                    <CreditCard size={19}/>
                    <input id="rider-account-number" type="text" name="accountNumber" inputMode="numeric" autoComplete="off" placeholder={bankInfo?.hasAccountNumber ? "Enter a new number to change" : "Enter account number"} value={bankForm.accountNumber} onChange={handleBankChange} maxLength={20}/>
                  </div>

                  {bankInfo?.hasAccountNumber && (
                    <span className="rider-profile-hint">
                      Current account: {bankInfo.maskedAccountNumber}
                    </span>
                  )}
                </div>

                {/* Branch */}
                <div className="rider-profile-field">
                  <label htmlFor="rider-bank-branch">
                    Bank Branch
                  </label>

                  <div className="rider-profile-input-wrap">
                    <Building2 size={19}/>
                    <input id="rider-bank-branch" type="text" name="branchName" placeholder="Enter bank branch" value={bankForm.branchName} onChange={handleBankChange} maxLength={100} required/>
                  </div>
                </div>

              </div>

              <div className="rider-profile-actions">
                <button type="submit" className="rider-profile-save-btn" disabled={bankSaving}>
                  {bankSaving ? (
                    "Saving Bank Details..."
                  ) : (
                    <>
                      <Save size={18}/>
                      Save Bank Details
                    </>
                  )}
                </button>
              </div>

              <p className="rider-bank-security-note">
                <ShieldCheck size={16}/>
                Your account number is stored encrypted and displayed only in masked form.
              </p>
            </form>
          )}
        </section>

        <p className="rider-profile-footer-note">Make sure your phone number is correct so you can be contacted about your deliveries.</p>
      </div>
    </main>
  );
}

export default Profile;