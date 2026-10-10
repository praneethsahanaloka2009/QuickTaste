import React, { useState } from 'react'
import './AddProduct.css'
import { assets } from '../../assets/assets'
import axios from "axios"
import { toast } from 'react-toastify'

const AddProduct = ({url}) => {

    const [image, setImage] = useState(false);
    const [data, setData] = useState({
        name : "",
        description : "",
        price : "",
        category : "",
        preparationTime: "15"
    })

    const onChangeHandler = (event) => {
        const name = event.target.name;
        const value = event.target.value;
        setData(data => ({
            ...data,
            [name] : value
        }))
    }

    const onSubmitHandler = async(event) => {

        event.preventDefault();

        const formData = new FormData();

        formData.append("name", data.name)
        formData.append("description", data.description)
        formData.append("price", Number(data.price))
        formData.append("category", data.category)
        formData.append("preparationTime", Number(data.preparationTime))
        formData.append("image", image)

        console.log("Image selected:", image);
        console.log("FormData image:", formData.get("image"));

        try {
            const token = localStorage.getItem("adminToken");

            const response = await axios.post(
                `${url}/api/food/add`,
                formData,
                {
                    headers : {
                        Authorization : `Bearer ${token}`
                    }
                }
            );

            if(response.data.success){

                setData({
                    name : "",
                    description : "",
                    price : "",
                    category : "Salad",
                    preparationTime: "15"
                })

                setImage(false)

                toast.success(response.data.message)

            } else {

                toast.error(response.data.message)

            }

        } catch (error) {
            
            console.log("Add Product Error:", error);

            toast.error(
                error.response?.data?.message || "Something went wrong. Please try again"
            );

        }

    }

  return (
    <div className='add'>
      <form className="flex-col" onSubmit={onSubmitHandler}>
        <div className="add-image-upload flex-col">
            <p>Upload Image</p>
            <label htmlFor="image" className="add-image-upload">
                <img src={image ? URL.createObjectURL(image) : assets.upload_area} alt="Upload food"/>
            </label>
            <input onChange={(e) => setImage(e.target.files?.[0] || false)} type="file" id="image" accept="image/*" hidden required/>
        </div>
        <div className="add-product-name flex-col">
            <p>Product Name</p>
            <input onChange={onChangeHandler} value={data.name} type="text" name="name" placeholder="Type here..." />
        </div>
        <div className="add-product-description flex-col">
            <p>Product Description</p>
            <textarea onChange={onChangeHandler} value={data.description} name="description" row="6" placeholder="Write content here..."></textarea>
        </div>
        <div className="add-category-price">

            <div className="add-category flex-col">

                <p>Product Category</p>
                <select onChange={onChangeHandler} name="category" value={data.category} required>
                    <option value="" disabled>Select Category</option>
                    <option value="Salad">Salad</option>
                    <option value="Wrap">Wrap</option>
                    <option value="Deserts">Deserts</option>
                    <option value="Sandwich">Sandwich</option>
                    <option value="Cake">Cake</option>
                    <option value="Pure Veg">Pure Veg</option>
                    <option value="Pasta">Pasta</option>
                    <option value="Noodles">Noodles</option>
                </select>

            </div>

            <div className="add-price flex-col">
                <p>Product Price</p>
                <input onChange={onChangeHandler} value={data.price} type="Number" name='price' placeholder='$20'/>
            </div>

            <div className="add-preparation-time flex-col">

                <p>Food Preparation Time (Minutes)</p>
                <select name="preparationTime" value={data.preparationTime} onChange={onChangeHandler} required>
                    <option value="5">5 Minutes</option>
                    <option value="10">10 Minutes</option>
                    <option value="15">15 Minutes</option>
                    <option value="20">20 Minutes</option>
                    <option value="25">25 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                </select>

            </div>
        </div>
        <button type='submit' className='add-btn'>ADD</button>
      </form>
    </div>
  )
}

export default AddProduct
