import React from 'react'
import { Link } from 'react-router-dom'
import './About.css'

const About = () => {
  return (
    <div className="about-page">

      {/* Breadcrumb */}
      <div className="about-breadcrumb">
        <Link to="/">Home</Link>
        <span className="breadcrumb-slash">/</span>
        <span>About Us</span>
      </div>

      {/* Hero Section */}
      <div className="about-hero">

        <span className="about-label">
          ABOUT OUR FOOD DELIVERY SERVICE
        </span>

        <h1>About Us</h1>

        <p>Making delicious food accessible, convenient, and enjoyable for everyone.</p>

      </div>

      {/* About Cards */}
      <div className="about-cards">

        <div className="about-card">
          <h2>Who We Are</h2>

          <p>Welcome to our Food Delivery Website. We are a food delivery platform created to make ordering delicious meals simple, convenient, and enjoyable. Our platform allows customers to explore a variety of dishes and place their orders easily from the comfort of their home.</p>

          <p>We focus on providing a smooth online ordering experience while helping customers discover meals that suit their preferences.</p>
        </div>


        <div className="about-card">

          <h2>Our Mission</h2>

          <p>
            Our mission is to make food ordering easier and more convenient
            for our customers. We aim to provide a simple platform where
            customers can explore the menu, select their favourite meals,
            and place orders with ease.
          </p>

        </div>


        <div className="about-card">
          <h2>What We Offer</h2>
          <ul>
            <li>A diverse selection of delicious meals.</li>
            <li>Simple and convenient online food ordering.</li>
            <li>An easy-to-use website experience.</li>
            <li>Order management and delivery support.</li>
            <li>A convenient way to enjoy your favourite meals.</li>
          </ul>
        </div>


        <div className="about-card">
          <h2>Why Choose Us</h2>
          <p>We aim to provide a convenient and user-friendly food ordering experience. From exploring our menu to placing an order, our platform is designed to make the process simple and enjoyable.</p>
        </div>

      </div>

      {/* Closing Note */}
      <div className="about-note">

        <h3>Thank You for Choosing Us</h3>

        <p>We appreciate your trust and look forward to making your food ordering experience enjoyable.</p>

      </div>

    </div>
  )
}

export default About