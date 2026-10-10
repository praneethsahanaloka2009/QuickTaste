import React, { useContext, useEffect } from 'react'
import { StoreContext } from '../../context/StoreContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

const ProtectedRoute = ({ children }) => {

    const { token } = useContext(StoreContext)
    const navigate = useNavigate()

    useEffect(() => {

        if(!token){
            toast.error("Please login to access your cart.")
            navigate("/", { replace : true })
        }

    }, [token, navigate])

    if(!token){
        return null
    }

    return children
}

export default ProtectedRoute