// Dashboard.jsx - SALVA DIGITAL TECH STABLECOIN DASHBOARD
import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import { jsPDF } from "jspdf";
import Stars from '../components/Stars';
import salvaLogo from '../assets/salva-logo.png';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState('0.00');
  const [transactions, setTransactions] = useState([]);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [transferData, setTransferData] = useState({ to: '', amount: '' });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [amountError, setAmountError] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  const navigate = useNavigate(); // Hook for redirection

  useEffect(() => {
    const savedUser = localStorage.getItem('salva_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        fetchBalance(parsedUser.safeAddress);
        fetchTransactions(parsedUser.safeAddress);
      } catch (error) {
        window.location.href = '/login';
      }
    } else {
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => setNotification({ ...notification, show: false }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (transferData.amount && balance) {
      const amt = parseFloat(transferData.amount);
      const bal = parseFloat(balance);
      setAmountError(amt > bal);
    } else {
      setAmountError(false);
    }
  }, [transferData.amount, balance]);

  const showMsg = (msg, type = 'success') =>
    setNotification({ show: true, message: msg, type });

  const fetchBalance = async (address) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/balance/${address}`);
      const data = await res.json();
      setBalance(parseFloat(data.balance || 0).toFixed(2));
    } catch {
      setBalance('0.00');
    }
  };

  const fetchTransactions = async (address) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/transactions/${address}`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setTransactions([]);
    }
  };

  const formatNumber = (num) =>
    parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  const downloadReceipt = (e, tx) => {
    e.stopPropagation(); // Prevents redirection when clicking receipt
    const doc = new jsPDF();
    const gold = [212, 175, 55];
    const dark = [10, 10, 11];

    doc.setFillColor(dark[0], dark[1], dark[2]);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(1);
    doc.rect(10, 10, 190, 277);

    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.setFontSize(40);
    doc.setFont("helvetica", "bold");
    doc.text("SALVA", 105, 45, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("OFFICIAL TRANSACTION RECEIPT", 105, 55, { align: "center" });
    
    doc.setDrawColor(255, 255, 255, 0.1);
    doc.line(30, 65, 180, 65);

    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text("AMOUNT TRANSFERRED", 40, 90);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(`${formatNumber(tx.amount)} NGNs`, 40, 102);

    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text("DATE", 40, 125);
    doc.setTextColor(255, 255, 255);
    doc.text(new Date(tx.date).toLocaleString(), 40, 135);

    doc.setTextColor(150, 150, 150);
    doc.text("BLOCKCHAIN STATUS", 40, 155);
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text("VERIFIED ON-CHAIN (BASE SEPOLIA)", 40, 165);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`REFERENCE: ${tx._id || 'SALVA-STABLE-TX'}`, 105, 270, { align: "center" });

    doc.save(`Salva_Receipt_${Date.now()}.pdf`);
    showMsg("Professional receipt downloaded!");
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (amountError) return showMsg("Insufficient balance", "error");
    if (!user.ownerKey) return showMsg("Private key missing. Please re-login.", "error");

    setLoading(true);
    showMsg("Initiating blockchain transfer...", "info");

    try {
      const response = await fetch(`${API_BASE_URL}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrivateKey: user.ownerKey,
          safeAddress: user.safeAddress,
          toInput: transferData.to,
          amount: transferData.amount
        })
      });

      const data = await response.json();
      if (response.ok) {
        showMsg('Transfer Successful!');
        setIsSendOpen(false);
        setTransferData({ to: '', amount: '' });
        setTimeout(() => {
          fetchBalance(user.safeAddress);
          fetchTransactions(user.safeAddress);
        }, 3000);
      } else {
        showMsg(data.message || "Transfer failed", "error");
      }
    } catch (err) {
      showMsg("Network error. Is backend running?", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0B] text-black dark:text-white pt-24 px-4 pb-12 relative overflow-x-hidden">
      {/* BRANDING SECTION AT TOP LEFT */}
      <div className="absolute top-8 left-8 flex items-center gap-2 z-50">
        <img src={salvaLogo} alt="S" className="w-12 h-12 object-contain" />
        <span className="text-xl font-black tracking-tighter">SALVA</span>
      </div>

      <Stars />

      <div className="max-w-4xl mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-salvaGold font-bold">Salva Citizen</p>
            <h2 className="text-3xl sm:text-4xl font-black truncate max-w-[200px] sm:max-w-none">{user.username}</h2>
          </div>
          <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-2xl w-full sm:w-auto">
            <p className="text-[10px] uppercase opacity-40 font-bold">Account Number</p>
            <p className="font-mono font-bold text-salvaGold text-sm sm:text-base">
              {showBalance ? user.accountNumber : '••••••••••'}
            </p>
          </div>
        </header>

        <div className="rounded-3xl bg-gray-100 dark:bg-black p-6 sm:p-10 mb-8 border border-white/5 shadow-2xl overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <p className="uppercase text-[10px] sm:text-xs opacity-40 font-bold tracking-widest">Available Balance</p>
            <button onClick={() => setShowBalance(!showBalance)} className="hover:scale-110 transition-transform p-2">
              {showBalance ? '👁' : '👁‍🗨'}
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 overflow-hidden">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter leading-none whitespace-nowrap">
              {showBalance ? formatNumber(balance) : '••••••.••'}
            </h1>
            <span className="text-salvaGold text-xl sm:text-2xl font-black mt-1 sm:mt-0">
              NGNs
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-10">
            <button onClick={() => setIsSendOpen(true)} className="bg-salvaGold hover:bg-yellow-600 transition-colors text-black font-black py-4 rounded-2xl shadow-lg shadow-salvaGold/20 text-sm sm:text-base">
              SEND
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.accountNumber);
                showMsg("Account number copied!");
              }}
              className="border border-salvaGold/30 hover:bg-white/5 transition-all py-4 rounded-2xl font-bold text-sm sm:text-base"
            >
              RECEIVE
            </button>
          </div>
        </div>

        <div 
          onClick={() => {
            navigator.clipboard.writeText(user.safeAddress);
            showMsg("Wallet address copied!");
          }}
          className="mb-8 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:border-salvaGold/30 transition-all"
        >
          <p className="text-[10px] uppercase opacity-40 font-bold mb-1 tracking-widest">Smart Wallet Address (Base)</p>
          <p className="font-mono text-[10px] sm:text-xs text-salvaGold font-medium break-all truncate">
            {showBalance ? user.safeAddress : '0x••••••••••••••••••••••••••••••••••••••••'}
          </p>
        </div>

        <section className="px-1">
          <div className="flex justify-between items-end mb-6">
            <h3 className="uppercase tracking-widest text-salvaGold text-[10px] sm:text-xs font-bold">Recent Activity</h3>
            <Link to="/transactions" className="text-[10px] uppercase tracking-tighter opacity-50 hover:opacity-100 transition-opacity font-bold underline">
              View History
            </Link>
          </div>
          
          <div className="space-y-3">
            {transactions.length > 0 ? (
              transactions.slice(0, 3).map((tx, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate('/transactions')}
                  className="flex justify-between items-center p-4 border border-white/5 bg-white/5 rounded-2xl hover:border-salvaGold/40 cursor-pointer transition-all gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm sm:text-base truncate">{tx.type === 'receive' ? 'Received' : 'Sent'}</p>
                    <p className="text-[10px] sm:text-xs opacity-40 font-medium">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-black text-sm sm:text-base ${tx.type === 'receive' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'receive' ? '+' : '-'}{formatNumber(tx.amount)}
                    </p>
                    <button 
                      onClick={(e) => downloadReceipt(e, tx)} 
                      className="relative z-20 text-[10px] text-salvaGold hover:underline font-bold uppercase tracking-tighter"
                    >
                      Receipt ↓
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-10 opacity-30 text-xs font-medium uppercase tracking-widest">Vault is empty</p>
            )}
          </div>
        </section>
      </div>
      
      <AnimatePresence>
        {isSendOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4">
            <motion.div
              onClick={() => !loading && setIsSendOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative bg-white dark:bg-zinc-900 p-6 sm:p-12 rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-lg border-t sm:border border-white/10 shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 sm:hidden" />
              <h3 className="text-2xl sm:text-3xl font-black mb-1">Send NGNs</h3>
              <p className="text-[10px] text-salvaGold uppercase tracking-widest font-bold mb-8">Salva Secure Transfer</p>

              <form onSubmit={handleTransfer} className="space-y-5">
                <div>
                  <label className="text-[10px] uppercase opacity-40 font-bold mb-2 block">Recipient</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter Account Number or Address"
                    value={transferData.to}
                    onChange={(e) => setTransferData({ ...transferData, to: e.target.value })}
                    className="w-full p-4 rounded-xl bg-gray-100 dark:bg-white/5 border border-transparent focus:border-salvaGold transition-all outline-none font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase opacity-40 font-bold mb-2 block">Amount (NGN)</label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={transferData.amount}
                      onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                      className={`w-full p-4 rounded-xl text-lg font-bold bg-gray-100 dark:bg-white/5 outline-none transition-all ${
                        amountError ? 'border border-red-500 text-red-500' : 'border border-transparent'
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-salvaGold font-black text-sm">NGN</span>
                  </div>
                  {amountError && <p className="text-[10px] text-red-400 mt-2 font-bold animate-pulse uppercase tracking-tight">⚠️ Balance too low.</p>}
                </div>

                <button
                  disabled={loading || amountError}
                  type="submit"
                  className={`w-full py-5 rounded-2xl font-black transition-all text-sm uppercase tracking-widest ${
                    loading || amountError ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-salvaGold text-black hover:brightness-110 active:scale-95'
                  }`}
                >
                  {loading ? 'PROCESSING…' : 'CONFIRM SEND'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notification.show && (
          <motion.div 
            initial={{ y: 100, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 100, x: "-50%", opacity: 0 }}
            className={`fixed bottom-6 left-1/2 px-6 py-4 rounded-2xl z-[100] font-black text-[10px] uppercase tracking-widest shadow-2xl w-[90%] sm:w-auto text-center ${
              notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-salvaGold text-black'
            }`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;