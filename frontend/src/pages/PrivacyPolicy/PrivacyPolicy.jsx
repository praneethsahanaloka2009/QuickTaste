
import React from 'react'
import { Link } from 'react-router-dom'
import './PrivacyPolicy.css'

const PrivacyPolicy = () => {
  return (
    <div className="privacy-policy">

      {/* Breadcrumb */}
      <div className="privacy-breadcrumb">
        <Link to="/">Home</Link>
        <Link to="/" className="breadcrumb-slash"> / </Link>
        <span>Privacy Policy</span>
      </div>

      {/* Hero Section */}
      <div className="privacy-hero">
        <span className="privacy-label">YOUR PRIVACY MATTERS</span>
        <h1>Privacy Policy</h1>
        <p>How we collect, use, and protect your information</p>
        <span className="privacy-date">
          Last Updated: September 30, 2026
        </span>
      </div>

      {/* Main Content */}
      <div className="privacy-layout">

        {/* Table of Contents */}
        <aside className="privacy-sidebar">
          <h3>On this page</h3>
          <a href="#introduction">Introduction</a>
          <a href="#information">Information We Collect</a>
          <a href="#usage">How We Use Your Information</a>
          <a href="#protection">Data Protection</a>
          <a href="#cookies">Cookies</a>
          <a href="#sharing">Sharing of Information</a>
          <a href="#rights">Your Privacy Rights</a>
          <a href="#changes">Policy Changes</a>
          <a href="#contact">Contact Us</a>
        </aside>

        {/* Policy Content */}
        <main className="privacy-content">

          <section id="introduction">
            <h2>Introduction</h2>
            <p>
              Welcome to our Food Delivery Website. We value your
              privacy and are committed to protecting your personal
              information. This Privacy Policy explains how we
              collect, use, and manage your information when you
              use our website and services.
            </p>
          </section>

          <section id="information">
            <h2>1. Information We Collect</h2>
            <p>
              When you use our website, we may collect the following
              information:
            </p>
            <ul>
              <li>Your name and contact details, such as email and phone number.</li>
              <li>Your delivery address and order information.</li>
              <li>Account information that you provide when registering.</li>
              <li>Basic website usage information to improve our services.</li>
            </ul>
          </section>

          <section id="usage">
            <h2>2. How We Use Your Information</h2>
            <p>
              We use the information we collect for purposes such as:
            </p>
            <ul>
              <li>Processing and managing your food orders.</li>
              <li>Delivering your orders to the correct address.</li>
              <li>Communicating with you about your orders.</li>
              <li>Improving our website and customer experience.</li>
              <li>Maintaining the security of our services.</li>
            </ul>
          </section>

          <section id="protection">
            <h2>3. Data Protection</h2>
            <p>
              We take reasonable steps to protect your personal
              information against unauthorized access, loss, misuse,
              or disclosure. However, no method of online transmission
              or electronic storage is completely secure.
            </p>
          </section>

          <section id="cookies">
            <h2>4. Cookies</h2>
            <p>
              Our website may use cookies and similar technologies
              to remember preferences, understand website usage,
              and improve your browsing experience. You can manage
              cookies through your browser settings.
            </p>
          </section>

          <section id="sharing">
            <h2>5. Sharing of Information</h2>
            <p>
              We may share the information necessary to fulfill your
              order with delivery personnel and service providers.
              We may also disclose information when required by law.
            </p>
          </section>

          <section id="rights">
            <h2>6. Your Privacy Rights</h2>
            <p>
              Depending on applicable law, you may have the right
              to request access to, correction of, or deletion of
              your personal information. You can contact us with
              any privacy-related request.
            </p>
          </section>

          <section id="changes">
            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time.
              Any changes will be posted on this page along with
              the updated date.
            </p>
          </section>

          <section id="contact">
            <h2>8. Contact Us</h2>
            <p>
              If you have any questions or concerns about this
              Privacy Policy, please contact us through our
              website's contact section.
            </p>
          </section>

          {/* Closing Note */}
          <div className="privacy-note">
            <h3>Your Privacy Matters to Us</h3>
            <p>
              Thank you for trusting us with your information
              and choosing our food delivery service.
            </p>
          </div>

        </main>
      </div>
    </div>
  )
}

export default PrivacyPolicy