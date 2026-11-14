import React, { useRef, useState, useEffect } from "react";
import "./Navbar.css";
import { assets } from "../../assets/assets";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

const API_URL = "http://localhost:4911";

const Navbar = ({ setShowAuth, isLoggedIn, setIsLoggedIn }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [profileImage, setProfileImage] = useState(localStorage.getItem("adminAvatar") || "");
  const [adminName, setAdminName] = useState(localStorage.getItem("adminName") || "");
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  const getAdminToken = () => localStorage.getItem("adminToken");

  // Load admin profile from backend
  useEffect(() => {
    const loadAdminProfile = async () => {
      const token = getAdminToken();

      if(!token || !isLoggedIn){
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/admin/profile`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if(!response.ok || !data.success){
          if(response.status === 401){
            toast.error("Please sign in again.");
          }
          return;
        }

        const admin = data.admin;

        setAdminName(admin.name || "");
        setProfileImage(admin.avatar || "");

        localStorage.setItem("adminName", admin.name || "");

        if(admin.avatar){
          localStorage.setItem("adminAvatar", admin.avatar);
        } else {
          localStorage.removeItem("adminAvatar");
        }
      } catch (error) {
        console.error("Load admin profile error:", error);
      }
    };

    loadAdminProfile();
  },[isLoggedIn]);

  // Logout admin
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminAvatar");
    localStorage.removeItem("adminName");

    setProfileImage("");
    setAdminName("");
    setIsLoggedIn(false);
    setShowMenu(false);
  };

  // Open file selector
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Upload or change profile picture
  const handleProfilePicture = async (event) => {
    const file = event.target.files?.[0];

    if(!file){
      return;
    }

    if(!file.type.startsWith("image/")){
      toast.error("Please select an image file.");
      event.target.value = "";
      return;
    }

    if(file.size > 5 * 1024 * 1024){
      toast.error("Image size must be less than 5MB.");
      event.target.value = "";
      return;
    }

    const token = getAdminToken();

    if(!token){
      toast.error("Please sign in again.");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch(
        `${API_URL}/api/admin/profile-picture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      );

      const data = await response.json();

      if(!response.ok || !data.success) {
        toast.error(
          data.message || "Failed to upload profile picture."
        );
        return;
      }

      const admin = data.admin || {};
      const image = admin.avatar || data.avatar || "";

      if(!image){
        toast.error("Image path was not returned by the server.");
        return;
      }

      const name = admin.name || adminName;

      setAdminName(name);
      setProfileImage(image);

      localStorage.setItem("adminName", name);
      localStorage.setItem("adminAvatar", image);

      setShowMenu(false);

      toast.success("Profile picture updated successfully!");
    } catch (error) {
      console.error("Admin profile upload error:", error);
      toast.error("Could not upload the profile picture.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // Remove profile picture
  const handleRemoveProfilePicture = async () => {
    const token = getAdminToken();

    if(!token){
      toast.error("Please sign in again.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/admin/profile-picture`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if(!response.ok || !data.success){
        toast.error(
          data.message || "Failed to remove profile picture."
        );
        return;
      }

      setProfileImage("");
      localStorage.removeItem("adminAvatar");

      if(data.admin?.name){
        setAdminName(data.admin.name);
        localStorage.setItem("adminName", data.admin.name);
      }

      setShowMenu(false);

      toast.success("Profile picture removed successfully!");
    } catch (error) {
      console.error("Admin profile removal error:", error);
      toast.error("Could not remove the profile picture.");
    }
  };

  // Profile image URL
  const imageUrl = profileImage ? profileImage.startsWith("http") ? profileImage : `${API_URL}/images/${profileImage}` : "";

  // First letter of admin name
  const adminInitial = adminName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className="navbar">
      <Link to="/dashboard"><img src={assets.logo} alt="QuickTaste" className="logo"/></Link>

      {!isLoggedIn ? (
        <button type="button" className="login-button" onClick={() => setShowAuth(true)}>
          Sign In
        </button>
      ) : (
        <div className="profile-container">
          <button type="button" className="admin-profile-trigger" onClick={() => setShowMenu((previous) => !previous)} aria-label="Toggle profile menu" aria-expanded={showMenu}>
            {profileImage ? (
              <img src={imageUrl} className="profile" alt="Admin profile"/>
            ) : (
              <span className="profile profile-letter">
                {adminInitial}
              </span>
            )}
          </button>

          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleProfilePicture} style={{ display: "none" }}/>

          {showMenu && (
            <>
              <button type="button" className="admin-profile-backdrop" aria-label="Close profile menu" onClick={() => setShowMenu(false)}/>

              <div className="profile-menu">
                {!profileImage ? (
                  <button type="button" onClick={handleUploadClick} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload Profile Picture"}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={handleUploadClick} disabled={uploading}>
                      {uploading ? "Uploading..." : "Change Profile Picture"}
                    </button>

                    <button type="button" onClick={handleRemoveProfilePicture}>
                      Remove Profile Picture
                    </button>
                  </>
                )}

                <button type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Navbar;