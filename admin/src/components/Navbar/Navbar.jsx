import React, { useState } from 'react'
import './Navbar.css'
import { assets } from '../../assets/assets'
import { Link } from 'react-router-dom'

const Navbar = ({ setShowAuth, isLoggedIn, setIsLoggedIn }) => {

  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem("adminToken")
    setIsLoggedIn(false)
    setShowMenu(false)
  }

  return (
    <div className="navbar">
      <Link to="/"><img src={assets.logo} alt="" className='logo'/></Link>

      {!isLoggedIn ? (
        <button className='login-button' onClick={() => setShowAuth(true)}>
          Sign In
        </button>
      ) : (
        <div className="profile-container">
          <img src={assets.profile_image} className='profile' alt="Profile" onClick={() => setShowMenu(!showMenu)}/>
          {showMenu && (
            <div className="profile-menu">
              <button onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Navbar