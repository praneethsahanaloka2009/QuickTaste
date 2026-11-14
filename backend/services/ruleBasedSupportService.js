/* QUICKTASTE FREE RULE-BASED SUPPORT BOT
   No external API or credits required */
const normalizeText = (value) => {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const containsAny = (text, keywords) => {
    return keywords.some((keyword) =>
        text.includes(normalizeText(keyword))
    );
};

const FAQ_PREFIX = "QuickTaste Automated FAQ (not AI):\n\n";

export const generateRuleBasedReply = (customerMessage) => {
    const text = normalizeText(customerMessage);

    let answer = "";

    // Greetings
    if(text.split(" ").length <= 3 &&containsAny(text, ["hello", "hi", "hey", "good morning", "good evening", "ayubowan", "ආයුබෝවන්", "හායි"])){
        answer = "Hello! Welcome to QuickTaste Support. " + "I can help with ordering, payments, delivery, " + "tracking, promo codes, and membership questions. " + "What would you like to know?";
    }

    // Order cancellation
    else if(containsAny(text, ["cancel order", "cancel my order", "order cancel", "අවලංගු", "order eka cancel"])){
        answer = "To check whether your order can be cancelled, " + "open My Orders and select the order. " + "Cancellation depends on its current status. " + "If cancellation is unavailable, please contact Human Support.";
    }

    // Refunds
    else if(containsAny(text, ["refund","money back","මුදල් ආපසු"])){
        answer = "Refund eligibility depends on the order and payment status. " +  "Please check your order details or contact Human Support. " + "I cannot approve or process refunds directly.";
    }

    // Order tracking
    else if(containsAny(text, ["track", "tracking", "where is my order", "order status", "my order", "මගේ ඇණවුම", "order eka koheda"])){
        answer = "You can track your order from My Orders. " + "Select your order and open Track Order to view its status. " + "I cannot access your live order details directly.";
    }

    // Payments
    else if(containsAny(text, ["payment", "pay", "stripe", "cash on delivery", "cod", "card", "ගෙවීම්", "gewanna"])){
        answer = "QuickTaste supports the payment methods shown at checkout, " + "including Stripe card checkout and Cash on Delivery where available. " + "Choose your preferred method on the Payment page. " + "Never share your card details or OTP in this chat.";
    }

    // Delivery
    else if(containsAny(text, ["delivery", "delivery fee", "delivery charge", "delivery area", "location", "branch", "බෙදාහැරීම"])){
        answer = "Enter your delivery address and select your location " + "during checkout. QuickTaste checks whether a branch " + "can deliver to your location. " + "The checkout summary shows the applicable delivery fee. " + "I cannot confirm live coverage or delivery times here.";
    }

    // Promo codes
    else if(containsAny(text, ["promo", "coupon", "discount code", "offer code", "free delivery code", "වට්ටම්"])){
        answer = "You can enter an eligible promo code in your cart or " + "checkout flow. Discounts depend on the code's conditions, " + "expiry date, and usage limits. " + "Please check the updated total before payment.";
    }

    // Membership
    else if(containsAny(text, ["premium", "membership", "member", "subscription", "subscribe", "දායකත්වය"])){
        answer = "QuickTaste offers a Premium Membership with benefits " + "such as eligible delivery savings, food discounts, " + "and priority service. " + "Visit the Subscription page for the current benefits, " + "price, and membership terms.";
    }

    // Food and menu
    else if(containsAny(text, ["menu", "food", "dish", "pizza", "burger", "pasta", "recommend", "කෑම", "ආහාර"])){
        answer = "You can explore available dishes in the QuickTaste menu. " + "Choose a category, open a food item, and add it to your cart. " + "Please check the website for current prices and availability. " + "I do not have access to the live menu database.";
    }

    // How to order
    else if(containsAny(text, ["order", "checkout", "place an order", "how to order", "how can i place", "ඇණවුම්", "order karanne"])){
        answer = "To place an order:\n" + "1. Browse the QuickTaste menu.\n" + "2. Add your favorite items to the cart.\n" + "3. Review your cart and any eligible discounts.\n" + "4. Enter or select your delivery address.\n" + "5. Confirm delivery coverage.\n" + "6. Choose a payment method and place your order.";
    }

    // Human support
    else if(containsAny(text, ["human", "admin", "agent", "real person", "customer service", "support person", "මනුස්සයෙක්"])){
        answer = "You can speak directly with our support team. " + "Click the Talk to Human Support button below " + "to request a live admin conversation.";
    }

    // Unknown question
    else {
        answer = "Thanks for contacting QuickTaste! " + "I can provide basic help with ordering, payments, " + "delivery, order tracking, membership, and promo codes. " + "For questions outside these topics, please use " + "Talk to Human Support.";
    }

    return (FAQ_PREFIX + answer).slice(0, 2000);
};