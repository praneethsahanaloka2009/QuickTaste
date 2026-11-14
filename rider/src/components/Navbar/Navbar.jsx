import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.svg";
import { LayoutDashboard, Package, Wallet, UserRound, LogOut, Menu, X } from "lucide-react";
import { useRider } from "../../context/RiderContext.jsx";
import "./Navbar.css";

function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    const { rider, logout } = useRider();
    const navigate = useNavigate();

    const handleLogout = () => {
        setMenuOpen(false);
        logout();
        navigate("/login", { replace: true });
    };

    return (
        <header className="rider-navbar">
            <div className="rider-navbar-container">

                {/* Brand Logo */}
                <NavLink to="/dashboard" className="rider-navbar-brand" onClick={() => setMenuOpen(false)}>
                  <img src={logo} alt="QuickTaste Logo" className="rider-brand-logo" />
                </NavLink>

                {/* Navigation Links */}
                <nav className={`rider-navbar-links ${menuOpen ? "rider-navbar-links-open" : ""}`}>
                  {/* Dashboard */}
                  <NavLink to="/dashboard" className={({ isActive }) => `rider-nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                      <LayoutDashboard size={19}/>
                      <span>Dashboard</span>
                  </NavLink>

                  {/* My Deliveries */}
                  <NavLink to="/orders" className={({ isActive }) =>`rider-nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                      <Package size={19}/>
                      <span>My Deliveries</span>
                  </NavLink>

                  {/* Earnings */}
                  <NavLink to="/earnings" className={({ isActive }) => `rider-nav-link ${isActive ? "active" : ""}` } onClick={() => setMenuOpen(false)}>
                      <Wallet size={19}/>
                      <span>Earnings</span>
                  </NavLink>

                  {/* Profile */}
                  <NavLink to="/profile" className={({ isActive }) => `rider-nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                      <UserRound size={19} />
                      <span>Profile</span>
                  </NavLink>

                  {/* Mobile Logout */}
                  <button type="button" className="rider-mobile-logout" onClick={handleLogout}>
                      <LogOut size={19} />
                      <span>Logout</span>
                  </button>
                </nav>

                {/* Rider Information */}
                <div className="rider-navbar-right">

                    <div className="rider-navbar-user">
                        <div className="rider-user-avatar">
                            {rider?.avatar ? (
                                <img src={rider.avatar.startsWith("http") ? rider.avatar : `http://localhost:4911${rider.avatar}`} alt="Rider"/>
                            ) : (
                                <UserRound size={21} />
                            )}
                        </div>

                        <div className="rider-user-details">
                            <span className="rider-user-name">
                                {rider?.name || "Rider"}
                            </span>

                            <span className="rider-user-role">
                                Delivery Partner
                            </span>
                        </div>
                    </div>

                    {/* Desktop Logout */}
                    <button type="button" className="rider-logout-button" onClick={handleLogout} aria-label="Logout" title="Logout">
                        <LogOut size={19} />
                    </button>
                </div>

                {/* Mobile Menu Toggle */}
                <button type="button" className="rider-menu-toggle" onClick={() => setMenuOpen((previous) => !previous)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>
                    {menuOpen ? (
                      <X size={25} />
                    ) : (
                      <Menu size={25} />
                    )}
                </button>

            </div>
        </header>
    );
}

export default Navbar;
