import React, { useState, useEffect } from 'react'
import './ListProduct.css'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../../assets/assets'

const ListProduct = ({url}) => {

  const [list, setList] = useState([]);

  const fetchList = async () => {

    try {

      const response = await axios.get(`${url}/api/food/list`);

      if(response.data.success){
        setList(response.data.data);
      } else {
        toast.error("Error")
      }
      
    } catch (error) {

      console.log("Fetch List Error:", error);
      toast.error("Error loading products");

    }

  }

  const removeFood = async(foodId) => {

    try {
      
      const token = localStorage.getItem("adminToken");

      const response = await axios.post(
        `${url}/api/food/remove`,
        {id : foodId},
        {
          headers : {
            Authorization : `Bearer ${token}`
          }
        }
      );

      await fetchList();

      if(response.data.success){
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message || "Error");
      }

    } catch (error) {
      
      console.log("Remove Food Error:", error);

      toast.error(
        error.response?.data?.message || "Something went wrong. Please try again."
      );

    }

  }

  useEffect(() => {
    fetchList();
  },[])

  return (
    <div className="list add flex-col">

      <p>All Food List</p>

      <div className="list-table">
        
        <div className="list-table-format-title">
          <b>Image</b>
          <b>Name</b>
          <b>Category</b>
          <b>Price</b>
          <b>Action</b>
        </div>

        {list.map((item,index) => {
          return (
            <div key={index} className="list-table-format">
              <img src={`${url}/images/` + item.image} alt=""/>
              <p>{item.name}</p>
              <p>{item.category}</p>
              <p>{item.price}</p>

              <img onClick={() => removeFood(item._id)} src={assets.cross_icon} alt="delete" className='cross-icon'/>
            </div>
          )
        })}

      </div>
    </div>
  )

}

export default ListProduct