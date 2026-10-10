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

        <p>
          How QuickTaste collects, uses, and protects information
          within the Admin Panel
        </p>

        <span className="privacy-date">
          Last Updated: October 2, 2026
        </span>
      </div>

      {/* Main Content */}
      <div className="privacy-layout">

        {/* Table of Contents */}
        <aside className="privacy-sidebar">

          <h3>On this page</h3>

          <a href="#introduction">Introduction</a>
          <a href="#information">Information We Collect</a>
          <a href="#usage">How We Use Information</a>
          <a href="#admin-data">Admin Account Data</a>
          <a href="#customer-data">Customer Data</a>
          <a href="#protection">Data Protection</a>
          <a href="#sharing">Sharing of Information</a>
          <a href="#rights">Privacy Rights</a>
          <a href="#changes">Policy Changes</a>
          <a href="#contact">Contact Us</a>

        </aside>

        {/* Policy Content */}
        <main className="privacy-content">

          <section id="introduction">
            <h2>Introduction</h2>

            <p>
              Welcome to the QuickTaste Admin Panel. We respect the
              privacy of administrators, staff members, customers,
              and other individuals whose information may be accessed
              through the administration system.
            </p>

            <p>
              This Privacy Policy explains how information may be
              collected, used, accessed, stored, and protected when
              using the QuickTaste Admin Panel.
            </p>
          </section>

          <section id="information">
            <h2>1. Information We Collect</h2>

            <p>
              Depending on how the Admin Panel is used, QuickTaste
              may collect or process the following types of information:
            </p>

            <ul>
              <li>
                Administrator account information such as name,
                email address, and login details.
              </li>

              <li>
                Information related to customers, orders, and
                deliveries managed through the Admin Panel.
              </li>

              <li>
                Food item information, including names, prices,
                descriptions, categories, and images.
              </li>

              <li>
                Customer messages and other information submitted
                through the QuickTaste platform.
              </li>

              <li>
                Basic technical and system information required
                to operate and secure the Admin Panel.
              </li>
            </ul>
          </section>

          <section id="usage">
            <h2>2. How We Use Information</h2>

            <p>
              Information accessed or processed through the Admin
              Panel may be used for purposes such as:
            </p>

            <ul>
              <li>
                Managing administrator accounts and access.
              </li>

              <li>
                Managing food items, products, prices, and categories.
              </li>

              <li>
                Processing and managing customer orders.
              </li>

              <li>
                Reviewing customer messages and service requests.
              </li>

              <li>
                Managing delivery and order-related information.
              </li>

              <li>
                Maintaining the security and proper operation of
                the QuickTaste platform.
              </li>
            </ul>
          </section>

          <section id="admin-data">
            <h2>3. Admin Account Data</h2>

            <p>
              Information provided when creating or using an
              administrator account may be used to authenticate
              authorized administrators and provide access to
              appropriate Admin Panel features.
            </p>

            <p>
              Administrator login credentials should be kept
              confidential and should not be shared with unauthorized
              individuals.
            </p>
          </section>

          <section id="customer-data">
            <h2>4. Customer Data</h2>

            <p>
              Authorized administrators may have access to customer
              information required to manage QuickTaste services.
              This may include customer names, contact details,
              delivery information, order details, and messages.
            </p>

            <p>
              Customer information should only be accessed and used
              for legitimate QuickTaste administrative and operational
              purposes.
            </p>
          </section>

          <section id="protection">
            <h2>5. Data Protection</h2>

            <p>
              We take reasonable measures to protect information
              handled through the Admin Panel against unauthorized
              access, misuse, loss, alteration, or disclosure.
            </p>

            <p>
              Security measures may include authentication,
              access controls, secure data storage, and other
              appropriate technical and organizational measures.
              However, no method of electronic storage or online
              transmission can be guaranteed to be completely secure.
            </p>
          </section>

          <section id="sharing">
            <h2>6. Sharing of Information</h2>

            <p>
              Information may be shared with authorized QuickTaste
              staff members, service providers, delivery personnel,
              or other parties when necessary to operate and provide
              QuickTaste services.
            </p>

            <p>
              Information may also be disclosed where required or
              permitted by applicable law.
            </p>
          </section>

          <section id="rights">
            <h2>7. Privacy Rights</h2>

            <p>
              Depending on applicable law, individuals may have
              certain rights regarding their personal information,
              including the right to request access to, correction
              of, or deletion of their information.
            </p>

            <p>
              Privacy-related requests can be submitted through
              the appropriate QuickTaste support or contact channel.
            </p>
          </section>

          <section id="changes">
            <h2>8. Changes to This Policy</h2>

            <p>
              We may update this Privacy Policy from time to time
              to reflect changes to the QuickTaste Admin Panel,
              services, security practices, or applicable requirements.
            </p>

            <p>
              Any updates will be published on this page together
              with the updated date.
            </p>
          </section>

          <section id="contact">
            <h2>9. Contact Us</h2>

            <p>
              If you have questions or concerns about this Privacy
              Policy or the handling of information within the
              QuickTaste Admin Panel, please contact the appropriate
              QuickTaste administrator or support team.
            </p>
          </section>

          {/* Closing Note */}
          <div className="privacy-note">

            <h3>Your Privacy Matters to Us</h3>

            <p>
              We are committed to handling administrator and customer
              information responsibly and protecting the information
              entrusted to the QuickTaste platform.
            </p>

          </div>

        </main>
      </div>
    </div>
  )
}

export default PrivacyPolicy