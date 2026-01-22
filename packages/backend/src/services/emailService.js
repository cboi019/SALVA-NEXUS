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
    <head>
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0A0A0B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #1A1A1B; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.2);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 48px 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 42px; font-weight: 900; letter-spacing: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: rgba(10, 10, 11, 0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Digital Finance Platform</p>
        </div>
        
        <!-- Welcome Badge -->
        <div style="padding: 40px 40px 32px 40px;">
          <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; padding: 18px 28px; border-radius: 16px; text-align: center; font-weight: 900; font-size: 16px; letter-spacing: 2px; box-shadow: 0 4px 16px rgba(212, 175, 55, 0.3);">
            WELCOME TO SALVA 👋
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 40px 40px;">
          <p style="color: #FFFFFF; font-size: 18px; margin: 0 0 12px 0; font-weight: 700;">Hi ${userName},</p>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin: 0 0 24px 0; line-height: 1.7;">
            Your account has been successfully created, and your wallet is now ready to use.
          </p>
          
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin: 0 0 32px 0; line-height: 1.7;">
            SALVA is built to make crypto feel familiar — with simple account aliases, strong security, and transactions designed for everyday use.
          </p>
          
          <!-- Features Box -->
          <div style="background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 28px; margin-bottom: 28px;">
            <p style="color: #D4AF37; font-size: 15px; margin: 0 0 18px 0; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Here's what you can do next:</p>
            <ul style="margin: 0; padding-left: 20px; color: rgba(255, 255, 255, 0.8); font-size: 14px; line-height: 2.2;">
              <li><strong style="color: #D4AF37;">Receive NGNs</strong> and make transfers with ease</li>
              <li>Explore a wallet designed for <strong style="color: #D4AF37;">real-world payments</strong></li>
            </ul>
          </div>
          
          <!-- Security Reminder Box -->
          <div style="background: rgba(212, 175, 55, 0.1); border-left: 4px solid #D4AF37; padding: 20px 24px; border-radius: 12px; margin-bottom: 28px;">
            <p style="color: #D4AF37; font-size: 14px; margin: 0 0 10px 0; font-weight: 800;">🔐 Security reminder</p>
            <p style="color: rgba(255, 255, 255, 0.75); font-size: 13px; margin: 0; line-height: 1.7;">
              SALVA will never ask for your password, PIN, or private keys. If you ever notice suspicious activity, contact support immediately.
            </p>
          </div>
          
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin: 0; line-height: 1.7; text-align: center;">
            We're excited to have you on board.<br>
            <strong style="color: #D4AF37; font-size: 16px;">Welcome to the future of everyday crypto.</strong>
          </p>
          
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 14px; margin: 28px 0 0 0; text-align: center; font-style: italic;">
            — The SALVA Team
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: rgba(0, 0, 0, 0.3); padding: 32px 40px; border-top: 1px solid rgba(212, 175, 55, 0.2);">
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 13px; margin: 0 0 18px 0; text-align: center;">
            Need help? Contact our support team
          </p>
          <div style="text-align: center;">
            <a href="mailto:salva.notify@gmail.com" 
               style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 1px; box-shadow: 0 4px 16px rgba(212, 175, 55, 0.4);">
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
  
  const statusColor = status === 'successful' 
    ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
    : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)';
  const statusText = status === 'successful' ? 'PAYMENT SENT' : 'PAYMENT FAILED';
  const statusIcon = status === 'successful' ? '✓' : '✕';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0A0A0B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #1A1A1B; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.2);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 48px 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 42px; font-weight: 900; letter-spacing: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: rgba(10, 10, 11, 0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Digital Finance Platform</p>
        </div>
        
        <!-- Status Badge -->
        <div style="padding: 40px 40px 32px 40px;">
          <div style="background: ${statusColor}; color: white; padding: 18px 28px; border-radius: 16px; text-align: center; font-weight: 900; font-size: 16px; letter-spacing: 2px; box-shadow: 0 4px 16px ${status === 'successful' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
            ${statusIcon} ${statusText}
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 40px 40px;">
          <p style="color: #FFFFFF; font-size: 18px; margin: 0 0 12px 0; font-weight: 700;">Hello ${senderName},</p>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin: 0 0 32px 0; line-height: 1.7;">
            ${status === 'successful' 
              ? 'Your payment has been successfully processed and sent to the recipient.' 
              : 'We were unable to process your payment at this time. Please try again or contact support if the issue persists.'}
          </p>
          
          <!-- Transaction Details Box -->
          <div style="background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 28px; margin-bottom: 28px;">
            <div style="margin-bottom: 24px;">
              <p style="color: rgba(212, 175, 55, 0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0; font-weight: 800;">Amount</p>
              <p style="color: #FFFFFF; font-size: 38px; font-weight: 900; margin: 0; letter-spacing: -2px;">${formatAmount(amount)} <span style="color: #D4AF37; font-size: 18px; font-weight: 700;">NGNs</span></p>
            </div>
            
            <div style="border-top: 1px solid rgba(212, 175, 55, 0.2); padding-top: 20px;">
              <p style="color: rgba(212, 175, 55, 0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0; font-weight: 800;">Recipient</p>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 15px; font-weight: 600; margin: 0; font-family: 'Courier New', monospace; word-break: break-all;">${recipientIdentifier}</p>
            </div>
          </div>
          
          ${status === 'successful' ? `
          <div style="background: rgba(16, 185, 129, 0.15); border-left: 4px solid #10B981; padding: 18px 24px; border-radius: 12px; margin-bottom: 28px;">
            <p style="color: #10B981; font-size: 14px; margin: 0; font-weight: 700;">✓ Transaction verified on Base Sepolia blockchain</p>
          </div>
          ` : `
          <div style="background: rgba(239, 68, 68, 0.15); border-left: 4px solid #EF4444; padding: 18px 24px; border-radius: 12px; margin-bottom: 28px;">
            <p style="color: #EF4444; font-size: 14px; margin: 0; font-weight: 700;">! Please ensure you have sufficient balance and try again</p>
          </div>
          `}
        </div>
        
        <!-- Footer -->
        <div style="background: rgba(0, 0, 0, 0.3); padding: 32px 40px; border-top: 1px solid rgba(212, 175, 55, 0.2);">
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 13px; margin: 0 0 18px 0; text-align: center;">Need help? Contact our support team</p>
          <div style="text-align: center;">
            <a href="mailto:salva.notify@gmail.com" 
               style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 1px; box-shadow: 0 4px 16px rgba(212, 175, 55, 0.4);">
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
    <head>
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0A0A0B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #1A1A1B; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.2);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 48px 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 42px; font-weight: 900; letter-spacing: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: rgba(10, 10, 11, 0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Digital Finance Platform</p>
        </div>
        
        <!-- Status Badge -->
        <div style="padding: 40px 40px 32px 40px;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 18px 28px; border-radius: 16px; text-align: center; font-weight: 900; font-size: 16px; letter-spacing: 2px; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);">
            💰 PAYMENT RECEIVED
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 40px 40px;">
          <p style="color: #FFFFFF; font-size: 18px; margin: 0 0 12px 0; font-weight: 700;">Hello ${receiverName},</p>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin: 0 0 32px 0; line-height: 1.7;">
            You have received a payment. The funds are now available in your SALVA wallet.
          </p>
          
          <!-- Transaction Details Box -->
          <div style="background: rgba(212, 175, 55, 0.08); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 28px; margin-bottom: 28px;">
            <div style="margin-bottom: 24px;">
              <p style="color: rgba(212, 175, 55, 0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0; font-weight: 800;">Amount Received</p>
              <p style="color: #10B981; font-size: 38px; font-weight: 900; margin: 0; letter-spacing: -2px;">+${formatAmount(amount)} <span style="color: #D4AF37; font-size: 18px; font-weight: 700;">NGNs</span></p>
            </div>
            
            <div style="border-top: 1px solid rgba(212, 175, 55, 0.2); padding-top: 20px;">
              <p style="color: rgba(212, 175, 55, 0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0; font-weight: 800;">From</p>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 15px; font-weight: 600; margin: 0; font-family: 'Courier New', monospace; word-break: break-all;">${senderIdentifier}</p>
            </div>
          </div>
          
          <div style="background: rgba(16, 185, 129, 0.15); border-left: 4px solid #10B981; padding: 18px 24px; border-radius: 12px; margin-bottom: 28px;">
            <p style="color: #10B981; font-size: 14px; margin: 0; font-weight: 700;">✓ Transaction verified on Base Sepolia blockchain</p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: rgba(0, 0, 0, 0.3); padding: 32px 40px; border-top: 1px solid rgba(212, 175, 55, 0.2);">
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 13px; margin: 0 0 18px 0; text-align: center;">Need help? Contact our support team</p>
          <div style="text-align: center;">
            <a href="mailto:salva.notify@gmail.com" 
               style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 1px; box-shadow: 0 4px 16px rgba(212, 175, 55, 0.4);">
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
// SECURITY CHANGE EMAIL - FOR OLD EMAIL (WARNING)
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
    <head>
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0A0A0B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #1A1A1B; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.2);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 48px 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 42px; font-weight: 900; letter-spacing: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: rgba(10, 10, 11, 0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Security Alert</p>
        </div>
        
        <!-- Alert Badge -->
        <div style="padding: 40px 40px 32px 40px;">
          <div style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; padding: 18px 28px; border-radius: 16px; text-align: center; font-weight: 900; font-size: 16px; letter-spacing: 2px; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);">
            ⚠️ ACCOUNT SECURITY CHANGE
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 40px 40px;">
          <p style="color: #FFFFFF; font-size: 18px; margin: 0 0 12px 0; font-weight: 700;">Hello ${userName},</p>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin: 0 0 28px 0; line-height: 1.7;">
            Your <strong style="color: #D4AF37;">${changeTypeText[changeType]}</strong> has been successfully changed.
          </p>
          
          <!-- Security Info Box -->
          <div style="background: rgba(245, 158, 11, 0.15); border: 2px solid rgba(245, 158, 11, 0.4); border-radius: 16px; padding: 28px; margin-bottom: 28px;">
            <p style="color: #F59E0B; font-size: 15px; margin: 0 0 14px 0; font-weight: 800;">🔒 Account Restricted for 24 Hours</p>
            <p style="color: rgba(255, 255, 255, 0.75); font-size: 14px; margin: 0; line-height: 1.7;">
              As a security measure, your account has been temporarily restricted for 24 hours. You will not be able to perform transactions during this period.
            </p>
          </div>
          
          <!-- Warning Box -->
          <div style="background: rgba(239, 68, 68, 0.15); border-left: 4px solid #EF4444; padding: 24px; border-radius: 12px; margin-bottom: 28px;">
            <p style="color: #EF4444; font-size: 15px; margin: 0 0 14px 0; font-weight: 800;">❗ Didn't make this change?</p>
            <p style="color: rgba(255, 255, 255, 0.75); font-size: 14px; margin: 0 0 18px 0; line-height: 1.7;">
              If you did not authorize this change, your account may have been compromised. Please contact our support team immediately.
            </p>
            <p style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin: 0 0 6px 0;">
              <strong style="color: #D4AF37;">Your Account Number:</strong>
            </p>
            <p style="font-family: 'Courier New', monospace; background: rgba(212, 175, 55, 0.1); color: #D4AF37; padding: 12px 16px; border-radius: 8px; font-size: 15px; font-weight: 700; margin: 0 0 8px 0; border: 1px solid rgba(212, 175, 55, 0.3);">${accountNumber}</p>
            <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin: 0; font-style: italic;">
              (Include this in your support message)
            </p>
          </div>
          
          <!-- Contact Support Button -->
          <div style="text-align: center; margin: 36px 0 0 0;">
            <a href="mailto:salva.notify@gmail.com?subject=Unauthorized%20Account%20Change%20-%20${accountNumber}&body=Account%20Number:%20${accountNumber}%0A%0AI%20did%20not%20authorize%20the%20recent%20${changeTypeText[changeType]}%20change%20on%20my%20account.%20Please%20help%20me%20secure%20my%20account%20immediately." 
               style="display: inline-block; background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 15px; letter-spacing: 1.5px; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);">
              CONTACT SUPPORT
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: rgba(0, 0, 0, 0.3); padding: 32px 40px; border-top: 1px solid rgba(212, 175, 55, 0.2);">
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 13px; margin: 0; text-align: center;">SALVA Security Team</p>
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

// ===============================================
// EMAIL CHANGE CONFIRMATION - FOR NEW EMAIL (NO WARNING)
// ===============================================
async function sendEmailChangeConfirmation(newEmail, userName, accountNumber) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0A0A0B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background: #1A1A1B; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.2);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); padding: 48px 40px; text-align: center;">
          <h1 style="margin: 0; color: #0A0A0B; font-size: 42px; font-weight: 900; letter-spacing: 5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">SALVA</h1>
          <p style="margin: 8px 0 0 0; color: rgba(10, 10, 11, 0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Digital Finance Platform</p>
        </div>
        
        <!-- Success Badge -->
        <div style="padding: 40px 40px 32px 40px;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 18px 28px; border-radius: 16px; text-align: center; font-weight: 900; font-size: 16px; letter-spacing: 2px; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);">
            ✓ EMAIL UPDATED SUCCESSFULLY
          </div>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 0 40px 40px 40px;">
          <p style="color: #FFFFFF; font-size: 18px; margin: 0 0 12px 0; font-weight: 700;">Hello ${userName},</p>
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 15px; margin: 0 0 28px 0; line-height: 1.7;">
            Your email address has been successfully updated. This is now your primary email for all SALVA communications and notifications.
          </p>
          
          <!-- Info Box -->
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 28px; margin-bottom: 28px;">
            <p style="color: #10B981; font-size: 15px; margin: 0 0 14px 0; font-weight: 800;">✓ Your new email is now active</p>
            <p style="color: rgba(255, 255, 255, 0.75); font-size: 14px; margin: 0 0 20px 0; line-height: 1.7;">
              You'll receive all future account notifications, transaction alerts, and security updates at this email address.
            </p>
            <p style="color: rgba(255, 255, 255, 0.8); font-size: 13px; margin: 0 0 6px 0;">
              <strong style="color: #D4AF37;">Your Account Number:</strong>
            </p>
            <p style="font-family: 'Courier New', monospace; background: rgba(212, 175, 55, 0.1); color: #D4AF37; padding: 12px 16px; border-radius: 8px; font-size: 15px; font-weight: 700; margin: 0; border: 1px solid rgba(212, 175, 55, 0.3);">${accountNumber}</p>
          </div>
          
          <!-- Security Notice Box -->
          <div style="background: rgba(245, 158, 11, 0.15); border-left: 4px solid #F59E0B; padding: 20px 24px; border-radius: 12px; margin-bottom: 28px;">
            <p style="color: #F59E0B; font-size: 14px; margin: 0 0 10px 0; font-weight: 800;">🔒 24-Hour Security Lock Active</p>
            <p style="color: rgba(255, 255, 255, 0.75); font-size: 13px; margin: 0; line-height: 1.7;">
              As a security measure, your account has been temporarily restricted for 24 hours. You will not be able to perform transactions during this period.
            </p>
          </div>
          
          <p style="color: rgba(255, 255, 255, 0.7); font-size: 14px; margin: 0; line-height: 1.7; text-align: center;">
            Thank you for keeping your account information up to date.
          </p>
          
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 14px; margin: 28px 0 0 0; text-align: center; font-style: italic;">
            — The SALVA Team
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: rgba(0, 0, 0, 0.3); padding: 32px 40px; border-top: 1px solid rgba(212, 175, 55, 0.2);">
          <p style="color: rgba(255, 255, 255, 0.5); font-size: 13px; margin: 0 0 18px 0; text-align: center;">Need help? Contact our support team</p>
          <div style="text-align: center;">
            <a href="mailto:salva.notify@gmail.com" 
               style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #0A0A0B; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 1px; box-shadow: 0 4px 16px rgba(212, 175, 55, 0.4);">
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
      to: newEmail,
      subject: '✓ Email Updated Successfully - SALVA',
      html: html
    });
    console.log(`📧 Email change confirmation sent to: ${newEmail}`);
  } catch (error) {
    console.error('❌ Failed to send email change confirmation:', error.message);
  }
}

module.exports = {
  sendWelcomeEmail,
  sendTransactionEmailToSender,
  sendTransactionEmailToReceiver,
  sendSecurityChangeEmail,
  sendEmailChangeConfirmation
};