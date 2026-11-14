import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, ShoppingCart, Plus, Minus, Star, ChefHat, Share2, CheckCircle2, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import { StoreContext } from "../../context/StoreContext";
import ProductReviews from "../../components/ProductReviews/ProductReviews";
import { getImageUrl } from "../../config/api";
import "./ProductDetails.css";

const ProductDetails = () => {
    const { id } = useParams();
    const { food_list, cartItems, addToCart, addCustomizedToCart, getUserRating, addRating, removeRating, token } = useContext(StoreContext);

    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [rating, setRating] = useState(0);
    const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
    const [loadingProduct, setLoadingProduct] = useState(true);
    const [selectedCustomizations, setSelectedCustomizations] = useState({});

    // Reset selected options when switching products
    useEffect(() => {
        setSelectedCustomizations({});
    }, [id]);

    // Find selected product
    const product = food_list.find((item) => item._id === id);

    // Related food items
    const relatedProducts = product ? food_list .filter((item) => item._id !== product._id && item.category === product.category).slice(0, 4) : [];

    // Reset when product changes
    useEffect(() => {
        setQuantity(1);
        setRating(0);
    }, [id]);

    // Handle initial product loading
    useEffect(() => {
        
        if(product){
            setLoadingProduct(false);
            return;
        }

        const timer = setTimeout(() => {
            setLoadingProduct(false);
        }, 1500);

        return () => {
            clearTimeout(timer);
        }

    }, [id, product]);

    // Load user's personal rating
    useEffect(() => {

        let cancelled = false;

        const loadRating = async () => {

            if(!product || !token){
                setRating(0);
                return;
            }

            const savedRating = await getUserRating(id);

            if(!cancelled){
                setRating(savedRating);
            }
        };

        loadRating();

        return () => {
            cancelled = true;
        };

    }, [id, token, Boolean(product)]);

    // Add or remove personal rating
    const handleRating = async (star) => {
        
        if(!token){
            toast.error("Please login to rate this food.");
            return;
        }

        if(rating === star){
            const success = await removeRating(id);

            if(success){
                setRating(0);

                // Refresh public reviews and personal comment
                setReviewRefreshKey((prev) => prev + 1);
            }

            return;
        }

        const success = await addRating(id, star);

        if(success){
            setRating(star);

            // Refresh average rating and review list
            setReviewRefreshKey((prev) => prev + 1);
        }

    };

    // Select or deselect a customization option
    const handleCustomizationChange = (group, optionId) => {
        
        if(adding){
            return;
        }

        const groupId = String(group._id);
        const selectedId = String(optionId);

        setSelectedCustomizations((previous) => {
            
            const current = previous[groupId] || [];

            if(group.selectionType === "single"){
                return {
                    ...previous,
                    [groupId]: [selectedId]
                };
            }

            const exists = current.includes(selectedId);

            if(exists){
                return {
                    ...previous,
                    [groupId]: current.filter((id) => id !== selectedId)
                };
            }

            const maxSelect = Number(group.maxSelect) || 1;

            if(current.length >= maxSelect){
                return previous;
            }

            return {
                ...previous,
                [groupId]: [...current, selectedId]
            };

        });

    };

    // Add selected quantity to existing cart
    const handleAddToCart = async () => {
        
        if(!token){
            toast.error("Please login to add items to your cart.");
            return;
        }

        if(!product || adding){
            return;
        }

        // Product customization groups
        const groups = Array.isArray(product.customizationGroups) ? product.customizationGroups : [];

        // Prepare selected option IDs
        const selections = [];

        for(const group of groups){
            const groupId = String(group._id);

            const selectedIds = selectedCustomizations[groupId] || [];

            const availableOptions = (group.options || []).filter((option) => option.isAvailable !== false && selectedIds.includes(String(option._id)));

            const minSelect = Number(group.minSelect ?? (group.required ? 1 : 0));

            const maxSelect = Number(group.maxSelect ?? 1);

            // Validate required and maximum selections
            if(availableOptions.length < minSelect || availableOptions.length > maxSelect || (group.selectionType === "single" && availableOptions.length > 1)){
                toast.error(`Please check the selections for ${group.name}.`);
                return;
            }

            if(availableOptions.length > 0){
                selections.push({
                    groupId,
                    optionIds: availableOptions.map((option) => String(option._id))
                });
            }
        }

        setAdding(true);

        try {
            let success = false;

            if(selections.length > 0){
                // Save selected sizes and add-ons
                success = await addCustomizedToCart(product._id, quantity, selections);
            } else {
                // No customizations selected: preserve the existing normal cart flow
                success = await addToCart(product._id, quantity);
            }

            if(success){
                setQuantity(1);
                setSelectedCustomizations({});
            }
            
        } catch (error) {
            console.error("Product Add To Cart Error:", error);
            toast.error("Something went wrong while adding food.");
        } finally {
            setAdding(false);
        }

    };

    // Share product link
    const handleShare = async () => {
        
        try {
            await navigator.clipboard.writeText(window.location.href);

            toast.success("Product link copied!");

        } catch (error) {
            toast.error("Unable to copy product link.");
        }

    };

    // Loading state
    if(loadingProduct && !product){
        return (
            <main className="qt-product-page">
                <div className="qt-product-container">
                    <div className="qt-product-empty">
                        <LoaderCircle size={40} className="qt-product-loading-icon"/>
                        <h2>Loading Product...</h2>
                        <p>Please wait while we load food details.</p>
                    </div>
                </div>
            </main>
        );
    }

    // Product not found
    if(!product){
        return (
            <main className="qt-product-page">
                <div className="qt-product-container">
                    <div className="qt-product-empty">
                        <ChefHat size={45}/>

                        <h2>Product Not Found</h2>

                        <p>
                            This food item could not be found in the current QuickTaste menu.
                        </p>

                        <Link to="/">
                            Back to Menu
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const price = Number(product.price) || 0;

    // Customization groups configured by Admin
    const customizationGroups = Array.isArray(product.customizationGroups) ? product.customizationGroups : [];

    const hasCustomizations = customizationGroups.length > 0;

    // Build valid selections and calculate extra prices
    let customizationExtraPrice = 0;
    let customizationsValid = true;
    let firstMissingGroup = "";

    const selectedOptions = customizationGroups.map((group) => {
        
        const selectedIds = selectedCustomizations[String(group._id)] || [];

        const validOptions = (group.options || []).filter((option) => option.isAvailable !== false && selectedIds.includes(String(option._id)));

        const minSelect = Number(group.minSelect ?? (group.required ? 1 : 0));

        const maxSelect = Number(group.maxSelect ?? 1);

        if(validOptions.length < minSelect || validOptions.length > maxSelect || (group.selectionType === "single" && validOptions.length > 1)){
            customizationsValid = false;

            if(!firstMissingGroup){
                firstMissingGroup = group.name;
            }
        }

        validOptions.forEach((option) => {
            customizationExtraPrice += Number(option.price) || 0;
        });

        return {
            groupId: String(group._id),
            groupName: group.name,
            options: validOptions.map((option) => ({
                optionId: String(option._id),
                name: option.name,
                price: Number(option.price) || 0
            }))
        };

    });

    const unitPrice = price + customizationExtraPrice;
    const totalPrice = unitPrice * quantity;

    const preparationTime = Number(product.preparationTime);

    // Ingredients saved by Admin
    const ingredients = Array.isArray(product.ingredients) ? product.ingredients.filter((ingredient) => typeof ingredient === "string" && ingredient.trim() !== "") : [];

    const hasPreparationTime = Number.isFinite(preparationTime) && preparationTime > 0;

    return (
        <main className="qt-product-page">
            
            <div className="qt-product-container">
                
                {/* Top Navigation */}
                <div className="qt-product-topbar">
                    
                    <Link to="/" className="qt-product-back">
                        <ArrowLeft size={17}/>
                        Back to Menu
                    </Link>

                    <button type="button" className="qt-product-share" onClick={handleShare}>
                        <Share2 size={17}/>
                        Share
                    </button>

                </div>

                {/* Main Product Section */}
                <div className="qt-product-main">
                    
                    {/* Product Image */}
                    <div className="qt-product-image-section">
                        
                        <img src={getImageUrl(product.image)} alt={product.name} className="qt-product-main-image"/>

                        <div className="qt-product-image-caption">
                            <ChefHat size={18}/>
                            Prepared fresh for your order
                        </div>

                    </div>

                    {/* Product Information */}
                    <div className="qt-product-info">
                        
                        <span className="qt-product-category">
                            {product.category}
                        </span>

                        <h1>{product.name}</h1>

                        <p className="qt-product-description">
                            {product.description}
                        </p>

                        {/* Preparation Highlights */}
                        <div className="qt-product-highlights">
                            
                            <div className="qt-product-highlight">
                                
                                <Clock3 size={19}/>

                                <div>
                                    <span>Preparation Time</span>

                                    <strong>
                                        {hasPreparationTime ? `${preparationTime} min` : "Not specified"}
                                    </strong>
                                </div>

                            </div>

                            <div className="qt-product-highlight">
                                
                                <ChefHat size={19}/>

                                <div>
                                    <span>Preparation</span>
                                    <strong>Freshly Prepared</strong>
                                </div>

                            </div>

                        </div>

                        {/* Price */}
                        <div className="qt-product-price-area">
                            <span>Price per item</span>
                            <h2>${unitPrice.toFixed(2)}</h2>
                        </div>

                        {/* Food Customization & Add-ons */}
                        {hasCustomizations && (
                            
                            <section className="qt-customization-section">
                                
                                <div className="qt-customization-heading">
                                    <div className="qt-customization-heading-icon">
                                        <SlidersHorizontal size={21}/>
                                    </div>

                                    <div>
                                        <h3>Customize Your Order</h3>
                                        <p>
                                            Choose your preferred options and extras.
                                        </p>
                                    </div>
                                </div>

                                <div className="qt-customization-groups">
                                    
                                    {customizationGroups.map((group) => {
                                        
                                        const groupId = String(group._id);

                                        const currentSelected = selectedCustomizations[groupId] || [];

                                        const maxSelect = Number(group.maxSelect ?? 1);

                                        const availableOptions = (group.options || []).filter((option) => option.isAvailable !== false);

                                        return (
                                            <div key={groupId} className="qt-customization-group">
                                                
                                                <div className="qt-customization-group-header">
                                                    
                                                    <div>
                                                        <h4>{group.name}</h4>

                                                        <p>
                                                            {group.selectionType === "single" ? "Select one option" : `Choose up to ${maxSelect} options`}
                                                        </p>
                                                    </div>

                                                    <span className={group.required ? "qt-customization-required" : "qt-customization-optional"}>
                                                        {group.required ? "Required" : "Optional"}
                                                    </span>

                                                </div>

                                                <div className="qt-customization-options">
                                                    
                                                    {availableOptions.map((option) => {
                                                        
                                                        const optionId = String(option._id);

                                                        const isSelected = currentSelected.includes(optionId);

                                                        const extraPrice = Number(option.price) || 0;

                                                        const selectionLimitReached = group.selectionType === "multiple" && !isSelected && currentSelected.length >= maxSelect;

                                                        return (
                                                            <label key={optionId} className={`qt-customization-option ${isSelected ? "selected" : ""}`}>

                                                                <input type={group.selectionType === "single" ? "radio" : "checkbox"} name={`customization-${groupId}`} checked={isSelected} disabled={adding || selectionLimitReached} onChange={() => handleCustomizationChange(group, optionId)}/>

                                                                <span className="qt-customization-option-name">
                                                                    {option.name}
                                                                </span>

                                                                <strong>
                                                                    {extraPrice === 0 ? "Free" : `+$${extraPrice.toFixed(2)}`}
                                                                </strong>

                                                            </label>
                                                        );

                                                    })}

                                                    {availableOptions.length === 0 && (
                                                        <p className="qt-customization-unavailable">
                                                            No options currently available.
                                                        </p>
                                                    )}

                                                </div>

                                            </div>
                                        );

                                    })}

                                </div>

                                <div className="qt-customization-summary">
                                    
                                    <div>
                                        <span>Base Price</span>
                                        <strong>${price.toFixed(2)}</strong>
                                    </div>

                                    <div>
                                        <span>Selected Extras</span>
                                        <strong>
                                            +${customizationExtraPrice.toFixed(2)}
                                        </strong>
                                    </div>

                                    <div className="qt-customization-summary-total">
                                        <span>Price per Item</span>
                                        <strong>${unitPrice.toFixed(2)}</strong>
                                    </div>

                                </div>

                                {!customizationsValid && (
                                    <p className="qt-customization-warning">
                                        Please complete the required selections
                                        {firstMissingGroup ? ` for ${firstMissingGroup}.` : "."}
                                    </p>
                                )}

                            </section>

                        )}

                        {/* Quantity Selector */}
                        <div className="qt-product-quantity-area">
                            
                            <div>
                                <h3>Quantity</h3>
                                <p>Select how many you want</p>
                            </div>

                            <div className="qt-product-quantity">
                                
                                <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1 || adding} onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}>
                                    <Minus size={17}/>
                                </button>

                                <span>{quantity}</span>

                                <button type="button" aria-label="Increase quantity" disabled={quantity >= 20 || adding} onClick={() => setQuantity((prev) => Math.min(20, prev + 1))}>
                                    <Plus size={17}/>
                                </button>

                            </div>

                        </div>

                        {/* Selected Customizations */}
                        {selectedOptions.some((group) => group.options.length > 0) && (
                            <div className="qt-selected-customizations">
                                
                                <h4>Your Selections</h4>

                                {selectedOptions.filter((group) => group.options.length > 0).map((group) => (
                                    
                                    <div key={group.groupId} className="qt-selected-customization-row">
                                        <span>{group.groupName}</span>
                                        <strong>
                                            {group.options.map((option) => option.name).join(", ")}
                                        </strong>
                                    </div>

                                ))}

                            </div>
                        )}

                        {/* Add to Cart */}
                        <button type="button" className="qt-product-add-cart" onClick={handleAddToCart} disabled={adding || !customizationsValid}>
                            <ShoppingCart size={19}/>
                            {adding ? "Adding to Cart..." : `Add to Cart • $${totalPrice.toFixed(2)}`}
                        </button>

                        {Boolean(cartItems[id]) && (
                            <div className="qt-product-cart-notice">
                                <CheckCircle2 size={17}/>
                                {cartItems[id]} already in your cart
                            </div>
                        )}

                        {/* Customer Rating */}
                        <div className="qt-product-rating-section">
                            
                            <h3>Rate this food</h3>

                            <p>Your personal rating for this item</p>

                            <div className="qt-product-stars">
                                
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button key={star} type="button" aria-label={`Rate ${star} stars`} aria-pressed={rating === star} className={star <= rating ? "selected" : ""} onClick={() => handleRating(star)}>
                                        <Star size={27}/>
                                    </button>
                                ))}

                            </div>

                            {rating > 0 && (
                                <span className="qt-product-rating-text">
                                    You rated this item {rating}/5.
                                    Click the same star to remove.
                                </span>
                            )}

                        </div>

                    </div>

                </div>

                {/* Food Ingredients Section */}
                <section className="qt-product-ingredients">
                    
                    <div className="qt-product-ingredients-header">
                        
                        <div className="qt-product-ingredients-heading">
                            
                            <div className="qt-product-ingredients-icon">
                                <ChefHat size={23}/>
                            </div>

                            <div>
                                <h2>What's Inside Your Food?</h2>

                                <p>
                                    Ingredients used to prepare this food item
                                </p>
                            </div>

                        </div>

                        {ingredients.length > 0 && (
                            <span className="qt-product-ingredients-count">
                                {ingredients.length} Ingredients
                            </span>
                        )}

                    </div>

                    {ingredients.length > 0 ? (
                        
                        <div className="qt-product-ingredients-list">
                            
                            {ingredients.map((ingredient, index) => (
                                
                                <div key={`${ingredient}-${index}`} className="qt-product-ingredient-item">
                                    
                                    <span className="qt-product-ingredient-check">
                                        <CheckCircle2 size={17}/>
                                    </span>

                                    <span className="qt-product-ingredient-name">
                                        {ingredient}
                                    </span>

                                </div>

                            ))}

                        </div>

                    ) : (
                        
                        <div className="qt-product-ingredients-empty">
                            Ingredient information is not available for this product yet.
                        </div>

                    )}

                    <p className="qt-product-ingredients-note">
                        Please contact our support team if you have any food allergies or dietary concerns.
                    </p>

                </section>

                {/* Preparation Information */}
                <section className="qt-product-preparation">
                    
                    <div className="qt-product-section-heading">
                        
                        <ChefHat size={23}/>

                        <h2>Preparation Information</h2>

                    </div>

                    <p>
                        This food is freshly prepared after your order is accepted.
                    </p>

                    <p>
                        Estimated food preparation time:
                        <strong>
                            {hasPreparationTime ? ` ${preparationTime} minutes` : " Not specified"}
                        </strong>
                    </p>

                    <p className="qt-product-preparation-note">
                        Preparation time is an estimate and does not include delivery time.
                    </p>

                </section>

                {/* Customer Reviews & Comments */}
                <ProductReviews key={id} foodId={id} token={token} rating={rating} refreshKey={reviewRefreshKey}/>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <section className="qt-product-related">
                        
                        <div className="qt-product-related-heading">
                            
                            <h2>You May Also Like</h2>

                            <p>
                                More delicious options from the{" "}
                                {product.category} category.
                            </p>

                        </div>

                        <div className="qt-product-related-grid">
                            
                            {relatedProducts.map((item) => (
                                
                                <Link key={item._id} to={`/product/${item._id}`} className="qt-product-related-card">
                                    
                                    <img src={getImageUrl(item.image)} alt={item.name}/>

                                    <div>
                                        <h3>{item.name}</h3>

                                        <p>{item.category}</p>

                                        <strong>
                                            ${Number(item.price).toFixed(2)}
                                        </strong>
                                    </div>

                                </Link>

                            ))}

                        </div>

                    </section>
                )}

            </div>

        </main>
    );
};

export default ProductDetails;