import React, { useEffect, useState } from "react";
import "./AddProduct.css";
import { assets } from "../../assets/assets";
import axios from "axios";
import { toast } from "react-toastify";
import { Plus, X, ListChecks } from "lucide-react";
import CustomizationEditor, { prepareCustomizationGroups } from "../../components/CustomizationEditor/CustomizationEditor";

const initialData = {
    name: "",
    description: "",
    price: "",
    category: "",
    preparationTime: "15"
};

const AddProduct = ({ url }) => {
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [data, setData] = useState(initialData);
    const [ingredientInput, setIngredientInput] = useState("");
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [customizationGroups, setCustomizationGroups] = useState([]);

    // Image preview with URL cleanup
    useEffect(() => {

        if(!image){
            setImagePreview("");
            return;
        }

        const previewUrl = URL.createObjectURL(image);

        setImagePreview(previewUrl);

        return() => {
            URL.revokeObjectURL(previewUrl);
        };

    }, [image]);

    // Handle form field changes
    const onChangeHandler = (event) => {

        const { name, value } = event.target;

        setData((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    // Add ingredient
    const addIngredient = () => {
        
        const ingredient = ingredientInput.trim();

        if(!ingredient){
            toast.error("Please enter an ingredient name.");
            return;
        }

        if(ingredient.length > 100){
            toast.error("Ingredient name is too long.");
            return;
        }

        if(ingredients.length >= 30){
            toast.error("Maximum 30 ingredients allowed.");
            return;
        }
        
        const alreadyExists = ingredients.some((item) => item.toLowerCase() === ingredient.toLowerCase());

        if(alreadyExists){
            toast.error("This ingredient is already added.");
            return;
        }

        setIngredients((previous) => [
            ...previous,
            ingredient
        ]);

        setIngredientInput("");

    };

    // Press Enter to add ingredient
    const handleIngredientKeyDown = (event) => {

        if(event.key === "Enter"){
            event.preventDefault();
            addIngredient();
        }

    };

    // Remove ingredient
    const removeIngredient = (index) => {
        setIngredients((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    };

    // Submit product
    const onSubmitHandler = async (event) => {
        
        event.preventDefault();

        if(loading){
            return;
        }

        if(!image){
            toast.error("Please upload a food image.");
            return;
        }

        if(!data.name.trim() || !data.description.trim() || !data.category || data.price === ""){
            toast.error("Please complete all required fields.");
            return;
        }

        if(!Number.isFinite(Number(data.price)) || Number(data.price) < 0){
            toast.error("Please enter a valid product price.");
            return;
        }

        // Validate customization groups before submission
        let preparedCustomizationGroups;

        try {
            preparedCustomizationGroups = prepareCustomizationGroups(customizationGroups);
        } catch (error) {
            toast.error(error.message);
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();

            formData.append("name", data.name.trim());

            formData.append("description", data.description.trim());

            formData.append("price", Number(data.price));

            formData.append("category", data.category);

            formData.append("preparationTime", Number(data.preparationTime));

            formData.append("image", image);

            // Send ingredients as a JSON array
            formData.append("ingredients", JSON.stringify(ingredients));

            formData.append("customizationGroups", JSON.stringify(preparedCustomizationGroups));

            const token = localStorage.getItem("adminToken");

            const response = await axios.post(
                `${url}/api/food/add`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if(response.data.success){
                toast.success(response.data.message);

                // Reset form after successful save
                setData({ ...initialData });

                setImage(null);
                setIngredients([]);
                setCustomizationGroups([]);
                setIngredientInput("");

                // Clear file input so same image can be selected again
                const fileInput = document.getElementById("image");

                if(fileInput){
                    fileInput.value = "";
                }

            } else {
                toast.error(response.data.message || "Failed to add product.");
            }

        } catch (error) {
            console.error("Add Product Error:", error);
            toast.error(error.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }

    };

    return (
        <div className="add">
            <form className="add-form flex-col" onSubmit={onSubmitHandler}>
                
                {/* Upload Image */}
                <div className="add-image-upload flex-col">
                    <p>Upload Image</p>
                    <label htmlFor="image" className="add-image-label">
                        <img src={imagePreview || assets.upload_area} alt={imagePreview ? "Selected food preview" : "Upload food"} className={imagePreview ? "upload-preview" : ""}/>
                    </label>
                    <input onChange={(event) => setImage(event.target.files?.[0] || null)} type="file" id="image" accept="image/*" hidden required/>
                </div>

                {/* Product Name */}
                <div className="add-product-name flex-col">
                    <p>Product Name</p>
                    <input onChange={onChangeHandler} value={data.name} type="text" name="name" placeholder="Type here..." required/>
                </div>

                {/* Product Description */}
                <div className="add-product-description flex-col">
                    <p>Product Description</p>
                    <textarea onChange={onChangeHandler} value={data.description} name="description" rows="6" placeholder="Write content here..." required/>
                </div>

                {/* Category, Price and Preparation */}
                <div className="add-category-price">
                    <div className="add-category flex-col">
                        <p>Product Category</p>
                        <select onChange={onChangeHandler} name="category" value={data.category} required>
                            <option value="" disabled>
                                Select Category
                            </option>

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
                        <input onChange={onChangeHandler} value={data.price} type="number" name="price" placeholder="$20" min="0" step="0.01" required/>
                    </div>

                    <div className="add-preparation-time flex-col">
                        <p>Food Preparation Time (Minutes)</p>
                        <select name="preparationTime" value={data.preparationTime} onChange={onChangeHandler} required>
                            <option value="05">05 Minutes</option>
                            <option value="10">10 Minutes</option>
                            <option value="15">15 Minutes</option>
                            <option value="20">20 Minutes</option>
                            <option value="25">25 Minutes</option>
                            <option value="30">30 Minutes</option>
                            <option value="35">35 Minutes</option>
                            <option value="40">40 Minutes</option>
                            <option value="45">45 Minutes</option>
                            <option value="50">50 Minutes</option>
                            <option value="55">55 Minutes</option>
                            <option value="60">60 Minutes</option>
                            <option value="65">65 Minutes</option>
                            <option value="70">70 Minutes</option>
                            <option value="75">75 Minutes</option>
                            <option value="80">80 Minutes</option>
                            <option value="85">85 Minutes</option>
                            <option value="90">90 Minutes</option>
                        </select>
                    </div>
                </div>

                {/* Food Ingredients */}
                <div className="add-ingredients-section">
                    <div className="add-ingredients-heading">
                        <div className="add-ingredients-title">
                            <ListChecks size={21}/>
                            <h3>Food Ingredients</h3>
                        </div>
                        
                        <span className="add-ingredients-count">
                            {ingredients.length}/50
                        </span>

                    </div>

                    <p className="add-ingredients-description">
                        Add the ingredients used to prepare this food item.
                    </p>

                    <div className="add-ingredient-input-row">
                        <input type="text" value={ingredientInput} maxLength={500} placeholder="e.g. Chicken, Cheese, Tomato..." onChange={(event) => setIngredientInput(event.target.value)} onKeyDown={handleIngredientKeyDown} disabled={loading}/>

                        <button type="button" className="add-ingredient-btn" onClick={addIngredient} disabled={loading || ingredients.length >= 30}>
                            <Plus size={18}/>
                            Add Ingredient
                        </button>
                    </div>

                    {ingredients.length > 0 ? (
                        <div className="add-ingredients-list">
                            
                            {ingredients.map((ingredient, index) => (
                                <div key={`${ingredient}-${index}`} className="add-ingredient-chip">
                                    
                                    <span>{ingredient}</span>

                                    <button type="button" aria-label={`Remove ${ingredient}`} onClick={() => removeIngredient(index)} disabled={loading}>
                                        <X size={15}/>
                                    </button>

                                </div>
                            ))}

                        </div>
                    ) : (
                        <div className="add-ingredients-empty">
                            No ingredients added yet.
                        </div>
                    )}

                    <p className="add-ingredients-hint">
                        Press Enter or click Add Ingredient. Ingredients are optional for existing products.
                    </p>
                </div>

                {/* Food Customization & Add-ons */}
                <CustomizationEditor groups={customizationGroups} onChange={setCustomizationGroups} disabled={loading}/>

                {/* Submit Button */}
                <button type="submit" className="add-btn" disabled={loading}>
                    {loading ? "ADDING..." : "ADD PRODUCT"}
                </button>

            </form>
        </div>
    );
};

export default AddProduct;