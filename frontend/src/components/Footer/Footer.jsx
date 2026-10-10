import React from 'react'
import './Footer.css'
import { assets } from '../../assets/assets'
import { Link } from 'react-router-dom'

const Footer = () => {
  return (
    <div className='footer' id='footer'>
      <div className="footer-content">
        <div className="footer-content-left">
            <Link to="/"><img src={assets.logo} alt="" /></Link>
            <p>Welcome to our food delivery platform! We offer a wide variety of delicious meals made with fresh ingredients. Order your favorite food online and enjoy fast, reliable delivery right to your doorstep.</p>
            <div className="footer-social-icons">
                <img src={assets.facebook_icon} alt=""/>
                <img src={assets.twitter_icon} alt=""/>
                <img src={assets.linkedin_icon} alt=""/>
            </div>
        </div>
        <div className="footer-content-center">
            <h2>COMPANY</h2>
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/about">About Us</Link></li>
                <li>Delivery</li>
                <li>
                    <Link to="/privacy-policy">Privacy Policy</Link>
                </li>
            </ul>
        </div>
        <div className="footer-content-right">
            <h2>GET IN TOUCH</h2>
            <ul>
                <li><a href="tel:+94788152026">+94 78 815 2026</a></li>
                <li><a href="https://mail.google.com/mail/?view=cm&fs=1&to=praneethsahanalokadon2009@gmail.com" target="_blank">praneethsahanalokadon2009@gmail.com</a></li>
            </ul>
        </div>
      </div>
      <hr />
      <p className="footer-copyright">Copyright 2026 © QuickTaste.com - All Right Reserved</p>
    </div>
  )
}

export default Footer
