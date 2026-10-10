import React from 'react'
import './MobileApp.css'
import { assets } from '../../assets/assets'

const MobileApp = () => {
  return (
    <div className="mobile-app-page">

      <div className="mobile-app-container">
        <div className="mobile-app-content">
          <p className="mobile-app-subtitle">DOWNLOAD OUR APP</p>

          <h1>Get the Best Experience<br />with Our Mobile App</h1>

          <p className="mobile-app-description">Order your favorite food quickly and easily with our mobile app. Browse our menu, place your order, and enjoy a seamless experience wherever you are.</p>

          <div className="mobile-app-platforms">
            <img src={assets.play_store} alt="Get it on Google Play"/>
            <img src={assets.app_store} alt="Download on the App Store"/>
          </div>
        </div>

        <div className="mobile-app-image">
          <video src={assets.mobile_app_video} autoPlay muted loop playsInline/>
        </div>

      </div>

    </div>
  )
}

export default MobileApp