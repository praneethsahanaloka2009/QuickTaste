const generateLocationConfirmationEmail = ({ customerName, orderId, otp, expiryMinutes }) => {
    const subject = "QuickTaste | Confirm Your Delivery Location";
    const text = `
    Hello ${customerName},

    Great news! Your QuickTaste order is on its way.

    Order ID: #${orderId}

    To help your delivery rider find you at the correct location, please verify your current delivery location.

    Your One-Time Verification Code:

    ${otp}

    This code is valid for ${expiryMinutes} minutes.

    After verification, please open QuickTaste and confirm your current location.

    For your security, never share this verification code with anyone.

    If you did not request this code, you can safely ignore this email.

    Thank you for choosing QuickTaste!

    Best regards,
    The QuickTaste Team
    `;

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>

        <body style="margin:0;padding:30px 12px;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;">

            <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e9e6;">

                <div style="background:#065d23;padding:30px;text-align:center;">
                    <h1 style="color:#ffffff;margin:0;font-size:30px;letter-spacing:1px;">
                        QuickTaste
                    </h1>
                    <p style="color:#d9f4e1;margin:10px 0 0;font-size:14px;">
                        Fresh Food, Delivered With Care
                    </p>
                </div>

                <div style="padding:32px 28px;">
                
                    <h2 style="color:#202820;font-size:24px;margin:0 0 18px;">
                        Your Order Is On Its Way!
                    </h2>

                    <p style="color:#555;font-size:15px;line-height:1.7;">
                        Hello <strong>${customerName}</strong>,
                    </p>

                    <p style="color:#555;font-size:15px;line-height:1.7;">
                        Great news! Your QuickTaste order is out for delivery.
                        To help your rider reach you at the correct location,
                        please verify and confirm your current delivery location.
                    </p>

                    <div style="background:#f4f8f5;border-radius:10px;padding:16px;text-align:center;margin:24px 0;">
                        <p style="font-size:12px;color:#777;margin:0 0 6px;">
                            ORDER REFERENCE
                        </p>
                        <p style="font-size:14px;color:#065d23;font-weight:bold;margin:0;word-break:break-all;">
                            #${orderId}
                        </p>
                    </div>

                    <p style="text-align:center;font-size:14px;color:#555;margin:0 0 12px;">
                        Your Location Verification Code
                    </p>

                    <div style="background:#eaf6ee;border:2px dashed #065d23;border-radius:12px;padding:22px;text-align:center;">
                        <span style="font-size:36px;letter-spacing:9px;font-weight:bold;color:#065d23;">
                            ${otp}
                        </span>
                    </div>

                    <p style="text-align:center;font-size:13px;color:#777;margin:16px 0 24px;">
                        This code expires in <strong>${expiryMinutes} minutes</strong>.
                    </p>

                    <h3 style="font-size:16px;color:#202820;">
                        What happens next?
                    </h3>

                    <p style="font-size:14px;color:#555;line-height:1.8;">
                        1. Open QuickTaste.<br>
                        2. Enter your verification code.<br>
                        3. Allow location access or select your location on the map.<br>
                        4. Submit your location for delivery confirmation.
                    </p>

                    <p style="font-size:13px;color:#777;line-height:1.7;margin-top:24px;">
                        For your security, never share this code with anyone.
                        If you did not request it, please ignore this email.
                    </p>

                    <p style="font-size:14px;color:#555;line-height:1.7;margin-top:28px;">
                        Thank you for choosing QuickTaste!<br>
                        <strong>The QuickTaste Team</strong>
                    </p>

                </div>

                <div style="background:#f7f9f7;padding:22px;text-align:center;border-top:1px solid #e9ece9;">
                    <p style="color:#777;font-size:12px;margin:0;">
                        © ${new Date().getFullYear()} QuickTaste. All rights reserved.
                    </p>
                    <p style="color:#999;font-size:12px;margin:8px 0 0;">
                        This is an automated email. Please do not reply.
                    </p>
                </div>

            </div>

        </body>
        </html>
        `;

        return { subject, text, html };
};

export default generateLocationConfirmationEmail;