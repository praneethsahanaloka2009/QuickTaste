import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import './Messages.css'

const Messages = () => {
  
  const [messages, setMessages] = useState([])

  const [showReply, setShowReply] = useState(false)

  const [selectedMessage, setSelectedMessage] = useState(null)

  const [replySubject, setReplySubject] = useState("")
  const [replyMessage, setReplyMessage] = useState("")

  const [sendingReply, setSendingReply] = useState(false)

  const fetchMessages = async () => {

    try {
      const response = await fetch("http://localhost:4911/api/message/list")

      const data = await response.json()

      if(data.success){
        setMessages(data.data)
      } else {
        console.log(data.message)
      }

    } catch (error) {
      console.log("Messages Error:", error)
    }

  }

  const handleDelete = async (messageId) => {

    try {
      const response = await fetch("http://localhost:4911/api/message/remove",
        {
          method : "POST",
          headers : {
            "Content-Type" : "application/json"
          },
          body : JSON.stringify({
            id : messageId
          })
        }
      )

      const data = await response.json()

      if(data.success){
        fetchMessages()
      } else {
        console.log(data.message)
      }

    } catch (error) {
      console.log("Delete Message Error:", error)
    }

  }

  // Open Reply
  const handleReply = (message) => {
    setSelectedMessage(message)
    setReplySubject(`Re: ${message.subject}`)
    setReplyMessage("")
    setShowReply(true)
  }

  // Close Reply
  const handleCloseReply = () => {
    setShowReply(false)
    setSelectedMessage(null)
    setReplySubject("")
    setReplyMessage("")
  }

  // Send Reply
  const handleSendReply = async (event) => {
    
    event.preventDefault()

    if(!replyMessage.trim()){
      return
    }

    try {
      setSendingReply(true)

      const response = await fetch("http://localhost:4911/api/message/reply",
        {
          method : "POST",
          headers : {
            "Content-Type" : "application/json"
          },
          body : JSON.stringify({
            email : selectedMessage.email,
            subject : replySubject,
            message : replyMessage
          })
        }
      )

      const data = await response.json()

      if(data.success){
        toast.success("Reply send successfully!")
        handleCloseReply()
      } else {
        alert(data.message)
      }

    } catch (error) {

      console.log("Reply Error:", error)
      toast.success("Failed to send reply")

    } finally {
      setSendingReply(false)
    }

  }

  useEffect(() => {
    fetchMessages()
  }, [])

  return (
    <div className="messages">
      <div className="messages-header">

        <div>
          <h1>Messages</h1>
          <p>Manage messages received from customers.</p>
        </div>

        <div className="messages-count">
          <span>{messages.length}</span>
          <p>{messages.length === 1 ? "Message" : "Messages"}</p>
        </div>

      </div>

      <div className="messages-list">

        {messages.length === 0 ? (
          
          <p className='no-messages'>
            No messages received yet.
          </p>

        ) : (
          
          messages.map((item) => (
            <div className='message-card' key={item._id}>
              <div className="message-top">
                <div className="message-user">
                  
                  <div className="message-avatar">
                    {item.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.email}</p>
                  </div>

                </div>

                <span className='message-date'>

                  {new Date(item.createdAt).toLocaleDateString("en-GB",{
                    day : "2-digit",
                    month : "short",
                    year : "numeric"
                  })}

                </span>
              </div>

              <div className="message-body">
                <h4>{item.subject}</h4>
                <p>{item.message}</p>
              </div>

              <div className="message-actions">
                
                <button onClick={() => handleReply(item)} className='reply-button'>
                  Reply
                </button>

                <button onClick={() => handleDelete(item._id)} className='delete-button'>
                  Delete
                </button>

              </div>

            </div>
          ))
        )}

      </div>
      
      {/* Reply Model */}
      {showReply && selectedMessage && (
        <div className='reply-overlay'>
          <div className="reply-modal">
            <div className="reply-modal-header">
              
              <div>
                <h2>Reply to Customer</h2>
                <p>{selectedMessage.name}</p>
              </div>

              <button type='button' onClick={handleCloseReply} className='reply-close-button'>×</button>

            </div>

            <form onSubmit={handleSendReply}>
              <div className="reply-form-group">
                <label>To</label>
                <input type="email" value={selectedMessage.email} readOnly/>
              </div>

              <div className="reply-form-group">
                <label>Subject</label>
                <input type="text" value={replySubject} onChange={(event) => setReplySubject(event.target.value)} required/>
              </div>

              <div className="reply-form-group">
                <label>Message</label>
                <textarea rows="8" placeholder="Write your reply..." value={replyMessage} onChange={(event) => setReplyMessage(event.target.value)} required/>
              </div>

              <div className="reply-modal-actions">
                <button type='button' onClick={handleCloseReply} className='reply-cancle-button'>Cancle</button>
                <button type='submit' className='reply-send-button' disabled={sendingReply}>{sendingReply ? "Sending..." : "Send Reply"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  )

}

export default Messages