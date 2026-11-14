import React, { useCallback, useEffect, useState } from "react";
import "./ListProduct.css";
import axios from "axios";
import { toast } from "react-toastify";
import { assets } from "../../assets/assets";
import { Pencil, X, Save, ImagePlus, Plus, LoaderCircle } from "lucide-react";
import CustomizationEditor, { normalizeCustomizationGroups, prepareCustomizationGroups } from "../../components/CustomizationEditor/CustomizationEditor";

const ListProduct = ({ url }) => {
  
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // Edit Product
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    preparationTime: "15"
  });

  const [ingredients, setIngredients] = useState([]);
  const [customizationGroups, setCustomizationGroups] = useState([]);
  const [ingredientInput, setIngredientInput] = useState("");
  const [newImage, setNewImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Fetch Products
  const fetchList = useCallback(async () => {
    
    try {
        setLoading(true);

        const response = await axios.get(
            `${url}/api/food/list`
        );

        if(response.data.success){
            setList(
                Array.isArray(response.data.data) ? response.data.data : []
            );
        } else {
            toast.error(
                response.data.message || "Failed to load products."
            );
        }

    } catch (error) {
        console.error("Fetch List Error:", error);

        toast.error(
            error.response?.data?.message || "Error loading products."
        );

    } finally {
        setLoading(false);
    }

  }, [url]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Delete Product
  const removeFood = async (foodId) => {
    if(deletingId){
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to delete this product?"
    );

    if(!confirmed){
        return;
    }

    try {
        const token = localStorage.getItem("adminToken");

        if(!token){
            toast.error("Admin login is required.");
            return;
        }

        setDeletingId(foodId);

        const response = await axios.post(
            `${url}/api/food/remove`,
            {
                id: foodId
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if(response.data.success){
            toast.success(
                response.data.message || "Product deleted successfully!"
            );

            await fetchList();
            
        } else {
            toast.error(response.data.message || "Failed to delete product.");
        }
    } catch (error) {
        console.error("Remove Food Error:", error);

        toast.error(
            error.response?.data?.message || "Something went wrong. Please try again."
        );

    } finally {
        setDeletingId(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (product) => {
    setEditingProduct(product);

    setEditForm({
      name: product.name || "",
      description: product.description || "",
      category: product.category || "",
      price: String(product.price ?? ""),
      preparationTime: String(product.preparationTime ?? 15)
    });

    setIngredients(
        Array.isArray(product.ingredients) ? [...product.ingredients] : []
    );

    setCustomizationGroups(
        normalizeCustomizationGroups(product.customizationGroups || [])
    );

    setIngredientInput("");
    setNewImage(null);
    setImagePreview(product.image ? `${url}/images/${encodeURIComponent(product.image)}` : "");

    setShowEditModal(true);
  }

  // Close Edit Modal
  const closeEditModal = () => {
    if(saving){
        return;
    }

    setShowEditModal(false);
    setEditingProduct(null);
    setNewImage(null);
    setIngredientInput("");
    setCustomizationGroups([]);
    setImagePreview("");
  };

  // Form Input Changes
  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previous) => ({
        ...previous,
        [name]: value
    }));
  };

  // Replace Image
  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if(!file){
        return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if(!allowedTypes.includes(file.type)){
        toast.error("Please select a JPG, PNG or WebP image.");
        event.target.value = "";
        return;
    }

    if(file.size > 5 * 1024 * 1024){
        toast.error("Image size must be 5MB or less.");
        event.target.value = "";
        return;
    }

    setNewImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Release temporary image URLs
  useEffect(() => {
    
    if(!newImage || !imagePreview.startsWith("blob:")){
        return;
    }

    return () => {
        URL.revokeObjectURL(imagePreview);
    };

  }, [newImage, imagePreview]);

  // Add Ingredient
  const addIngredient = () => {
    const value = ingredientInput.trim();

    if(!value){
        return;
    }

    if(value.length > 100){
        toast.error("Ingredient name must be 100 characters or less.");
        return;
    }

    if(ingredients.length >= 30){
        toast.error("Maximum 30 ingredients allowed.");
        return;
    }

    const alreadyExists = ingredients.some(
        (item) => item.toLowerCase() === value.toLowerCase()
    );

    if(alreadyExists){
        toast.error("This ingredient is already added.");
        return;
    }

    setIngredients((previous) => [...previous, value]);
    setIngredientInput("");
  }

  // Remove Ingredient
  const removeIngredient = (index) => {
    setIngredients((previous) => 
        previous.filter((_, i) => i !== index)
    );
  };

  // Update Product
  const handleUpdateProduct = async (event) => {
    event.preventDefault();

    if(!editingProduct || saving){
        return;
    }

    const name = editForm.name.trim();
    const description = editForm.description.trim();
    const category = editForm.category.trim();

    const price = Number(editForm.price);
    const preparationTime = Number(editForm.preparationTime);

    if(!name || !description || !category){
        toast.error("Please complete all required fields.");
        return;
    }

    if(editForm.price.trim() === "" || !Number.isFinite(price) || price <= 0){
        toast.error("Price must be greater than zero.");
        return;
    }

    if(editForm.preparationTime.trim() === "" || !Number.isInteger(preparationTime) || preparationTime < 1){
        toast.error("Enter a valid preparation time.");
        return;
    }

    // Prevent losing an ingredient that hasn't been added
    if(ingredientInput.trim()){
        toast.error("Click Add to include the typed ingredient.");
        return;
    }

    let preparedCustomizationGroups;

    try {
        preparedCustomizationGroups = prepareCustomizationGroups(customizationGroups);
    } catch (error) {
        toast.error(error.message);
        return;
    }

    const token = localStorage.getItem("adminToken");

    if(!token){
        toast.error("Admin login is required.");
        return;
    }

    try {
        setSaving(true);

        const formData = new FormData();

        formData.append("name", name);
        formData.append("description", description);
        formData.append("category", category);
        formData.append("price", String(price));
        formData.append("preparationTime", String(preparationTime));
        formData.append("ingredients", JSON.stringify(ingredients));
        formData.append("customizationGroups", JSON.stringify(preparedCustomizationGroups));

        // Send a new image only when selected
        if(newImage){
            formData.append("image", newImage);
        }

        const response = await axios.put(
            `${url}/api/food/update/${editingProduct._id}`,
            formData,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if(!response.data.success){
            throw new Error(response.data.message || "Failed to update product.");
        }

        toast.success(response.data.message || "Product updated successfully!");

        closeEditModalAfterSave();

        // Reload products with updated details
        await fetchList();

    } catch (error) {
        console.error("Update Product Error:", error);
        toast.error(error.response?.data?.message || error.message || "Failed to update product.");
    } finally {
        setSaving(false);
    }
  };

  // Close modal after successful save
  const closeEditModalAfterSave = () => {
    setShowEditModal(false);
    setEditingProduct(null);
    setNewImage(null);
    setIngredientInput("");
    setCustomizationGroups([]);
    setImagePreview("");
  };

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

            {loading ? (
                <div className="list-product-empty">
                    Loading products...
                </div>
            ) : list.length === 0 ? (
                
                <div className="list-product-empty">
                    No products found.
                </div>
            ) : (
                list.map((item) => (
                    <div key={item._id} className="list-table-format">

                        <img src={`${url}/images/${encodeURIComponent(item.image)}`} alt={item.name}/>

                        <p>{item.name}</p>

                        <p>{item.category}</p>

                        <p>${Number(item.price).toFixed(2)}</p>

                        <div className="list-product-actions">
                            
                            <button type="button" className="list-product-edit-btn" title="Edit Product" aria-label={`Edit ${item.name}`} onClick={() => openEditModal(item)} disabled={Boolean(deletingId)}>
                                <Pencil size={17}/>
                            </button>

                            <button type="button" className="list-product-delete-btn" title="Delete Product" aria-label={`Delete ${item.name}`} onClick={() => removeFood(item._id)} disabled={Boolean(deletingId)}>
                                <img src={assets.cross_icon} alt="" className="cross-icon"/>
                            </button>

                        </div>

                    </div>
                ))
            )}

        </div>

        {/* Edit Product Modal */}
        {showEditModal && editingProduct && (
            <div className="list-edit-overlay" onMouseDown={(event) => {
                if(event.target === event.currentTarget){
                    closeEditModal();
                }
            }}>
                
                <div className="list-edit-modal" role="dialog" aria-modal="true" aria-labelledby="list-edit-title">
                    
                    <div className="list-edit-header">
                        
                        <div>
                            <h2 id="list-edit-title">Edit Product</h2>
                            <p>Update food details and ingredients.</p>
                        </div>

                        <button type="button" className="list-edit-close" onClick={closeEditModal} disabled={saving} aria-label="Close Edit Product">
                            <X size={21}/>
                        </button>

                    </div>

                    <form onSubmit={handleUpdateProduct}>
                        
                        <div className="list-edit-body">
                            
                            {/* Product Image */}
                            <div className="list-edit-image-section">
                                
                                <label className="list-edit-label">
                                    Product Image
                                </label>

                                <div className="list-edit-image-row">
                                    
                                    <div className="list-edit-image-preview">
                                        
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Product Preview"/>
                                        ) : (
                                            <ImagePlus size={32}/>
                                        )}

                                    </div>

                                    <div className="list-edit-image-info">
                                        
                                        <label htmlFor="list-edit-image-input" className="list-edit-upload-btn">
                                            <ImagePlus size={17}/>
                                            Change Image
                                        </label>

                                        <input id="list-edit-image-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} disabled={saving} hidden/>

                                        <p>
                                            Optional. JPG, PNG or WebP.
                                            Maximum 5MB.
                                        </p>

                                    </div>

                                </div>

                            </div>

                            {/* Product Information */}
                            <div className="list-edit-grid">
                                
                                <div className="list-edit-field list-edit-full">
                                    <label htmlFor="list-edit-name">
                                        Product Name *
                                    </label>

                                    <input id="list-edit-name" type="text" name="name" value={editForm.name} onChange={handleEditChange} required disabled={saving}/>
                                </div>

                                <div className="list-edit-field list-edit-full">
                                    <label htmlFor="list-edit-description">
                                        Description *
                                    </label>

                                    <textarea id="list-edit-description" name="description" value={editForm.description} onChange={handleEditChange} rows={4} required disabled={saving}/>
                                </div>

                                <div className="list-edit-field">
                                    <label htmlFor="list-edit-category">
                                        Category *
                                    </label>

                                    <input id="list-edit-category" type="text" name="category" value={editForm.category} onChange={handleEditChange} required disabled={saving}/>
                                </div>

                                <div className="list-edit-field">
                                    <label htmlFor="list-edit-price">
                                        Price ($) *
                                    </label>

                                    <input id="list-edit-price" type="number" name="price" min="0.01" step="0.01" value={editForm.price} onChange={handleEditChange} required disabled={saving}/>
                                </div>

                                <div className="list-edit-field">
                                    <label htmlFor="list-edit-preparation">
                                        Preparation Time (minutes) *
                                    </label>

                                    <input id="list-edit-preparation" type="number" name="preparationTime" min="1" step="1" value={editForm.preparationTime} onChange={handleEditChange} required disabled={saving}/>
                                </div>

                            </div>

                            {/* Ingredients */}
                            <div className="list-edit-ingredients">
                                
                                <div className="list-edit-ingredients-header">
                                    <h3>Ingredients</h3>
                                    <span>{ingredients.length}/30</span>
                                </div>

                                <div className="list-edit-ingredient-input">
                                    
                                    <input type="text" placeholder="Enter an ingredient" value={ingredientInput} onChange={(event) => setIngredientInput(event.target.value)} maxLength={100} disabled={saving} onKeyDown={(event) => {if(event.key === "Enter"){event.preventDefault(); addIngredient();}}}/>

                                    <button type="button" onClick={addIngredient} disabled={saving}>
                                        <Plus size={17}/>
                                        Add
                                    </button>

                                </div>

                                <div className="list-edit-ingredient-tags">

                                    {ingredients.length === 0 ? (
                                        <p className="list-edit-no-ingredients">
                                            No ingredients added.
                                        </p>
                                    ) : (
                                        ingredients.map((ingredient, index) => (
                                            <span key={`${ingredient}-${index}`} className="list-edit-ingredient-tag">

                                                {ingredient}

                                                <button type="button" aria-label={`Remove ${ingredient}`} onClick={() => removeIngredient(index)} disabled={saving}>
                                                    <X size={14}/>
                                                </button>

                                            </span>
                                        ))
                                    )}

                                </div>

                            </div>

                            {/* Food Customization & Add-ons */}
                            <CustomizationEditor groups={customizationGroups} onChange={setCustomizationGroups} disabled={saving}/>

                        </div>

                        {/* Modal Footer */}
                        <div className="list-edit-footer">
                            
                            <button type="button" className="list-edit-cancel" onClick={closeEditModal} disabled={saving}>
                                Cancel
                            </button>

                            <button type="submit" className="list-edit-save" disabled={saving}>
                                {saving ? (
                                    <LoaderCircle size={17} className="list-edit-spin"/>
                                ) : (
                                    <Save size={17}/>
                                )}

                                {saving ? "Saving..." : "Save Changes"}
                            </button>

                        </div>

                    </form>

                </div>

            </div>
        )}
        
    </div>
  );

};

export default ListProduct;