import React from 'react'
import ReactDOM from 'react-dom/client'
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import RiderContextProvider from './context/RiderContext.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import "./index.css";

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <RiderContextProvider>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <App/>
        <ToastContainer position="top-right" autoClose={3000}/>
      </GoogleOAuthProvider>
    </RiderContextProvider>
  </BrowserRouter>
)