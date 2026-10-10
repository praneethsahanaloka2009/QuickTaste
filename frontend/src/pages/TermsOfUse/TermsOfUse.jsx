import React from 'react'
import { Link } from 'react-router-dom'
import './TermsOfUse.css'

const TermsOfUse = ({ setShowLogin }) => {
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
                    Please read these terms carefully before using QuickTaste
                    and placing an order through our platform.
                </p>
                <small>Last Updated: September 30, 2026</small>
            </div>


            <div className="terms-content">

                <aside className="terms-sidebar">

                    <h3>On this page</h3>

                    <a href="#introduction">Introduction</a>
                    <a href="#using-quicktaste">Using QuickTaste</a>
                    <a href="#accounts">User Accounts</a>
                    <a href="#orders">Orders and Payments</a>
                    <a href="#delivery">Delivery</a>
                    <a href="#cancellations">Cancellations and Refunds</a>
                    <a href="#user-responsibilities">User Responsibilities</a>
                    <a href="#content">Website Content</a>
                    <a href="#privacy">Privacy</a>
                    <a href="#changes">Changes to These Terms</a>
                    <a href="#contact">Contact Us</a>

                </aside>


                <main className="terms-main">

                    <section id="introduction" className="terms-section">
                        <h2>Introduction</h2>

                        <p>
                            Welcome to QuickTaste. These Terms of Use explain
                            the rules and conditions that apply when you use
                            our website, services, and food delivery platform.
                        </p>

                        <p>
                            By accessing or using QuickTaste, you agree to
                            follow these terms. If you do not agree with any
                            part of these terms, please do not use our
                            services.
                        </p>
                    </section>


                    <section id="using-quicktaste" className="terms-section">
                        <h2>Using QuickTaste</h2>

                        <p>
                            QuickTaste provides an online platform that allows
                            customers to browse food items, place orders,
                            make payments, and receive food deliveries.
                        </p>

                        <p>
                            You agree to use the website only for lawful
                            purposes and in a way that does not interfere
                            with the operation or security of the platform.
                        </p>
                    </section>


                    <section id="accounts" className="terms-section">
                        <h2>User Accounts</h2>

                        <p>
                            Some QuickTaste features may require you to create
                            an account. You are responsible for providing
                            accurate information when creating your account.
                        </p>

                        <p>
                            You are also responsible for keeping your account
                            credentials secure and for activities performed
                            through your account.
                        </p>
                    </section>


                    <section id="orders" className="terms-section">
                        <h2>Orders and Payments</h2>

                        <p>
                            When you place an order through QuickTaste, you
                            are responsible for checking your selected food
                            items, quantities, delivery details, and order
                            information before completing the order.
                        </p>

                        <p>
                            Prices and availability of food items may change
                            from time to time. Payment must be completed using
                            the payment methods available on the platform.
                        </p>
                    </section>


                    <section id="delivery" className="terms-section">
                        <h2>Delivery</h2>

                        <p>
                            QuickTaste aims to provide reliable and timely
                            delivery services. Delivery times may vary
                            depending on restaurant preparation time, traffic,
                            weather, location, and other circumstances.
                        </p>

                        <p>
                            Customers are responsible for providing a correct
                            delivery address and being available to receive
                            their orders.
                        </p>
                    </section>


                    <section id="cancellations" className="terms-section">
                        <h2>Cancellations and Refunds</h2>

                        <p>
                            Order cancellation and refund availability may
                            depend on the status of the order and the
                            circumstances of the request.
                        </p>

                        <p>
                            Where applicable, refunds will be processed
                            according to the relevant QuickTaste refund
                            procedures and payment provider requirements.
                        </p>
                    </section>


                    <section id="user-responsibilities" className="terms-section">
                        <h2>User Responsibilities</h2>

                        <p>
                            When using QuickTaste, you agree not to misuse the
                            platform, attempt to gain unauthorized access,
                            provide false information, or interfere with the
                            website or its services.
                        </p>

                        <p>
                            You should also ensure that the information you
                            provide, including your contact and delivery
                            details, is accurate and up to date.
                        </p>
                    </section>


                    <section id="content" className="terms-section">
                        <h2>Website Content</h2>

                        <p>
                            QuickTaste may contain food descriptions, images,
                            logos, graphics, text, and other content. This
                            content is provided for use on the QuickTaste
                            platform and should not be copied, reproduced, or
                            distributed without appropriate permission.
                        </p>
                    </section>


                    <section id="privacy" className="terms-section">
                        <h2>Privacy</h2>

                        <p>
                            Your use of QuickTaste is also subject to our
                            Privacy Policy, which explains how information
                            may be collected, used, and protected.
                        </p>

                        <p>
                            You can read our Privacy Policy here:
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
                            to time to reflect changes to our services,
                            features, or legal requirements.
                        </p>

                        <p>
                            Updated terms will be published on this page. We
                            encourage users to review this page periodically.
                        </p>
                    </section>


                    <section id="contact" className="terms-section">
                        <h2>Contact Us</h2>

                        <p>
                            If you have any questions about these Terms of Use,
                            you can contact us through our Contact Us page.
                        </p>

                        <Link
                            to="/contact"
                            className="terms-contact-link"
                        >
                            Contact QuickTaste
                        </Link>
                    </section>

                </main>

            </div>

        </div>
    )
}

export default TermsOfUse