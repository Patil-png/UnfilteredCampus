import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Camera, Shield, Bell, HelpCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const username = user?.username || 'Guest';
  const initial = username[0].toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('maskId');
    localStorage.removeItem('@campus_selected_group');
    navigate('/login');
  };

  return (
    <div className="profile-container fade-in">
      <header className="page-header">
        <button className="icon-btn back-btn" onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={24} />
        </button>
        <h3>Account Settings</h3>
      </header>

      <div className="profile-hero glass">
        <div className="profile-id">
          <div className="avatar x-large glass">{initial}</div>
          <button className="edit-avatar glass"><Camera size={18} /></button>
        </div>
        <h2>{username}</h2>
        <p>Verified Campus Member</p>
        <div className="profile-stats">
          <div className="stat"><span>-</span><small>Posts</small></div>
          <div className="stat"><span>-</span><small>Karma</small></div>
        </div>
      </div>

      <div className="profile-menu">
        <div className="menu-group glass">
          <div className="menu-item">
            <div className="item-label"><Shield size={20} /> Account Security</div>
            <ChevronRight size={20} />
          </div>
          <div className="menu-item">
            <div className="item-label"><Bell size={20} /> Notifications</div>
            <ChevronRight size={20} />
          </div>
          <div className="menu-item">
            <div className="item-label"><Settings size={20} /> Preferences</div>
            <ChevronRight size={20} />
          </div>
        </div>

        <div className="menu-group glass">
          <div className="menu-item">
            <div className="item-label"><HelpCircle size={20} /> Support & FAQ</div>
            <ChevronRight size={20} />
          </div>
          <div className="menu-item logout" onClick={handleLogout} style={{ cursor: 'pointer' }}>
            <div className="item-label"><LogOut size={20} /> Logout Account</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
