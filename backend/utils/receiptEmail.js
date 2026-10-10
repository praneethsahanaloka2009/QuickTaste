const generateReceiptEmail = (order) => {
    
    const orderDate = new Date(order.createdAt).toLocaleString(
        "en-US",
        {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

    const subtotal = order.amount - order.deliveryFee;

    const itemsHtml = order.items.map((item) => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eeeeee;">
                ${item.name}
            </td>

            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eeeeee;">
                ${item.quantity}
            </td>

            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eeeeee;">
                $${Number(item.price).toFixed(2)}
            </td>

            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eeeeee;">
                $${( Number(item.price) * Number(item.quantity) ).toFixed(2)}
            </td>
        </tr>
    `).join("");

    const itemsText = order.items.map((item) => 
        `${item.name} x ${item.quantity} - $${(Number(item.price) * Number(item.quantity)).toFixed(2)}`
    ).join("\n");

    return {
        
        subject: `QuickTaste Payment Receipt - Order #${order._id}`,

        text: `
        QuickTaste
        Payment Receipt

        Order ID: ${order._id}

        Customer: ${order.address.firstName} ${order.address.lastName}

        Order Date: ${orderDate}

        Order Items:
        ${itemsText}

        Subtotal: $${subtotal.toFixed(2)}
        Delivery Fee: $${Number(order.deliveryFee).toFixed(2)}
        Total Paid: $${Number(order.amount).toFixed(2)}

        Payment Method: ${order.paymentMethod}
        Payment Status: ${order.paymentStatus}

        Thank you for ordering with QuickTaste!`,

        html: `
        <!DOCTYPE html>

        <html>
            
            <head>
                
                <meta charset="UTF-8">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <title>QuickTaste Payment Receipt</title>

            </head>

            <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, Helvetica, sans-serif;">
                
                <div style="width: 100%; padding: 40px 0;">
                    
                    <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #eeeeee;">
                        
                        <!-- Header -->
                        <div style="padding: 30px; text-align: center; border-bottom: 1px solid #eeeeee;">
                            
                            <h1 style="margin: 0; font-size: 30px;">
                                QuickTaste
                            </h1>

                            <p style="margin: 8px 0 0; font-size: 18px;">
                                Payment Receipt
                            </p>

                        </div>

                        <!-- Order Information -->
                        <div style="padding: 30px;">
                            
                            <h3 style="margin-top: 0; margin-bottom: 20px;">
                                Order Information
                            </h3>

                            <p style="margin: 8px 0;">
                                <strong>Order ID: </strong> ${order._id}
                            </p>

                            <p style="margin: 8px 0;">
                                <strong>Customer: </strong>${order.address.firstName}${order.address.lastName}
                            </p>

                            <p style="margin: 8px 0;">
                                <strong>Order Date: </strong>${orderDate}
                            </p>

                            <!-- Items -->
                            <h3 style="margin-top: 30px; margin-bottom: 15px;">
                                Order Items
                            </h3>

                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                
                                <thead>
                                    
                                    <tr>
                                        
                                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eeeeee;">Item</th>
                                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #eeeeee;">Qty</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eeeeee;">Price</th>
                                        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eeeeee;">Total</th>

                                    </tr>

                                </thead>

                                <tbody>
                                    
                                    ${itemsHtml}

                                </tbody>

                            </table>

                            <!-- Payment Summary -->

                            <div style="margin-top: 25px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                                
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    
                                    <span>Subtotal</span>

                                    <strong>
                                        $${subtotal.toFixed(2)}
                                    </strong>

                                </div>

                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    
                                    <span>Delivery Fee</span>

                                    <strong>
                                        $${Number(order.deliveryFee).toFixed(2)}
                                    </strong>

                                </div>

                                <div style="border-top: 1px solid #eeeeee; padding-top: 15px; margin-top: 15px;">
                                    
                                    <div style="display: flex; justify-content: space-between;">
                                        
                                        <strong style="font-size: 18px;">
                                            Total Paid
                                        </strong>

                                        <strong style="font-size: 18px;">
                                            $${Number(order.amount).toFixed(2)}
                                        </strong>

                                    </div>

                                </div>

                            </div>

                            <!-- Payment Details -->

                            <div style="margin-top: 30px; padding: 20px; background-color: #f8f8f8; border-radius: 8px;">
                                
                                <p style="margin: 6px 0;">
                                    <strong>Payment Method:</strong>
                                    ${order.paymentMethod}
                                </p>

                                <p style="margin: 6px 0;">
                                    <strong>Payment Status:</strong>
                                    ${order.paymentStatus}
                                </p>

                            </div>

                            <!-- Footer -->

                            <div style="margin-top: 30px; text-align: center; border-top: 1px solid #eeeeee; padding-top: 20px;">
                                
                                <p style="margin: 0 0 8px; font-size: 15px;">
                                    Thank you for ordering with QuickTaste!
                                </p>

                                <p style="margin: 0; font-size: 13px; color: #777777;">
                                    This is an automatically generated payment receipt.
                                </p>

                            </div>

                        </div>

                    </div>

                </div>

            </body>

        </html>
        `
    };

};

export default generateReceiptEmail;