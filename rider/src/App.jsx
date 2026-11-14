import { Navigate, Route, Routes } from "react-router-dom";
import { useRider } from "./context/RiderContext.jsx";
import LoginPopup from "./components/LoginPopup/LoginPopup.jsx";
import Navbar from "./components/Navbar/Navbar.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import Orders from "./pages/Orders/Orders.jsx";
import Earnings from "./pages/Earnings/Earnings.jsx";
import Profile from "./pages/Profile/Profile.jsx";
import CompleteProfile from "./pages/CompleteProfile/CompleteProfile.jsx";

function App() {
    const { isAuthenticated, authLoading } = useRider();

    if(authLoading){
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p>Verifying rider session...</p>
            </div>
        );
    }

    return (
        <Routes>
            {/* Login */}
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace/> : <LoginPopup />}/>

            {/* Register */}
            <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace/> : <LoginPopup />}/>

            {/* Complete Rider Profile */}
            <Route path="/complete-profile" element={isAuthenticated ? <CompleteProfile/> : <Navigate to="/login" replace />}/>

            {/* Dashboard */}
            <Route path="/dashboard" element={isAuthenticated ? (<><Navbar/> <Dashboard/></>) : (<Navigate to="/login" replace />)}/>

            {/* My Deliveries */}
            <Route path="/orders" element={isAuthenticated ? (<><Navbar /><Orders/></>) : (<Navigate to="/login" replace />)}/>

            {/* Earnings */}
            <Route path="/earnings" element={isAuthenticated ? (<><Navbar /><Earnings/></>) : (<Navigate to="/login" replace />)}/>

            {/* Rider Profile */}
            <Route path="/profile" element={isAuthenticated ? (<><Navbar/><Profile/></>) : (<Navigate to="/login" replace />)}/>

            {/* Default Route */}
            <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace/>}/>
        </Routes>
    );
}

export default App;