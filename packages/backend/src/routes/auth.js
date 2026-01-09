import express from 'express';
import nodemailer from 'nodemailer';
const router = express.Router();

// Temporary storage for OTPs (Email -> {code, expires})
const otpStore = {};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'charlieonyii42@gmail.com',
    pass: 'YOUR_16_DIGIT_APP_PASSWORD' // NOT your regular password
  }
});

// 1. SEND OTP
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
  
  otpStore[email] = {
    code: otp,
    expires: Date.now() + 600000 // 10 minutes
  };

  try {
    await transporter.sendMail({
      from: '"Salva Nexus" <charlieonyii42@gmail.com>',
      to: email,
      subject: "Verify your Salva Account",
      html: `<h1 style="color: #D4AF37;">Verification Code: ${otp}</h1>
             <p>This code will expire in 10 minutes.</p>`
    });
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending email' });
  }
});

// 2. VERIFY OTP
router.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const record = otpStore[email];

  if (!record || record.code !== code || Date.now() > record.expires) {
    return res.status(400).json({ message: 'Invalid or expired code' });
  }

  delete otpStore[email]; // Clear OTP after use
  res.json({ success: true });
});

export default router;