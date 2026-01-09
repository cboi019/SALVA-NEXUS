import React, { useState, useEffect } from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import Stars from '../components/Stars';

// --- CountUp Component with Glow Pulse ---
const CountUp = ({ to, decimals = 0 }) => {
  const [currentValue, setCurrentValue] = useState(0);
  const [isCounting, setIsCounting] = useState(true);

  useEffect(() => {
    const targetValue = typeof to === 'string' 
      ? parseFloat(to.replace(/,/g, '')) 
      : to;

    if (isNaN(targetValue)) return;

    setIsCounting(true);
    const controls = animate(0, targetValue, {
      duration: 2.5, 
      ease: [0.16, 1, 0.3, 1], // Custom "out-expo" ease for a premium feel
      onUpdate: (value) => setCurrentValue(value),
      onComplete: () => setIsCounting(false)
    });

    return () => controls.stop();
  }, [to]);

  return (
    <motion.span
      animate={isCounting ? { 
        textShadow: [
          "0 0 0px rgba(212, 175, 55, 0)", 
          "0 0 20px rgba(212, 175, 55, 0.5)", 
          "0 0 0px rgba(212, 175, 55, 0)"
        ] 
      } : { textShadow: "0 0 0px rgba(212, 175, 55, 0)" }}
      transition={{ repeat: Infinity, duration: 2 }}
    >
      {currentValue.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </motion.span>
  );
};

const Home = () => {
  const [stats, setStats] = useState({ totalMinted: 0, userCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/stats`, {
          signal: AbortSignal.timeout(10000) 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        setStats({ 
          totalMinted: parseFloat(data.totalMinted || 0),
          userCount: parseInt(data.userCount || 0)
        });
        
        setLoading(false);
      } catch (err) {
        console.log("⚠️ Stats fetch failed:", err.message);
        setLoading(false);
      }
    };
    
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const fadeIn = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.8 }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0B] text-black dark:text-white transition-colors duration-500 overflow-x-hidden">
      <Stars />

      {/* Hero Section */}
      <section className="relative pt-32 sm:pt-48 pb-12 sm:pb-20 px-4 sm:px-6 text-center">
        <motion.div {...fadeIn}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black mb-4 sm:mb-6 tracking-tighter leading-[0.9] break-words px-2">
            ON-CHAIN PAYMENT <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-salvaGold to-yellow-600 block sm:inline">
              INFRASTRUCTURE.
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl opacity-60 max-w-2xl mx-auto leading-relaxed px-4">
            Salva is the premier on-chain financial protocol designed for everyday Nigerian payments. 
            Instant settlement. Zero friction. Built on Base.
          </p>
        </motion.div>
      </section>

      {/* Stats Section */}
      <motion.section {...fadeIn} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
          <StatCard 
            title="Total NGNs Circulating" 
            value={loading ? "0" : <CountUp to={stats.totalMinted} decimals={2} />} 
            suffix=" NGNs" 
          />
          <StatCard 
            title="Salva Network Citizens" 
            value={loading ? "0" : <CountUp to={stats.userCount} />} 
          />
        </div>
      </motion.section>

      {/* Creative Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-32 space-y-16 sm:space-y-32">
        <FeatureRow 
          title="Naira-Referenced Stability"
          desc="Unlike volatile assets, Salva NGNs are pegged 1:1, allowing you to store value and trade with the confidence of the local currency, enhanced by the speed of blockchain."
          align="left"
        />
        <FeatureRow 
          title="The Salva Smart Wallet"
          desc="More than just storage. Our wallet automates your transactions, eliminates gas fees, and connects you directly to the global DeFi ecosystem without leaving the Naira."
          align="right"
        />
      </section>
    </div>
  );
};

// Updated StatCard with an inner glow container
const StatCard = ({ title, value, suffix = "" }) => (
  <div className="group relative p-8 md:p-12 rounded-3xl md:rounded-[3rem] border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 backdrop-blur-sm hover:border-salvaGold/50 transition-all duration-500 w-full flex flex-col justify-center overflow-hidden">
    {/* Inner decorative glow */}
    <div className="absolute -inset-1 bg-gradient-to-r from-salvaGold/0 via-salvaGold/5 to-salvaGold/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    
    <p className="relative z-10 text-[10px] sm:text-xs uppercase tracking-[0.3em] sm:tracking-[0.4em] text-salvaGold mb-4 md:mb-6 font-bold">
      {title}
    </p>
    <div className="relative z-10 flex flex-nowrap items-baseline overflow-visible">
      <p className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tighter whitespace-nowrap">
        {value}
      </p>
      {suffix && (
        <span className="text-sm sm:text-lg md:text-xl font-bold opacity-40 whitespace-nowrap ml-2">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const FeatureRow = ({ title, desc, align }) => (
  <motion.div 
    initial={{ opacity: 0, x: align === 'left' ? -50 : 50 }}
    whileInView={{ opacity: 1, x: 0 }}
    transition={{ duration: 1 }}
    viewport={{ once: true }}
    className={`flex flex-col ${align === 'left' ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 sm:gap-12 items-center`}
  >
    <div className="flex-1 space-y-4 sm:space-y-6 px-4 sm:px-0">
      <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{title}</h3>
      <p className="text-base sm:text-lg opacity-60 leading-relaxed">{desc}</p>
    </div>
    <div className="flex-1 w-full h-48 sm:h-64 bg-gradient-to-br from-salvaGold/20 to-transparent rounded-2xl sm:rounded-[3rem] border border-salvaGold/10" />
  </motion.div>
);

export default Home;