import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Directory from './pages/Directory/Directory';
import Profile from './pages/Profile/Profile';
import Chat from './pages/Chat/Chat';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat/:channelId" element={<Chat />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
