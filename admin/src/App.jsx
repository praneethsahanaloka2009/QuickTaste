import React, { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar/Navbar'
import Sidebar from './components/Sidebar/Sidebar'
import Auth from './components/Auth/Auth'
import TermsOfUse from './pages/TermsOfUse/TermsOfUse'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy'
import AddProduct from './pages/AddProduct/AddProduct'
import ListProduct from './pages/ListProduct/ListProduct'
import Orders from './pages/Orders/Orders'
import Messages from './pages/Messages/Messages'
import PromoCodes from './pages/PromoCodes/PromoCodes'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import AdminProtectedRoute from './components/AdminProtectedRoute/AdminProtectedRoute'
import Dashboard from './pages/Dashboard/Dashboard'

const App = () => {

  const url = "http://localhost:4911";

  const [showAuth, setShowAuth] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("adminToken"))

  const location = useLocation()

  useEffect(() => {
    setShowAuth(false)
  },[location.pathname])

  return (
    <div>
      {showAuth && (<Auth setShowAuth={setShowAuth} setIsLoggedIn={setIsLoggedIn}/>)}
      <ToastContainer/>
      <Navbar setShowAuth={setShowAuth} isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn}/>
      <hr />
      <div className='app-content'>
        {isLoggedIn && <Sidebar/>}
        <Routes>
          <Route path="/" element={!isLoggedIn ? (
            <div className='admin-panel'>
              <h2>Admin Panel</h2>
              <p>Please login to access the Admin Dashboard.</p>
              <button onClick={() => setShowAuth(true)}>Login</button>
            </div>) : null}>
          </Route>

          <Route path="/dashboard" element={<AdminProtectedRoute><Dashboard/></AdminProtectedRoute>}/>
          <Route path="/add-product" element={<AdminProtectedRoute><AddProduct url={url}/></AdminProtectedRoute>}/>
          <Route path="/list-product" element={<AdminProtectedRoute><ListProduct url={url}/></AdminProtectedRoute>}/>
          <Route path="/orders" element={<AdminProtectedRoute><Orders url={url}/></AdminProtectedRoute>}/>
          <Route path="/messages" element={<AdminProtectedRoute><Messages url={url}/></AdminProtectedRoute>}/>
          <Route path="/promo-codes" element={<AdminProtectedRoute><PromoCodes/></AdminProtectedRoute>}/>
          <Route path="/terms-of-use" element={<TermsOfUse/>}/>
          <Route path="/privacy-policy" element={<PrivacyPolicy/>}/>
        </Routes>
      </div>
    </div>
  )
}

export default App