import React, { useContext, useState, useEffect } from 'react'
import './FoodItem.css'
import { assets } from '../../assets/assets'
import { StoreContext } from '../../context/StoreContext'

const FoodItem = ({id, name, price, description, image}) => {
  
  const [rating, setRating] = useState(0)
  const {cartItems, addToCart, removeFromCart, getUserRating, addRating, removeRating, token} = useContext(StoreContext);

  // Load User Rating
  useEffect(() => {

    const loadRating = async () => {

      if(!token){
        setRating(0);
        return;
      }

      const userRating = await getUserRating(id);

      setRating(userRating);

    };

    loadRating();

  }, [id, token])

  // Handle Rating
  const handleRating = async (star) => {

    if(!token){
        await addRating(id, star);
        return;
    }

    // Click same star -> remove rating
    if(rating === star){

        const success = await removeRating(id);

        if(success){
            setRating(0);
        }

        return;
    }

    // Add / update rating
    const success = await addRating(id, star);

    if(success){
        setRating(star);
    }

  }

  return (
    <div className='food-item'>
      <div className="food-item-image-container">
        <img className='food-item-image' src={`http://localhost:4911/images/${image}`} alt="" />
        {!cartItems[id] ? ( <img className='add' onClick={()=>addToCart(id)} src={assets.add_icon_white} alt="" />) : (
          <div className='food-item-counter'>
              <img onClick={()=>removeFromCart(id)} src={assets.remove_icon_red} alt="remove"/>
              <p>{cartItems[id]}</p>
              <img onClick={()=>addToCart(id)} src={assets.add_icon_green} alt="add"/>
          </div>
        )}
      </div>
      <div className="food-item-info">
        <div className="food-item-name-rating">
            <p>{name}</p>
        </div>
        <p className="food-item-description">{description}</p>
        <p className="food-item-price">
          <span className='price-dollar'>$</span>
          <span className='price-main'>{Number(price).toFixed(2).split(".")[0]}</span>
          <span className='price-dot'>.</span>
          <span className='price-decimal'>{Number(price).toFixed(2).split(".")[1][0]}</span>
          <span className='price-decimal-small'>{Number(price).toFixed(2).split(".")[1][1]}</span>
        </p>
        <div className="food-user-rating">
          <p>Rate this food:</p>
          <div className='rating-star'>
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={star <= rating ? 'user-star active' : 'user-star'} onClick={() => handleRating(star)}>★</span>
            ))}
          </div>
          {rating > 0 && (
            <p className='rating-message'>
              You rated {rating} out of 5
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default FoodItem
