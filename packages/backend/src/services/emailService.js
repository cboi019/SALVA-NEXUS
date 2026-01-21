// Salva-Digital-Tech/packages/backend/src/services/emailService.js
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Format number with commas
const formatAmount = (amount) => {
  return parseFloat(amount).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

// ===============================================
// WELCOME EMAIL - NEW USER REGISTRATION
// ===============================================
async function sendWelcomeEmail(userEmail, userName) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 36px; font-weight: 900; letter-spacing: 3px;">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: #0A0A0B; opacity: 0.8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Digital Finance Platform</p>
        </div>
        
        <!-- Welcome Badge -->
        <div style="padding: 32px 40px 24px 40px;">
          <div style="background: #10B981; color: white; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 900; font-size: 15px; letter-spacing: 1.5px;">
            WELCOME TO SALVA 👋
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 32px 40px;">
          <p style="color: #1F2937; font-size: 17px; margin: 0 0 12px 0; font-weight: 600;">Hi ${userName},</p>
          <p style="color: #6B7280; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6;">
            Your account has been successfully created, and your wallet is now ready to use.
          </p>
          
          <p style="color: #6B7280; font-size: 15px; margin: 0 0 32px 0; line-height: 1.6;">
            SALVA is built to make crypto feel familiar — with simple account aliases, strong security, and transactions designed for everyday use.
          </p>
          
          <!-- Features Box -->
          <div style="background: #F9FAFB; border: 2px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #1F2937; font-size: 15px; margin: 0 0 16px 0; font-weight: 700;">Here's what you can do next:</p>
            <ul style="margin: 0; padding-left: 20px; color: #6B7280; font-size: 14px; line-height: 2;">
              <li><strong>Receive NGNs</strong> and make transfers with ease</li>
              <li>Explore a wallet designed for <strong>real-world payments</strong></li>
            </ul>
          </div>
          
          <!-- Security Reminder Box -->
          <div style="background: #ECFDF5; border-left: 4px solid #10B981; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #065F46; font-size: 14px; margin: 0 0 8px 0; font-weight: 700;">🔐 Security reminder</p>
            <p style="color: #047857; font-size: 13px; margin: 0; line-height: 1.6;">
              SALVA will never ask for your password, PIN, or private keys. If you ever notice suspicious activity, contact support immediately.
            </p>
          </div>
          
          <p style="color: #6B7280; font-size: 15px; margin: 0; line-height: 1.6; text-align: center;">
            We're excited to have you on board.<br>
            <strong style="color: #1F2937;">Welcome to the future of everyday crypto.</strong>
          </p>
          
          <p style="color: #9CA3AF; font-size: 14px; margin: 24px 0 0 0; text-align: center; font-style: italic;">
            — The SALVA Team
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 16px 0; text-align: center;">
            This is an automated message. If you need help, contact us:
          </p>
          <div style="text-align: center;">
            <a href="mailto:salva.notify@gmail.com" 
               style="display: inline-block; background: #D4AF37; color: #0A0A0B; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'Salva <no-reply@salva-nexus.org>',
      to: userEmail,
      subject: 'Welcome to SALVA — your account is ready',
      html: html
    });
    console.log(`📧 Welcome email sent to: ${userEmail}`);
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
  }
}

// ===============================================
// TRANSACTION EMAIL - SENDER
// ===============================================
async function sendTransactionEmailToSender(senderEmail, senderName, recipientIdentifier, amount, status) {
  const subject = status === 'successful' 
    ? '✅ Payment Sent Successfully - SALVA'
    : '❌ Payment Failed - SALVA';
  
  const statusColor = status === 'successful' ? '#10B981' : '#EF4444';
  const statusText = status === 'successful' ? 'PAYMENT SENT' : 'PAYMENT FAILED';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 36px; font-weight: 900; letter-spacing: 3px;">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: #0A0A0B; opacity: 0.8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Digital Finance Platform</p>
        </div>
        
        <!-- Status Badge -->
        <div style="padding: 32px 40px 24px 40px;">
          <div style="background: ${statusColor}; color: white; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 900; font-size: 15px; letter-spacing: 1.5px;">
            ${statusText}
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 32px 40px;">
          <p style="color: #1F2937; font-size: 17px; margin: 0 0 12px 0; font-weight: 600;">Hello ${senderName},</p>
          <p style="color: #6B7280; font-size: 15px; margin: 0 0 32px 0; line-height: 1.6;">
            ${status === 'successful' 
              ? 'Your payment has been successfully processed and sent to the recipient.' 
              : 'We were unable to process your payment at this time. Please try again or contact support if the issue persists.'}
          </p>
          
          <!-- Transaction Details Box -->
          <div style="background: #F9FAFB; border: 2px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <div style="margin-bottom: 20px;">
              <p style="color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; font-weight: 700;">Amount</p>
              <p style="color: #1F2937; font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -1px;">${formatAmount(amount)} <span style="color: #D4AF37; font-size: 16px; font-weight: 700;">NGNs</span></p>
            </div>
            
            <div style="border-top: 1px solid #E5E7EB; padding-top: 16px;">
              <p style="color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; font-weight: 700;">Recipient</p>
              <p style="color: #1F2937; font-size: 15px; font-weight: 600; margin: 0; font-family: 'Courier New', monospace;">${recipientIdentifier}</p>
            </div>
          </div>
          
          ${status === 'successful' ? `
          <div style="background: #ECFDF5; border-left: 4px solid #10B981; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #065F46; font-size: 14px; margin: 0; font-weight: 600;">✓ Transaction verified on Base Sepolia blockchain</p>
          </div>
          ` : `
          <div style="background: #FEF2F2; border-left: 4px solid #EF4444; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #991B1B; font-size: 14px; margin: 0; font-weight: 600;">! Please ensure you have sufficient balance and try again</p>
          </div>
          `}
        </div>
        
        <!-- Footer -->
        <div style="background: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 8px 0; text-align: center;">Need help? Contact our support team</p>
          <p style="text-align: center; margin: 0;">
            <a href="mailto:salva.notify@gmail.com" style="color: #D4AF37; text-decoration: none; font-weight: 700; font-size: 14px;">salva.notify@gmail.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'Salva <no-reply@salva-nexus.org>',
      to: senderEmail,
      subject: subject,
      html: html
    });
    console.log(`📧 Sender email sent to: ${senderEmail}`);
  } catch (error) {
    console.error('❌ Failed to send sender email:', error.message);
  }
}

// ===============================================
// TRANSACTION EMAIL - RECEIVER
// ===============================================
async function sendTransactionEmailToReceiver(receiverEmail, receiverName, senderIdentifier, amount) {
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 36px; font-weight: 900; letter-spacing: 3px;">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: #0A0A0B; opacity: 0.8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Digital Finance Platform</p>
        </div>
        
        <!-- Status Badge -->
        <div style="padding: 32px 40px 24px 40px;">
          <div style="background: #10B981; color: white; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 900; font-size: 15px; letter-spacing: 1.5px;">
            PAYMENT RECEIVED
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 32px 40px;">
          <p style="color: #1F2937; font-size: 17px; margin: 0 0 12px 0; font-weight: 600;">Hello ${receiverName},</p>
          <p style="color: #6B7280; font-size: 15px; margin: 0 0 32px 0; line-height: 1.6;">
            You have received a payment. The funds are now available in your SALVA wallet.
          </p>
          
          <!-- Transaction Details Box -->
          <div style="background: #F9FAFB; border: 2px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <div style="margin-bottom: 20px;">
              <p style="color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; font-weight: 700;">Amount Received</p>
              <p style="color: #10B981; font-size: 32px; font-weight: 900; margin: 0; letter-spacing: -1px;">+${formatAmount(amount)} <span style="color: #D4AF37; font-size: 16px; font-weight: 700;">NGNs</span></p>
            </div>
            
            <div style="border-top: 1px solid #E5E7EB; padding-top: 16px;">
              <p style="color: #9CA3AF; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0; font-weight: 700;">From</p>
              <p style="color: #1F2937; font-size: 15px; font-weight: 600; margin: 0; font-family: 'Courier New', monospace;">${senderIdentifier}</p>
            </div>
          </div>
          
          <div style="background: #ECFDF5; border-left: 4px solid #10B981; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #065F46; font-size: 14px; margin: 0; font-weight: 600;">✓ Transaction verified on Base Sepolia blockchain</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 8px 0; text-align: center;">Need help? Contact our support team</p>
          <p style="text-align: center; margin: 0;">
            <a href="mailto:salva.notify@gmail.com" style="color: #D4AF37; text-decoration: none; font-weight: 700; font-size: 14px;">salva.notify@gmail.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'Salva <no-reply@salva-nexus.org>',
      to: receiverEmail,
      subject: '💰 Payment Received - SALVA',
      html: html
    });
    console.log(`📧 Receiver email sent to: ${receiverEmail}`);
  } catch (error) {
    console.error('❌ Failed to send receiver email:', error.message);
  }
}

// ===============================================
// SECURITY CHANGE EMAIL
// ===============================================
async function sendSecurityChangeEmail(userEmail, userName, changeType, accountNumber) {
  const changeTypeText = {
    'email': 'Email Address',
    'password': 'Password',
    'pin': 'Transaction PIN'
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 36px; font-weight: 900; letter-spacing: 3px;">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: #0A0A0B; opacity: 0.8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Security Alert</p>
        </div>
        
        <!-- Alert Badge -->
        <div style="padding: 32px 40px 24px 40px;">
          <div style="background: #F59E0B; color: white; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 900; font-size: 15px; letter-spacing: 1.5px;">
            ⚠️ ACCOUNT SECURITY CHANGE
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 32px 40px;">
          <p style="color: #1F2937; font-size: 17px; margin: 0 0 12px 0; font-weight: 600;">Hello ${userName},</p>
          <p style="color: #6B7280; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6;">
            Your <strong>${changeTypeText[changeType]}</strong> has been successfully changed.
          </p>
          
          <!-- Security Info Box -->
          <div style="background: #FEF3C7; border: 2px solid #F59E0B; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #92400E; font-size: 15px; margin: 0 0 12px 0; font-weight: 700;">🔒 Account Restricted for 24 Hours</p>
            <p style="color: #78350F; font-size: 14px; margin: 0; line-height: 1.6;">
              As a security measure, your account has been temporarily restricted for 24 hours. You will not be able to perform transactions during this period.
            </p>
          </div>
          
          <!-- Warning Box -->
          <div style="background: #FEF2F2; border-left: 4px solid #EF4444; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #991B1B; font-size: 15px; margin: 0 0 12px 0; font-weight: 700;">❗ Didn't make this change?</p>
            <p style="color: #7F1D1D; font-size: 14px; margin: 0 0 16px 0; line-height: 1.6;">
              If you did not authorize this change, your account may have been compromised. Please contact our support team immediately.
            </p>
            <p style="color: #7F1D1D; font-size: 13px; margin: 0 0 4px 0;">
              <strong>Your Account Number:</strong> <span style="font-family: 'Courier New', monospace; background: #FFFFFF; padding: 4px 8px; border-radius: 4px;">${accountNumber}</span>
            </p>
            <p style="color: #9CA3AF; font-size: 12px; margin: 0; font-style: italic;">
              (Include this in your support message)
            </p>
          </div>
          
          <!-- Contact Support Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="mailto:salva.notify@gmail.com?subject=Unauthorized%20Account%20Change%20-%20${accountNumber}&body=Account%20Number:%20${accountNumber}%0A%0AI%20did%20not%20authorize%20the%20recent%20${changeTypeText[changeType]}%20change%20on%20my%20account.%20Please%20help%20me%20secure%20my%20account%20immediately." 
               style="display: inline-block; background: #EF4444; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 15px; letter-spacing: 1px; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);">
              CONTACT SUPPORT
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
          <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 8px 0; text-align: center;">SALVA Security Team</p>
          <p style="text-align: center; margin: 0;">
            <a href="mailto:salva.notify@gmail.com" style="color: #D4AF37; text-decoration: none; font-weight: 700; font-size: 14px;">salva.notify@gmail.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: 'Salva Security <no-reply@salva-nexus.org>',
      to: userEmail,
      subject: `🔒 Security Alert: ${changeTypeText[changeType]} Changed - SALVA`,
      html: html
    });
    console.log(`📧 Security alert sent to: ${userEmail}`);
  } catch (error) {
    console.error('❌ Failed to send security email:', error.message);
  }
}

module.exports = {
  sendWelcomeEmail,
  sendTransactionEmailToSender,
  sendTransactionEmailToReceiver,
  sendSecurityChangeEmail
};