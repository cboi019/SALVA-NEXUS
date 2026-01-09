// Transactions.jsx - COMPLETE WITH LIGHT MODE & FIXES
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { jsPDF } from "jspdf";
import Stars from '../components/Stars';

const Transactions = () => {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [groupedTxs, setGroupedTxs] = useState({});
  const [expandedDays, setExpandedDays] = useState({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    const savedUser = localStorage.getItem('salva_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        fetchTransactions(parsedUser.safeAddress);
      } catch (error) {
        console.error("Error parsing user data:", error);
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
    const grouped = {};
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const dayKey = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      grouped[dayKey].push(tx);
    });
    setGroupedTxs(grouped);
    
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    setExpandedDays({ [today]: true });
  }, [transactions]);

  const showMsg = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

  const fetchTransactions = async (address) => {
    try {
      const res = await fetch(`http://localhost:3001/api/transactions/${address}`);
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) { 
      console.error("Transaction history failed:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayKey) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayKey]: !prev[dayKey]
    }));
  };

  const formatNumber = (num) => {
    return parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const downloadReceipt = (tx) => {
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
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text("OFFICIAL TRANSACTION RECEIPT", 105, 55, { align: "center" });
    doc.setDrawColor(255, 255, 255, 0.1);
    doc.line(30, 65, 180, 65);
    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text("AMOUNT", 40, 90);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(`${formatNumber(tx.amount)} NGNs`, 40, 102);
    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text("RECIPIENT ACCOUNT", 40, 125);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(tx.toAccountNumber, 40, 135);
    doc.setTextColor(150, 150, 150);
    doc.text("DATE & TIME", 40, 155);
    doc.setTextColor(255, 255, 255);
    doc.text(new Date(tx.date).toLocaleString(), 40, 165);
    doc.setTextColor(150, 150, 150);
    doc.text("STATUS", 40, 185);
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text(tx.status.toUpperCase(), 40, 195);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Reference ID: ${tx._id || 'SALVA-REF-V' + Date.now()}`, 105, 260, { align: "center" });
    doc.text("This is a digitally generated receipt and requires no signature.", 105, 268, { align: "center" });
    doc.save(`Salva_Receipt_${tx.toAccountNumber}.pdf`);
    showMsg("Receipt downloaded successfully!");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0B] text-black dark:text-white pt-32 px-6 relative overflow-hidden font-sans transition-colors duration-500">
      <Stars />
      
      {notification.show && (
        <motion.div 
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className={`fixed top-10 right-10 z-[100] p-5 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[300px] ${
            notification.type === 'error' ? 'bg-red-500/20 border-red-500/50 dark:bg-red-500/20 dark:border-red-500/50' : 'bg-gray-100 border-gray-300 dark:bg-zinc-900/80 dark:border-salvaGold/50'
          }`}
        >
          <p className="text-xs uppercase tracking-widest text-salvaGold font-black mb-1">Salva System</p>
          <p className="text-sm font-bold">{notification.message}</p>
        </motion.div>
      )}

      <div className="max-w-4xl mx-auto relative z-10">
        <Link 
          to="/dashboard" 
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-salvaGold hover:opacity-60 transition-opacity mb-8 font-bold"
        >
          ← Back to Dashboard
        </Link>

        <header className="mb-12">
          <h1 className="text-sm uppercase tracking-[0.4em] text-salvaGold font-bold mb-2">Transaction History</h1>
          <h2 className="text-4xl font-black tracking-tighter">{user.username}</h2>
        </header>

        <section>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-12 h-12 border-4 border-salvaGold/30 border-t-salvaGold rounded-full animate-spin"></div>
              <p className="mt-4 text-sm opacity-50">Loading transactions...</p>
            </div>
          ) : Object.keys(groupedTxs).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(groupedTxs).map(([dayKey, dayTxs]) => (
                <div key={dayKey} className="border border-gray-300 dark:border-white/10 rounded-3xl overflow-hidden bg-gray-100 dark:bg-white/5 backdrop-blur-sm">
                  <button
                    onClick={() => toggleDay(dayKey)}
                    className="w-full p-6 flex justify-between items-center hover:bg-gray-200 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="text-left">
                      <h3 className="text-lg font-black text-salvaGold">{dayKey}</h3>
                      <p className="text-xs opacity-50 mt-1">
                        {dayTxs.length} transaction{dayTxs.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold opacity-50">
                        Total: {formatNumber(dayTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0))} NGNs
                      </span>
                      <svg 
                        className={`w-6 h-6 transition-transform ${expandedDays[dayKey] ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {expandedDays[dayKey] && (
                    <div className="border-t border-gray-300 dark:border-white/10 p-4 space-y-3">
                      {dayTxs.map((tx, txIndex) => {
                        const isSuccessful = tx.status?.toLowerCase() === 'success' || tx.status?.toLowerCase() === 'successful';
                        return (
                          <motion.div 
                            key={tx._id || txIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: txIndex * 0.05 }}
                            className="p-5 rounded-2xl bg-white dark:bg-black/30 border border-gray-300 dark:border-white/5 hover:border-salvaGold/30 transition-all group"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                                  isSuccessful ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {isSuccessful ? '✓' : '✗'}
                                </div>
                                <div>
                                  <p className="text-base font-bold">Sent to {tx.toAccountNumber}</p>
                                  <p className="text-xs opacity-40 uppercase tracking-wider font-bold mt-1">
                                    {new Date(tx.date).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className={`text-2xl font-black ${isSuccessful ? 'text-black dark:text-white' : 'text-gray-500'}`}>
                                    -{formatNumber(tx.amount)} NGNs
                                  </p>
                                  <p className={`text-xs uppercase tracking-widest font-bold mt-1 ${isSuccessful ? 'text-green-400' : 'text-red-400'}`}>
                                    {tx.status}
                                  </p>
                                </div>
                                
                                {isSuccessful && (
                                  <button 
                                    onClick={() => downloadReceipt(tx)}
                                    className="px-4 py-2 bg-salvaGold/10 text-salvaGold border border-salvaGold/50 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-salvaGold hover:text-black transition-all"
                                  >
                                    Receipt
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5">
                              <p className="text-[10px] uppercase tracking-widest opacity-30 font-bold">Transaction ID</p>
                              <p className="text-xs font-mono opacity-50 mt-1 break-all">{tx._id || 'Verified'}</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                <span className="text-4xl">📭</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">No Transactions Yet</h3>
              <p className="text-sm opacity-50 mb-8">Your transaction history will appear here</p>
              <Link 
                to="/dashboard"
                className="inline-block px-6 py-3 bg-salvaGold text-black font-black rounded-2xl hover:brightness-110 transition-all"
              >
                Back to Dashboard
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Transactions;