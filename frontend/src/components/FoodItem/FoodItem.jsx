import React, { useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./FoodItem.css";
import { assets } from "../../assets/assets";
import { StoreContext } from "../../context/StoreContext";

const FoodItem = ({ id, name, price, description, image }) => {
  
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);

  const {cartItems, addToCart, removeFromCart, getUserRating, addRating, removeRating, token} = useContext(StoreContext);

  const openProductDetails = () => {
    navigate(`/product/${id}`);
  };

  // Load user's existing rating
  useEffect(() => {
    let cancelled = false;

    const loadRating = async () => {
      if(!token){
        setRating(0);
        return;
      }

      const userRating = await getUserRating(id);

      if(!cancelled){
        setRating(userRating);
      }
    };

    loadRating();

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  // Add, update or remove rating
  const handleRating = async (star) => {
    if(!token){
      await addRating(id, star);
      return;
    }

    if(rating === star){
      const success = await removeRating(id);

      if(success){
        setRating(0);
      }

      return;
    }

    const success = await addRating(id, star);

    if(success){
      setRating(star);
    }
  };

  const formattedPrice = Number(price).toFixed(2);
  const [whole, decimal] = formattedPrice.split(".");

  return (
    <div className="food-item">
      
      <div className="food-item-image-container">
        
        <img className="food-item-image" src={`http://localhost:4911/images/${image}`} alt={name} onClick={openProductDetails} style={{ cursor: "pointer" }}/>

        {!cartItems[id] ? (
          <img className="add" onClick={() => addToCart(id)} src={assets.add_icon_white} alt="Add to cart" role="button" tabIndex={0} onKeyDown={(e) => {if(e.key === "Enter" || e.key === " "){e.preventDefault(); addToCart(id);}}}/>
        ) : (
          <div className="food-item-counter">
            <img onClick={() => removeFromCart(id)} src={assets.remove_icon_red} alt="Remove one" role="button" tabIndex={0} onKeyDown={(e) => {if(e.key === "Enter" || e.key === " "){e.preventDefault(); removeFromCart(id);}}}/>

            <p>{cartItems[id]}</p>

            <img onClick={() => addToCart(id)} src={assets.add_icon_green} alt="Add one" role="button" tabIndex={0} onKeyDown={(e) => {if(e.key === "Enter" || e.key === " "){e.preventDefault(); addToCart(id);}}}/>
          </div>
        )}

      </div>

      <div className="food-item-info">
        
        <div className="food-item-name-rating">
          <button type="button" className="food-item-name-link" onClick={openProductDetails}>
            {name}
          </button>
        </div>

        <p className="food-item-description">
          {description}
        </p>

        <p className="food-item-price">
          <span className="price-dollar">$</span>
          <span className="price-main">{whole}</span>
          <span className="price-dot">.</span>
          <span className="price-decimal">
            {decimal[0]}
          </span>
          <span className="price-decimal-small">
            {decimal[1]}
          </span>
        </p>

        <div className="food-user-rating">
          <p>Rate this food:</p>

          <div className="rating-star">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} role="button" tabIndex={0} aria-label={`Rate ${star} out of 5`} className={star <= rating ? "user-star active" : "user-star"} onClick={() => handleRating(star)} onKeyDown={(e) => {if(e.key === "Enter" || e.key === " "){e.preventDefault(); handleRating(star);}}}>
                ★
              </span>
            ))}
          </div>
          
          {rating > 0 && (
            <p className="rating-message">
              You rated {rating} out of 5
            </p>
          )}
        </div>

        <button type="button" className="food-item-details-link" onClick={openProductDetails}>
          View Details →
        </button>

      </div>

    </div>
  );

};

export default FoodItem;