import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Shield, Users } from 'lucide-react';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="hero-section fade-in">
        <div className="glow-circle primary"></div>
        <div className="glow-circle secondary"></div>
        
        <nav className="glass landing-nav">
          <div className="logo">Unfiltered<span>Campus</span></div>
          <button className="btn btn-outline" onClick={() => navigate('/login')}>Login</button>
        </nav>

        <section className="hero-content">
          <h1>Experience Campus <br/><span className="gradient-text">Unfiltered.</span></h1>
          <p>Join the most exclusive student community. No filters, no noise, just real connections.</p>
          
          <div className="hero-btns">
            <button className="btn btn-primary lg" onClick={() => navigate('/login')}>
              Get Started <ArrowRight size={20} />
            </button>
            <button className="btn btn-outline lg">Explore Now</button>
          </div>
        </section>

        <section className="features-grid">
          <div className="feature-card glass">
            <Zap className="feature-icon" color="var(--primary)" />
            <h3>Real-time Feed</h3>
            <p>Catch every update from your college instantly.</p>
          </div>
          <div className="feature-card glass">
            <Users className="feature-icon" color="var(--secondary)" />
            <h3>Private Groups</h3>
            <p>Exclusive circles for your classes and interests.</p>
          </div>
          <div className="feature-card glass">
            <Shield className="feature-icon" color="#10b981" />
            <h3>Secure & Private</h3>
            <p>Your data stays within your campus walls.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Landing;
