// ===== 2. App.js - Updated with PageTransition wrapper =====
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';

// Page transition wrapper component
const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
};

// Component to detect dark mode and apply to HTML
const DarkModeHandler = () => {
  useEffect(() => {
    const applyDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('light-mode');
      } else {
        document.documentElement.classList.add('light-mode');
      }
    };

    // Apply immediately
    applyDarkMode();

    // Watch for changes
    const observer = new MutationObserver(applyDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return null;
};

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('salva_user');
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Animated Routes component
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <PageTransition><Dashboard /></PageTransition>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/transactions" 
          element={
            <ProtectedRoute>
              <PageTransition><Transactions /></PageTransition>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <Router>
      <DarkModeHandler />
      <Navbar />
      <AnimatedRoutes />
    </Router>
  );
}

export default App;