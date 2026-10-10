import React from 'react'
import { Link } from 'react-router-dom'
import './TermsOfUse.css'

const TermsOfUse = () => {
    return (
        <div className="terms-of-use">

            <div className="terms-breadcrumb">
                <Link to="/">Home</Link>
                <span>/</span>
                <p>Terms of Use</p>
            </div>


            <div className="terms-hero">

                <span>PLEASE READ CAREFULLY</span>

                <h1>Terms of Use</h1>

                <p>
                    Please read these terms carefully before accessing and
                    using the QuickTaste Admin Panel.
                </p>

                <small>Last Updated: October 2, 2026</small>

            </div>


            <div className="terms-content">

                <aside className="terms-sidebar">

                    <h3>On this page</h3>

                    <a href="#introduction">Introduction</a>
                    <a href="#admin-access">Admin Access</a>
                    <a href="#admin-account">Admin Account</a>
                    <a href="#dashboard">Admin Dashboard</a>
                    <a href="#customer-data">Customer Data</a>
                    <a href="#orders">Orders and Management</a>
                    <a href="#security">Security</a>
                    <a href="#responsibilities">Admin Responsibilities</a>
                    <a href="#content">Admin Content</a>
                    <a href="#privacy">Privacy</a>
                    <a href="#changes">Changes to These Terms</a>
                    <a href="#contact">Contact Us</a>

                </aside>


                <main className="terms-main">


                    <section id="introduction" className="terms-section">

                        <h2>Introduction</h2>

                        <p>
                            Welcome to the QuickTaste Admin Panel. These Terms
                            of Use explain the rules and conditions that apply
                            when accessing and using the administrative
                            features of the QuickTaste platform.
                        </p>

                        <p>
                            By accessing the Admin Panel, you agree to follow
                            these terms and use the available administrative
                            features responsibly and securely.
                        </p>

                    </section>


                    <section id="admin-access" className="terms-section">

                        <h2>Admin Access</h2>

                        <p>
                            Access to the QuickTaste Admin Panel is intended
                            for authorized administrators and staff members
                            who are permitted to manage the platform.
                        </p>

                        <p>
                            You must not attempt to access the Admin Panel
                            without appropriate authorization or attempt to
                            bypass its authentication and security measures.
                        </p>

                    </section>


                    <section id="admin-account" className="terms-section">

                        <h2>Admin Account</h2>

                        <p>
                            Administrators may be required to create an
                            account to access the Admin Panel. You are
                            responsible for providing accurate account
                            information during registration.
                        </p>

                        <p>
                            You are responsible for keeping your login
                            credentials confidential and for all activities
                            performed through your administrator account.
                        </p>

                    </section>


                    <section id="dashboard" className="terms-section">

                        <h2>Admin Dashboard</h2>

                        <p>
                            The Admin Panel may provide features for managing
                            food items, customers, orders, customer messages,
                            and other QuickTaste platform information.
                        </p>

                        <p>
                            Administrators should only use dashboard features
                            for legitimate QuickTaste management and
                            operational purposes.
                        </p>

                    </section>


                    <section id="customer-data" className="terms-section">

                        <h2>Customer Data</h2>

                        <p>
                            Administrators may have access to information
                            provided by QuickTaste customers, including
                            account, order, contact, and delivery-related
                            information.
                        </p>

                        <p>
                            Customer information must be handled responsibly
                            and should only be accessed or used when necessary
                            for authorized QuickTaste operations.
                        </p>

                    </section>


                    <section id="orders" className="terms-section">

                        <h2>Orders and Management</h2>

                        <p>
                            The Admin Panel may allow authorized administrators
                            to view and manage customer orders and related
                            information.
                        </p>

                        <p>
                            Administrators should ensure that changes made to
                            orders or other operational information are
                            accurate and appropriate for the relevant
                            QuickTaste service.
                        </p>

                    </section>


                    <section id="security" className="terms-section">

                        <h2>Security</h2>

                        <p>
                            Administrators are responsible for protecting
                            their login credentials and preventing unauthorized
                            access to their accounts.
                        </p>

                        <p>
                            You must not attempt to interfere with the
                            security, authentication, database, or technical
                            systems supporting the QuickTaste Admin Panel.
                        </p>

                    </section>


                    <section id="responsibilities" className="terms-section">

                        <h2>Admin Responsibilities</h2>

                        <p>
                            Administrators are expected to use the Admin Panel
                            responsibly and only for authorized QuickTaste
                            activities.
                        </p>

                        <p>
                            Administrators must not intentionally misuse,
                            modify, disclose, or delete platform information
                            without appropriate authorization.
                        </p>

                    </section>


                    <section id="content" className="terms-section">

                        <h2>Admin Content</h2>

                        <p>
                            The Admin Panel may allow authorized administrators
                            to create, update, or manage food information,
                            descriptions, prices, images, and other platform
                            content.
                        </p>

                        <p>
                            Administrators should ensure that information
                            added or updated through the Admin Panel is
                            accurate and appropriate for the QuickTaste
                            platform.
                        </p>

                    </section>


                    <section id="privacy" className="terms-section">

                        <h2>Privacy</h2>

                        <p>
                            Information accessed through the Admin Panel may
                            include personal information belonging to
                            QuickTaste customers and other users.
                        </p>

                        <p>
                            The handling and protection of personal information
                            is also subject to the QuickTaste Privacy Policy.
                        </p>

                        <Link
                            to="/privacy-policy"
                            className="terms-privacy-link"
                        >
                            View Privacy Policy
                        </Link>

                    </section>


                    <section id="changes" className="terms-section">

                        <h2>Changes to These Terms</h2>

                        <p>
                            QuickTaste may update these Terms of Use from time
                            to time to reflect changes to the Admin Panel,
                            services, features, or applicable requirements.
                        </p>

                        <p>
                            Updated terms will be published on this page.
                            Administrators are encouraged to review this page
                            periodically.
                        </p>

                    </section>


                    <section id="contact" className="terms-section">

                        <h2>Contact Us</h2>

                        <p>
                            If you have questions about these Terms of Use or
                            your access to the QuickTaste Admin Panel, please
                            contact the appropriate QuickTaste administrator
                            or support team.
                        </p>

                        <Link
                            to="/"
                            className="terms-contact-link"
                        >
                            Back to Admin Panel
                        </Link>

                    </section>


                </main>

            </div>

        </div>
    )
}

export default TermsOfUse