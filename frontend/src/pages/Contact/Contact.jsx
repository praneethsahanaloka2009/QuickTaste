import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import './Contact.css'
import { toast } from 'react-toastify'

const Contact = () => {

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async (event) => {

    event.preventDefault()

    try {
      
      const endpoint = "http://localhost:4911/api/message/add"
      const response = await fetch(endpoint, {
        method : "POST",
        headers : {
          "Content-Type" : "application/json"
        },
        body : JSON.stringify({
          name, email, subject, message
        })
      })

      const data = await response.json()

      if(data.success){

        toast.success("Message sent successfully!")

        setName("")
        setEmail("")
        setSubject("")
        setMessage("")

      } else {

        toast.error(data.message)

      }

    } catch (error) {
      console.log("Message Error:", error)
      toast.error("Something went wrong. Please try again.")
    }

  }

  return (
    <div className="contact-page">

      {/* Breadcrumb */}
      <div className="contact-breadcrumb">
        <Link to="/">Home</Link>
        <span className="breadcrumb-slash"> / </span>
        <span>Contact Us</span>
      </div>

      {/* Hero Section */}
      <div className="contact-hero">
        <span className="contact-label">WE ARE HERE TO HELP</span>

        <h1>Contact Us</h1>

        <p>
          Have a question or need assistance? Get in touch with us.
        </p>
      </div>

      {/* Contact Content */}
      <div className="contact-layout">

        {/* Contact Information */}
        <div className="contact-info">

          <h2>Get in Touch</h2>

          <p className="contact-intro">
            We would love to hear from you. If you have any questions,
            feedback, or need assistance with your order, feel free to
            contact us using the information below.
          </p>

          <div className="contact-info-list">

            <div className="contact-info-item">
              <div className="contact-icon">📍</div>

              <div>
                <h3>Address</h3>
                <p>Negombo, Sri Lanka</p>
              </div>
            </div>

            <div className="contact-info-item">
              <div className="contact-icon">📞</div>

              <div>
                <h3>Phone</h3>
                <p>
                  <a href="tel:+94788152026">
                    +94 78 815 2026
                  </a>
                </p>
              </div>
            </div>

            <div className="contact-info-item">
              <div className="contact-icon">✉</div>

              <div>
                <h3>Email</h3>
                <p>
                  <a href="https://mail.google.com/mail/?view=cm&fs=1&to=praneethsahanalokadon2009@gmail.com" target="_blank" rel="noreferrer">
                    praneethsahanalokadon2009@gmail.com
                  </a>
                </p>
              </div>
            </div>

            <div className="contact-info-item">
              <div className="contact-icon">🕒</div>

              <div>
                <h3>Opening Hours</h3>
                <p>Monday – Sunday</p>
                <p>08:00 AM – 08:00 PM</p>
              </div>
            </div>

          </div>

        </div>

        {/* Contact Form */}
        <div className="contact-form-box">

          <h2>Send Us a Message</h2>

          <form onSubmit={handleSubmit}>

            <div className="contact-form-row">

              <div className="contact-form-group">
                <label>Your Name</label>
                <input type="text" placeholder="Enter your name" value={name} onChange={(event) => setName(event.target.value)} required/>
              </div>

              <div className="contact-form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter your email" value={email} onChange={(event) => setEmail(event.target.value)} required/>
              </div>

            </div>

            <div className="contact-form-group">
              <label>Subject</label>
              <input type="text" placeholder="Enter subject" value={subject} onChange={(event) => setSubject(event.target.value)} required/>
            </div>

            <div className="contact-form-group">
              <label>Message</label>
              <textarea rows="6" placeholder="Write your message..." value={message} onChange={(event) => setMessage(event.target.value)} required/>
            </div>

            <button type="submit">
              Send Message
            </button>

          </form>

        </div>

      </div>

      {/* Closing Note */}
      <div className="contact-note">
        <h3>We're Happy to Help</h3>

        <p>
          Your feedback and questions are important to us.
          Thank you for choosing our food delivery service.
        </p>
      </div>

    </div>
  )
}

export default Contact