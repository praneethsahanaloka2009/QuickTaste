import { useEffect, useState } from "react";
import { Star, MessageSquareText, Send, Pencil, Trash2, UserRound, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { API_URL } from "../../config/api";
import "./ProductReviews.css";

const ProductReviews = ({foodId, token, rating, refreshKey = 0}) => {
    const [comment, setComment] = useState("");
    const [savedComment, setSavedComment] = useState("");

    const [reviews, setReviews] = useState([]);
    const [averageRating, setAverageRating] = useState(0);
    const [totalRatings, setTotalRatings] = useState(0);
    const [totalReviews, setTotalReviews] = useState(0);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);

    // Load public review list
    const loadReviews = async (signal) => {
        try {
            const response = await fetch(
                `${API_URL}/api/rating/food/${foodId}`,
                {
                    signal
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Failed to load reviews.");
            }

            if(signal?.aborted){
                return;
            }

            setReviews(data.reviews || []);
            setAverageRating(data.averageRating || 0);
            setTotalRatings(data.totalRatings || 0);
            setTotalReviews(data.totalReviews || 0);

        } catch (error) {
            if(error.name !== "AbortError"){
                console.error("Load Reviews Error:", error);
            }
        }
    };

    const handleRefreshReviews = async () => {
        
        if(refreshing){
            return;
        }

        setRefreshing(true);

        try {
            const response = await fetch(
                `${API_URL}/api/rating/food/${foodId}`,
                {
                    cache: "no-store"
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Failed to refresh reviews.");
            }

            setReviews(data.reviews || []);
            setAverageRating(data.averageRating || 0);
            setTotalRatings(data.totalRatings || 0);
            setTotalReviews(data.totalReviews || 0);

            toast.success("Reviews are up to date!", {autoClose: 1800});

        } catch (error) {
            console.error("Refresh Reviews Error:", error);
            toast.error("Unable to refresh reviews.");
        } finally {
            setRefreshing(false);
        }

    };

    // Load logged-in customer's review
    const loadMyReview = async (signal) => {
        
        if(!token){
            setSavedComment("");
            setComment("");
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/api/rating/user/${foodId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    signal
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Failed to load your review.");
            }

            if(signal?.aborted){
                return;
            }

            const text = data.comment || "";

            setSavedComment(text);
            setComment(text);

        } catch (error) {
            if(error.name !== "AbortError"){
                console.error("Load My Review Error:", error);
            }
        }

    };

    // Refresh when product or star rating changes
    useEffect(() => {
        const controller = new AbortController();

        const loadData = async () => {
            setLoading(true);

            try {
                await loadReviews(controller.signal);
            } finally {
                if(!controller.signal.aborted){
                    setLoading(false);
                }
            }
        };

        loadData();
        loadMyReview(controller.signal);

        return () => controller.abort();

    }, [foodId, token, refreshKey]);

    // Save or edit review
    const handleSaveReview = async (event) => {
        event.preventDefault();

        if(!token){
            toast.error("Please login to write a review.");
            return;
        }

        if(rating < 1){
            toast.error("Please rate this food first.");
            return;
        }

        const cleanedComment = comment.trim();

        if(!cleanedComment){
            toast.error("Please write your review.");
            return;
        }

        if(cleanedComment.length > 1000){
            toast.error("Review must be under 1000 characters.");
            return;
        }

        if(saving){
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(
                `${API_URL}/api/rating/review`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        foodId,
                        comment: cleanedComment
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Failed to save review.");
            }

            setSavedComment(cleanedComment);
            setComment(cleanedComment);

            toast.success(data.message || "Review saved!");

            await loadReviews();

        } catch (error) {
            console.error("Save Review Error:", error);
            toast.error(error.message || "Unable to save review.");
        } finally {
            setSaving(false);
        }
    };

    // Delete written comment only, preserve star rating
    const handleDeleteReview = async () => {
        if(!token || !savedComment || removing){
            return;
        }

        const confirmed = window.confirm("Remove your written review? Your star rating will remain.");

        if(!confirmed){
            return;
        }

        setRemoving(true);

        try {
            const response = await fetch(
                `${API_URL}/api/rating/review`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        foodId,
                        comment: ""
                    })
                }
            );

            const data = await response.json();

            if(!response.ok || !data.success){
                throw new Error(data.message || "Failed to delete review.");
            }

            setComment("");
            setSavedComment("");

            toast.success("Review removed successfully!");

            await loadReviews();

        } catch (error) {
            console.error("Delete Review Error:", error);
            toast.error(error.message || "Unable to delete review.");
        } finally {
            setRemoving(false);
        }
    };

    const formatDate = (date) => {
        if(!date){
            return "";
        }

        const value = new Date(date);

        if(Number.isNaN(value.getTime())){
            return "";
        }

        return value.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };

    return (
        <section className="qt-reviews">
            
            {/* Heading */}
            <div className="qt-reviews-heading">
                
                <div>
                    <span className="qt-reviews-eyebrow">
                        CUSTOMER FEEDBACK
                    </span>

                    <h2>
                        <MessageSquareText size={25}/>
                        Customer Reviews
                    </h2>

                    <p>
                        See what customers think about this food.
                    </p>
                </div>

                <button type="button" className="qt-reviews-refresh" onClick={handleRefreshReviews} disabled={refreshing} aria-label={refreshing ? "Refreshing reviews" : "Refresh reviews"} title={refreshing ? "Refreshing..." : "Refresh Reviews"}>
                    <RefreshCw size={18} className={refreshing ? "qt-refresh-spinning" : ""}/>
                </button>

            </div>

            {/* Rating Summary */}
            <div className="qt-reviews-summary">
                
                <div className="qt-reviews-score">
                    
                    <strong>
                        {averageRating.toFixed(1)}
                    </strong>

                    <div>
                        <div className="qt-reviews-stars">
                            
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} size={20} className={star <= Math.round(averageRating) ? "active" : ""}/>
                            ))}

                        </div>

                        <span>
                            {totalRatings} customer rating
                            {totalRatings === 1 ? "" : "s"}
                        </span>
                    </div>

                </div>

                <div className="qt-reviews-count">
                    <strong>{totalReviews}</strong>
                    <span>Written Reviews</span>
                </div>

            </div>

            {/* Write Review */}
            <div className="qt-reviews-form-card">
                
                <div className="qt-reviews-form-heading">
                    
                    <div>
                        <h3>
                            {savedComment ? "Edit Your Review" : "Write a Review"}
                        </h3>

                        <p>
                            Share your experience with this food.
                        </p>
                    </div>

                    {savedComment && (
                        <Pencil size={18}/>
                    )}

                </div>

                {!token ? (
                    <p className="qt-reviews-login">
                        Please login to rate and review this food.
                    </p>
                ) : (
                    <form onSubmit={handleSaveReview}>
                        
                        <p className="qt-reviews-rating-hint">
                            Your rating:
                            <strong>
                                {rating > 0 ? ` ${rating}/5 stars` : " Not selected"}
                            </strong>
                        </p>

                        <p className="qt-reviews-rating-help">
                            Select your stars in the "Rate this food" section above.
                        </p>

                        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="How was the taste, quality and overall experience?" maxLength={1000} rows={4} disabled={saving || removing}/>
                        
                        <div className="qt-reviews-form-footer">
                            
                            <span>
                                {comment.length}/1000 characters
                            </span>

                            <div className="qt-reviews-form-buttons">
                                
                                {savedComment && (
                                    <button type="button" className="qt-reviews-delete" onClick={handleDeleteReview} disabled={saving || removing}>
                                        <Trash2 size={16}/>
                                        {removing ? "Removing..." : "Delete"}
                                    </button>
                                )}

                                <button type="submit" className="qt-reviews-submit" disabled={saving || removing || rating < 1 || !comment.trim() || comment.trim() === savedComment}>
                                    <Send size={16}/>
                                    {saving ? "Saving..." : savedComment ? "Update Review" : "Post Review"}
                                </button>

                            </div>

                        </div>
                        
                    </form>
                )}

            </div>

            {/* Public Reviews */}
            <div className="qt-reviews-list-section">
                
                <div className="qt-reviews-list-heading">
                    
                    <h3>What Customers Are Saying?</h3>

                    <span>
                        {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                    </span>

                </div>

                {loading ? (

                    <div className="qt-reviews-empty">
                        Loading customer reviews...
                    </div>

                ) : reviews.length === 0 ? (

                    <div className="qt-reviews-empty">
                        <MessageSquareText size={29}/>

                        <strong>No written reviews yet</strong>

                        <p>
                            Be the first customer to share your experience.
                        </p>
                    </div>

                ) : (
                    
                    <div className="qt-reviews-list">
                        
                        {reviews.map((review) => (
                            
                            <article key={review._id} className="qt-review-card">
                                
                                <div className="qt-review-avatar">
                                    <UserRound size={23}/>
                                </div>

                                <div className="qt-review-content">
                                    
                                    <div className="qt-review-top">
                                        
                                        <div>
                                            <h4>
                                                {review.user?.name || "Customer"}
                                            </h4>

                                            <span>
                                                {formatDate(review.createdAt)}
                                            </span>
                                        </div>

                                        <div className="qt-review-rating">
                                            
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star key={star} size={15} className={star <= review.rating ? "active" : ""}/>
                                            ))}

                                        </div>

                                    </div>

                                    <p>{review.comment}</p>

                                </div>
                                
                            </article>

                        ))}

                    </div>

                )}

                {totalReviews > reviews.length && (
                    <p className="qt-reviews-limit-note">
                        Showing the latest {reviews.length} of{" "}{totalReviews} reviews.
                    </p>
                )}

            </div>

        </section>
    );
};

export default ProductReviews;