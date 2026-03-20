import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn, ChevronLeft, Loader2, UserPlus } from 'lucide-react';
import axios from 'axios';
import './Auth.css';

const BACKEND_URL = 'http://localhost:5000';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await axios.post(`${BACKEND_URL}${endpoint}`, {
        username: username.trim(),
        password: password.trim(),
      });

      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('maskId', response.data.maskId);
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <button className="back-btn glass" onClick={() => navigate('/')}>
        <ChevronLeft size={24} />
      </button>

      <div className="auth-card glass fade-in">
        <div className="auth-header">
          <h2>{isLogin ? 'Welcome Back' : 'Join Unfiltered'}</h2>
          <p>{isLogin ? 'Login to your campus account' : 'Create an anonymous account'}</p>
        </div>

        {error && <div className="auth-error glass">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group glass">
            <User size={20} className="input-icon" />
            <input 
              type="text" 
              placeholder="Username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>

          <div className="input-group glass">
            <Lock size={20} className="input-icon" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="spin" size={20} /> : (isLogin ? 'Login' : 'Create Account')}
            {!loading && (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />)}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <span className="link" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? ' Join Now' : ' Login'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
