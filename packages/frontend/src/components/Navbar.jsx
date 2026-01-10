// Navbar.jsx 
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import salvaLogo from '../assets/salva-logo.png';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('salva_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user.username && user.safeAddress && user.accountNumber) {
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('salva_user');
          setIsLoggedIn(false);
        }
      } catch (error) {
        localStorage.removeItem('salva_user');
        setIsLoggedIn(false);
      }
    } else {
      setIsLoggedIn(false);
    }
  }, [location]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleLogout = () => {
    localStorage.removeItem('salva_user');
    setIsLoggedIn(false);
    navigate('/');
  };

  return (
    <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md border-b border-gray-200/10 dark:border-white/5">
      {/* BRANDING SECTION */}
      <Link to="/" className="flex items-center group">
        <div className="relative flex items-center">
          {/* THE BIG S */}
          <img 
            src={salvaLogo} 
            alt="S" 
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain transition-transform group-hover:scale-110" 
          />
          {/* THE SALVA TEXT - Pushed close to the S */}
          <span className="text-xl sm:text-2xl font-black tracking-tighter text-black dark:text-white ml-[-4px]">
            SALVA<span className="text-salvaGold">.</span>
          </span>
        </div>
      </Link>
      
      <div className="flex items-center gap-6 sm:gap-8">
        {!isLoggedIn ? (
          <Link 
            to="/login" 
            className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-black dark:text-white opacity-60 hover:opacity-100 transition-opacity"
          >
            Login
          </Link>
        ) : (
          <button 
            onClick={handleLogout}
            className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-red-500 opacity-80 hover:opacity-100 transition-opacity"
          >
            Logout
          </button>
        )}

        <div className="flex items-center gap-4 pl-4 sm:pl-6 border-l border-gray-200 dark:border-white/10">
          <span className="text-[10px] uppercase tracking-widest opacity-40 font-black hidden md:block text-black dark:text-white">
            {darkMode ? 'Dark' : 'Light'}
          </span>
          
          <button 
            onClick={() => setDarkMode(!darkMode)}
            aria-label="Toggle Dark Mode"
            className="relative w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-all duration-300 shadow-md dark:shadow-salvaGold/20"
            style={{
              background: darkMode 
                ? 'linear-gradient(135deg, #1a1a1b 0%, #2d2d30 100%)'
                : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
            }}
          >
            <motion.div 
              animate={{ x: darkMode ? 24 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="absolute top-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                background: darkMode
                  ? 'radial-gradient(circle, #d4af37 0%, #c9a22e 100%)'
                  : '#ffffff',
                boxShadow: darkMode 
                  ? '0 0 10px rgba(212, 175, 55, 0.6)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              {darkMode ? (
                <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </motion.div>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;