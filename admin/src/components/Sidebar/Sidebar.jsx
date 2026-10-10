import React from 'react'
import './Sidebar.css'
import { assets } from '../../assets/assets'
import { NavLink } from 'react-router-dom'

const Sidebar = () => {
  return (
    <div className='sidebar'>

      <div className="sidebar-options">

        <NavLink to='/dashboard' className="sidebar-option">
          <span className="dashboard-sidebar-icon">▦</span> 
          <p>Dashboard</p>
        </NavLink>

        <NavLink to='/add-product' className="sidebar-option">
          <img src={assets.add_icon} alt="" />
          <p>Add Items</p>
        </NavLink>

        <NavLink to='/list-product' className="sidebar-option">
          <img src={assets.list_icon} alt="" />
          <p>List Items</p>
        </NavLink>

        <NavLink to='/orders' className="sidebar-option">
          <img src={assets.order_icon} alt="" />
          <p>Orders</p>
        </NavLink>

        <NavLink to='/messages' className="sidebar-option">
          <img src={assets.message_icon} alt="" />
          <p>Messages</p>
        </NavLink>

        <NavLink to='/promo-codes' className="sidebar-option">
          <img src={assets.promo_icon} alt="" />
          <p>Promo Codes</p>
        </NavLink>

      </div>

    </div>
  )
}

export default Sidebar
