const generateReceiptEmail = (order) => {

    const address = order.address || {};

    const customerName = [
        address.firstName,
        address.lastName
    ].filter(Boolean).join(" ") || "QuickTaste Customer";

    const formatMoney = (amount) => {
        return `$${Number(amount || 0).toFixed(2)}`;
    };

    const orderDate = new Date(order.createdAt || Date.now())
        .toLocaleString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

    const items = Array.isArray(order.items)
        ? order.items
        : Object.values(order.items || {});

    const subtotal = items.reduce((total, item) => {
        return total + (
            Number(item.price || 0) *
            Number(item.quantity || 0)
        );
    }, 0);

    const deliveryFee = Number(order.deliveryFee || 0);

    const discount = Number(
        order.discountAmount ??
        order.discount ??
        0
    );

    const totalPaid = Number(order.amount || 0);

    const invoiceNumber = String(order._id || "")
        .toUpperCase();

    const paymentMethod = order.paymentMethod || "Online Payment";

    const paymentStatus = order.paymentStatus || "Pending";

    const addressParts = [
        customerName,
        address.address,
        address.street,
        address.city,
        address.state,
        address.zipcode,
        address.country
    ].filter(Boolean);

    const uniqueAddressParts = [...new Set(addressParts)];

    const billingAddressText = uniqueAddressParts.join(", ");

    const billingAddressHtml = uniqueAddressParts
        .map((part) => `
            <div style="margin: 3px 0; line-height: 1.5;">
                ${part}
            </div>
        `)
        .join("");

    const itemsHtml = items.map((item) => {

        const itemTotal =
            Number(item.price || 0) *
            Number(item.quantity || 0);

        return `
            <tr>
                <td style="padding: 14px 8px; border-bottom: 1px solid #eeeeee; color: #333333;">
                    ${item.name || "Food Item"}
                </td>

                <td style="padding: 14px 8px; text-align: center; border-bottom: 1px solid #eeeeee; color: #555555;">
                    ${Number(item.quantity || 0)}
                </td>

                <td style="padding: 14px 8px; text-align: right; border-bottom: 1px solid #eeeeee; color: #555555; white-space: nowrap;">
                    ${formatMoney(item.price)}
                </td>

                <td style="padding: 14px 8px; text-align: right; border-bottom: 1px solid #eeeeee; color: #222222; font-weight: 600; white-space: nowrap;">
                    ${formatMoney(itemTotal)}
                </td>
            </tr>
        `;
    }).join("");

    const itemsText = items.map((item) => {

        const itemTotal =
            Number(item.price || 0) *
            Number(item.quantity || 0);

        return `${item.name || "Food Item"} x ${item.quantity} - ${formatMoney(itemTotal)}`;

    }).join("\n");

    const discountRowHtml = discount > 0 ? `
        <tr>
            <td style="padding: 8px 0; color: #065d23;">
                Promo Discount
            </td>

            <td style="padding: 8px 0; text-align: right; color: #065d23;">
                -${formatMoney(discount)}
            </td>
        </tr>
    ` : "";

    const discountRowText = discount > 0
        ? `Promo Discount: -${formatMoney(discount)}\n`
        : "";

    return {

        subject: `QuickTaste - Your Receipt for Order #${invoiceNumber}`,

        text: `
QUICKTASTE
PAYMENT RECEIPT

Thank you for your order!

Your QuickTaste order receipt is below.

ORDER DETAILS

Order ID: ${order._id}
Invoice Number: ${invoiceNumber}
Date Issued: ${orderDate}

CUSTOMER

${customerName}

ORDER ITEMS

${itemsText}

PAYMENT SUMMARY

Subtotal: ${formatMoney(subtotal)}
${discountRowText}Delivery Fee: ${formatMoney(deliveryFee)}
Total Paid: ${formatMoney(totalPaid)}

PAYMENT DETAILS

Payment Method: ${paymentMethod}
Payment Status: ${paymentStatus}

DELIVERY ADDRESS

${billingAddressText || "Address not available"}

Thank you for choosing QuickTaste!

This email serves as your order payment receipt.
This is an automatically generated email. Please do not reply.

For assistance, please contact QuickTaste Support.

© ${new Date().getFullYear()} QuickTaste. All rights reserved.
        `.trim(),

        html: `
        <!DOCTYPE html>

        <html lang="en">

            <head>

                <meta charset="UTF-8">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <title>QuickTaste Payment Receipt</title>

            </head>

            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif; color: #222222;">

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">

                    <tr>

                        <td align="center" style="padding: 30px 12px;">

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 650px; background-color: #ffffff; border: 1px solid #e5e5e5;">

                                <!-- Header -->

                                <tr>

                                    <td align="center" style="padding: 30px 20px; background-color: #ffffff; border-bottom: 3px solid #065d23;">

                                        <h1 style="margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -1px; color: #065d23;">
                                            QuickTaste
                                        </h1>

                                        <p style="margin: 8px 0 0; font-size: 12px; letter-spacing: 2px; color: #777777; text-transform: uppercase;">
                                            Delicious Food, Delivered
                                        </p>

                                    </td>

                                </tr>

                                <!-- Receipt Heading -->

                                <tr>

                                    <td style="padding: 30px 28px 20px;">

                                        <h2 style="margin: 0 0 12px; font-size: 23px; color: #222222;">
                                            Thank you for your order!
                                        </h2>

                                        <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #666666;">
                                            Your payment receipt is below. Keep this email for your records.
                                        </p>

                                    </td>

                                </tr>

                                <!-- Invoice Details -->

                                <tr>

                                    <td style="padding: 0 28px 25px;">

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f8f8; border: 1px solid #eeeeee;">

                                            <tr>

                                                <td style="padding: 16px;">

                                                    <p style="margin: 0 0 6px; font-size: 11px; color: #777777; text-transform: uppercase; letter-spacing: 1px;">
                                                        Invoice Number
                                                    </p>

                                                    <p style="margin: 0; font-size: 14px; font-weight: 700; color: #222222; word-break: break-all;">
                                                        ${invoiceNumber}
                                                    </p>

                                                </td>

                                                <td align="right" style="padding: 16px;">

                                                    <p style="margin: 0 0 6px; font-size: 11px; color: #777777; text-transform: uppercase; letter-spacing: 1px;">
                                                        Total Paid
                                                    </p>

                                                    <p style="margin: 0; font-size: 22px; font-weight: 700; color: #065d23; white-space: nowrap;">
                                                        ${formatMoney(totalPaid)}
                                                    </p>

                                                </td>

                                            </tr>

                                        </table>

                                    </td>

                                </tr>

                                <!-- Order Information -->

                                <tr>

                                    <td style="padding: 0 28px 25px;">

                                        <h3 style="margin: 0 0 15px; padding-bottom: 10px; font-size: 16px; border-bottom: 1px solid #eeeeee;">
                                            Order Information
                                        </h3>

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

                                            <tr>

                                                <td style="padding: 6px 0; font-size: 13px; color: #777777;">
                                                    Order ID
                                                </td>

                                                <td align="right" style="padding: 6px 0; font-size: 13px; color: #222222; font-weight: 600; word-break: break-all;">
                                                    ${order._id}
                                                </td>

                                            </tr>

                                            <tr>

                                                <td style="padding: 6px 0; font-size: 13px; color: #777777;">
                                                    Customer
                                                </td>

                                                <td align="right" style="padding: 6px 0; font-size: 13px; color: #222222;">
                                                    ${customerName}
                                                </td>

                                            </tr>

                                            <tr>

                                                <td style="padding: 6px 0; font-size: 13px; color: #777777;">
                                                    Date Issued
                                                </td>

                                                <td align="right" style="padding: 6px 0; font-size: 13px; color: #222222;">
                                                    ${orderDate}
                                                </td>

                                            </tr>

                                        </table>

                                    </td>

                                </tr>

                                <!-- Items -->

                                <tr>

                                    <td style="padding: 0 28px 25px;">

                                        <h3 style="margin: 0 0 15px; padding-bottom: 10px; font-size: 16px; border-bottom: 1px solid #eeeeee;">
                                            Order Items
                                        </h3>

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; font-size: 12px;">

                                            <thead>

                                                <tr style="background-color: #f8f8f8;">

                                                    <th align="left" style="padding: 12px 8px; font-size: 11px; color: #777777;">
                                                        Item
                                                    </th>

                                                    <th align="center" style="padding: 12px 8px; font-size: 11px; color: #777777;">
                                                        Qty
                                                    </th>

                                                    <th align="right" style="padding: 12px 8px; font-size: 11px; color: #777777;">
                                                        Price
                                                    </th>

                                                    <th align="right" style="padding: 12px 8px; font-size: 11px; color: #777777;">
                                                        Total
                                                    </th>

                                                </tr>

                                            </thead>

                                            <tbody>

                                                ${itemsHtml}

                                            </tbody>

                                        </table>

                                    </td>

                                </tr>

                                <!-- Payment Summary -->

                                <tr>

                                    <td style="padding: 0 28px 25px;">

                                        <h3 style="margin: 0 0 15px; padding-bottom: 10px; font-size: 16px; border-bottom: 1px solid #eeeeee;">
                                            Payment Summary
                                        </h3>

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">

                                            <tr>

                                                <td style="padding: 8px 0; color: #666666;">
                                                    Subtotal
                                                </td>

                                                <td align="right" style="padding: 8px 0; color: #222222;">
                                                    ${formatMoney(subtotal)}
                                                </td>

                                            </tr>

                                            ${discountRowHtml}

                                            <tr>

                                                <td style="padding: 8px 0; color: #666666;">
                                                    Delivery Fee
                                                </td>

                                                <td align="right" style="padding: 8px 0; color: #222222;">
                                                    ${formatMoney(deliveryFee)}
                                                </td>

                                            </tr>

                                            <tr>

                                                <td colspan="2" style="padding-top: 12px; border-top: 1px solid #eeeeee;"></td>

                                            </tr>

                                            <tr>

                                                <td style="padding: 5px 0; font-size: 17px; font-weight: 700; color: #222222;">
                                                    Total Paid
                                                </td>

                                                <td align="right" style="padding: 5px 0; font-size: 20px; font-weight: 700; color: #065d23; white-space: nowrap;">
                                                    ${formatMoney(totalPaid)}
                                                </td>

                                            </tr>

                                        </table>

                                    </td>

                                </tr>

                                <!-- Payment Details -->

                                <tr>

                                    <td style="padding: 0 28px 25px;">

                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8f8f8; border: 1px solid #eeeeee;">

                                            <tr>

                                                <td style="padding: 18px;">

                                                    <h3 style="margin: 0 0 15px; font-size: 15px;">
                                                        Payment Details
                                                    </h3>

                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

                                                        <tr>

                                                            <td style="padding: 6px 0; font-size: 13px; color: #777777;">
                                                                Payment Method
                                                            </td>

                                                            <td align="right" style="padding: 6px 0; font-size: 13px; color: #222222; font-weight: 600;">
                                                                ${paymentMethod}
                                                            </td>

                                                        </tr>

                                                        <tr>

                                                            <td style="padding: 6px 0; font-size: 13px; color: #777777;">
                                                                Payment Status
                                                            </td>

                                                            <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${String(paymentStatus).toLowerCase() === "paid" || String(paymentStatus).toLowerCase() === "completed" ? "#0db049" : "#065d23"};">
                                                                ${paymentStatus}
                                                            </td>

                                                        </tr>

                                                    </table>

                                                </td>

                                            </tr>

                                        </table>

                                    </td>

                                </tr>

                                <!-- Billing / Delivery Address -->

                                <tr>

                                    <td style="padding: 0 28px 30px;">

                                        <h3 style="margin: 0 0 12px; padding-bottom: 10px; font-size: 16px; border-bottom: 1px solid #eeeeee;">
                                            Delivery Address
                                        </h3>

                                        <div style="font-size: 13px; line-height: 1.6; color: #555555;">

                                            ${billingAddressHtml || "Address not available"}

                                        </div>

                                    </td>

                                </tr>

                                <!-- Footer -->

                                <tr>

                                    <td align="center" style="padding: 25px 24px; background-color: #f8f8f8; border-top: 1px solid #eeeeee;">

                                        <p style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #222222;">
                                            Thank you for choosing QuickTaste!
                                        </p>

                                        <p style="margin: 0 0 12px; font-size: 12px; line-height: 1.7; color: #777777;">
                                            This email serves as your order receipt. Please keep it for your records.
                                        </p>

                                        <p style="margin: 0 0 12px; font-size: 12px; line-height: 1.7; color: #777777;">
                                            This is an automatically generated email. Please do not reply directly to this message.
                                        </p>

                                        <p style="margin: 0; font-size: 11px; color: #999999;">
                                            © ${new Date().getFullYear()} QuickTaste. All rights reserved.
                                        </p>

                                    </td>

                                </tr>

                            </table>

                        </td>

                    </tr>

                </table>

            </body>

        </html>
        `
    };

};

export default generateReceiptEmail;