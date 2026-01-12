// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';

// Spinner Component for smooth transitions
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-black">
    <div className="w-12 h-12 border-4 border-t-blue-600 border-blue-900 rounded-full animate-spin"></div>
  </div>
);

const ProtectedRoute = ({ children, isLoading }) => {
  const isAuthenticated = !!localStorage.getItem('salva_user');
  
  if (isLoading) return <LoadingSpinner />;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate a brief backend session check (e.g., validating a token)
    const checkSession = async () => {
      try {
        // You can add your actual API call to /verify-session here
        await new Promise(resolve => setTimeout(resolve, 800)); 
      } finally {
        setIsLoading(false);
      }
    };
    checkSession();
  }, []);

  if (isLoading) return <LoadingSpinner />;

  return (
    <Router>
      <div className="min-h-screen bg-black transition-opacity duration-500">
        <Navbar />
        <main className="animate-in fade-in duration-700">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute isLoading={isLoading}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/transactions" 
              element={
                <ProtectedRoute isLoading={isLoading}>
                  <Transactions />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;