import { API_BASE_URL } from '../config';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import Stars from '../components/Stars';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const navigate = useNavigate();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setStep(2);
        setMessage({ text: 'Verification code sent to your email!', type: 'success' });
      } else {
        setMessage({ text: 'User not found or error sending email.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network error. Is the backend running?', type: 'error' });
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp })
      });
      if (res.ok) {
        setStep(3);
        setMessage({ text: 'Code verified! Set your new password.', type: 'success' });
      } else {
        setMessage({ text: 'Invalid or expired code.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Verification failed.', type: 'error' });
    }
    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setMessage({ text: 'Passwords do not match!', type: 'error' });

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      if (res.ok) {
        setMessage({ text: 'Password reset successful! Redirecting...', type: 'success' });
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err) {
      setMessage({ text: 'Failed to update password.', type: 'error' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center px-4 relative overflow-hidden">
      <Stars />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 relative z-10"
      >
        <h2 className="text-3xl font-black mb-2 tracking-tighter">RESET PASSWORD</h2>
        <p className="text-xs text-salvaGold uppercase tracking-[0.3em] font-bold mb-8">
          {step === 1 && "Identify your account"}
          {step === 2 && "Check your inbox"}
          {step === 3 && "Secure your vault"}
        </p>

        <form onSubmit={step === 1 ? handleSendOTP : step === 2 ? handleVerifyOTP : handleResetPassword} className="space-y-6">
          {step === 1 && (
            <div>
              <label className="text-[10px] uppercase opacity-40 font-bold mb-2 block">Email Address</label>
              <input 
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-2xl bg-white/5 border border-transparent focus:border-salvaGold outline-none font-bold transition-all"
                placeholder="charlie@salva.com"
              />
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="text-[10px] uppercase opacity-40 font-bold mb-2 block">6-Digit Code</label>
              <input 
                required type="text" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)}
                className="w-full p-4 rounded-2xl bg-white/5 border border-transparent focus:border-salvaGold outline-none font-bold text-center text-2xl tracking-[0.5em]"
                placeholder="000000"
              />
            </div>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="text-[10px] uppercase opacity-40 font-bold mb-2 block">New Password</label>
                <input 
                  required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-white/5 border border-transparent focus:border-salvaGold outline-none font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase opacity-40 font-bold mb-2 block">Confirm Password</label>
                <input 
                  required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-white/5 border border-transparent focus:border-salvaGold outline-none font-bold"
                />
              </div>
            </>
          )}

          <button 
            disabled={loading}
            className="w-full py-4 bg-salvaGold text-black font-black rounded-2xl hover:brightness-110 transition-all uppercase tracking-widest text-sm"
          >
            {loading ? "Processing..." : step === 1 ? "Send Code" : step === 2 ? "Verify Code" : "Update Password"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link to="/login" className="text-[10px] uppercase opacity-40 hover:opacity-100 transition-opacity font-bold">
            Back to Login
          </Link>
        </div>

        <AnimatePresence>
          {message.text && (
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`mt-4 text-[10px] uppercase font-bold text-center ${message.type === 'error' ? 'text-red-500' : 'text-salvaGold'}`}
            >
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;