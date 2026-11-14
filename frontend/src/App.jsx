import React, { useEffect, useState, useContext } from 'react'
import Navbar from './components/Navbar/Navbar'
import OfferBar from './components/OfferBar/OfferBar'
import { Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home/Home'
import Profile from './pages/Profile/Profile'
import Cart from './pages/Cart/Cart'
import PlaceOrder from './pages/PlaceOrder/PlaceOrder'
import Footer from './components/Footer/Footer'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy'
import About from './pages/About/About'
import ScrollToTop from './components/ScrollToTop/ScrollToTop'
import Contact from './pages/Contact/Contact'
import MobileApp from './pages/MobileApp/MobileApp'
import LoginPopup from './components/LoginPopup/LoginPopup'
import TermsOfUse from './pages/TermsOfUse/TermsOfUse'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import { StoreContext } from './context/StoreContext'
import Payment from './pages/Payment/Payment'
import PaymentSuccess from './pages/PaymentSuccess/PaymentSuccess'
import MyOrders from './pages/MyOrders/MyOrders'
import TrackOrder from './pages/TrackOrder/TrackOrder'
import DeliveryVerification from './pages/DeliveryVerification/DeliveryVerification'
import Subscription from './pages/Subscription/Subscription'
import MyAddresses from "./pages/MyAddresses/MyAddresses";
import ProductDetails from "./pages/ProductDetails/ProductDetails";
import SupportChat from './components/SupportChat/SupportChat'

const App = () => {

  const [showLogin, setShowLogin] = useState(false)
  const { token } = useContext(StoreContext)
  const isLoggedIn = !!token
  
  const location = useLocation()

  useEffect(() => {
    setShowLogin(false)
  },[location.pathname])

  const hideLoginPages = ["/about", "/contact", "/mobile-app", "/cart", "/order"]

  const shouldShowLogin = showLogin && !hideLoginPages.includes(location.pathname)

  return (
    <>
    {shouldShowLogin && (<LoginPopup setShowLogin={setShowLogin}/>)}
      <div className="App">
        {location.pathname === "/" && <OfferBar/>}
        <Navbar setShowLogin={setShowLogin} isLoggedIn={isLoggedIn}/>
        <ScrollToTop/>
        <Routes>

          <Route path="/" element={<Home/>}/>

          <Route path="/profile" element={<Profile />} />

          <Route path="/subscription" element={<Subscription/>}/>

          <Route path="/cart" element={
            <ProtectedRoute message="Please login to access your cart.">
              <Cart/>
            </ProtectedRoute>
          }/>

          <Route path="/order" element={<PlaceOrder/>}/>

          <Route path="/payment" element={<Payment/>}/>

          <Route path="/payment-success" element={<PaymentSuccess/>}/>

          <Route path="/my-orders" element={<MyOrders/>}/>

          <Route path="/track-order/:id" element={<TrackOrder />}/>

          <Route path="/delivery-verification/:orderId" element={
            <ProtectedRoute message="Please login to verify your delivery.">
              <DeliveryVerification/>
            </ProtectedRoute>
          }/>
          
          <Route path='/privacy-policy' element={<PrivacyPolicy setShowLogin={setShowLogin}/>}/>

          <Route path="/about" element={<About/>}/>

          <Route path="/contact" element={<Contact/>}/>

          <Route path='/mobile-app' element={<MobileApp/>}/>

          <Route path="/terms-of-use" element={<TermsOfUse setShowLogin={setShowLogin}/>}/>

          <Route path="/my-addresses" element={<MyAddresses />}/>

          <Route path="/product/:id" element={<ProductDetails />} />

        </Routes>
      </div>
      <SupportChat/>
      <Footer/>
    </>
  )
}

export default App
