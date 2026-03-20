import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Compass, Bell, User, Search, PlusCircle, MoreHorizontal, Heart, MessageCircle, Share2, Library, GraduationCap, School, MapPin, Shield, Zap, Info } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import axios from 'axios';
import './Dashboard.css';

const BACKEND_URL = 'http://localhost:5000';
const SELECTED_GROUP_KEY = '@campus_selected_group';

const Dashboard = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const username = user?.username || 'Guest';
  const initial = username[0].toUpperCase();

  const [colleges, setColleges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userGroup, setUserGroup] = useState(null);
  const [privateGroups, setPrivateGroups] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    fetchHierarchy();
    const channelSub = supabase
      .channel('public:channels:hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => fetchHierarchy())
      .subscribe();
    return () => supabase.removeChannel(channelSub);
  }, []);

  const fetchHierarchy = async () => {
    try {
      const stored = localStorage.getItem(SELECTED_GROUP_KEY);
      const activeGroup = stored ? JSON.parse(stored) : null;
      if (activeGroup) setUserGroup(activeGroup);

      const [collRes, catRes, chanRes, profRes] = await Promise.all([
        supabase.from('colleges').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('channels').select('*').eq('status', 'active'),
        user?.id ? axios.get(`${BACKEND_URL}/api/profiles/user/${user.id}`, { timeout: 8000 }).catch(() => ({ data: null })) : { data: null }
      ]);

      const myMaskId = profRes.data?.mask_id || '';
      if (myMaskId) {
        const [privRes, invRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/groups/private?maskId=${myMaskId}`).catch(() => ({ data: [] })),
          axios.get(`${BACKEND_URL}/api/groups/invites?maskId=${myMaskId}`).catch(() => ({ data: [] }))
        ]);
        setPrivateGroups(privRes.data || []);
        setPendingInvites(invRes.data || []);
      }

      setColleges(collRes.data || []);
      setCategories(catRes.data || []);
      
      // Handle potential missing columns or query errors gracefully
      if (chanRes.error) {
        console.warn('[HOME] Channels fetch error (column missing?):', chanRes.error);
        // Retry without is_private if that was the issue (though we removed it from query anyway)
        setChannels([]);
      } else {
        setChannels(chanRes.data || []);
      }
    } catch (e) {
      console.error('[HOME] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChat = (group) => {
    localStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(group));
    setUserGroup(group);
    navigate(`/chat/${group.channel.id}`);
  };

  const collegeId = userGroup?.collegeId;
  const collegeLounge = collegeId 
    ? channels.find(ch => ch.college_id === collegeId && !ch.category_id && !ch.is_private)
    : null;

  const globalChannels = channels.filter(ch => ch.is_global && !ch.is_private);
  const myPrivateGroups = privateGroups;

  return (
    <div className="dashboard-container">
      <header className="dash-header glass">
        <div className="search-bar glass">
          <Search size={18} />
          <input type="text" placeholder="Search campus..." />
        </div>
        <div className="user-actions">
          <button className="icon-btn glass"><Bell size={20} /></button>
          <div className="avatar glass" title={username} onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            {initial}
          </div>
        </div>
      </header>

      <main className="dash-main">
        <aside className="dash-sidebar glass">
          <nav>
            <button className="nav-item active"><Home size={22} /> Feed</button>
            <button className="nav-item" onClick={() => navigate('/directory')}><Compass size={22} /> Explore</button>
            <button className="nav-item"><PlusCircle size={22} /> Create</button>
            <button className="nav-item" onClick={() => navigate('/profile')}><User size={22} /> Profile</button>
          </nav>
        </aside>

        <section className="feed-section">
          {/* Personalized Hub */}
          {userGroup?.channel && (
            <div className="hub-section glass fade-in">
              <div className="section-header">
                <h3><Zap size={18} color="var(--primary)" /> My Primary Hub</h3>
                <span className="badge">ACTIVE</span>
              </div>
              <div className="hub-card" onClick={() => handleJoinChat(userGroup)}>
                <div className="hub-icon">{userGroup.channel.icon || '🎓'}</div>
                <div className="hub-info">
                  <h4>{userGroup.channel.name}</h4>
                  <p>Tap to enter class conversation</p>
                </div>
                <button className="btn btn-primary sm">CHAT</button>
              </div>
            </div>
          )}

          {/* College Hub */}
          {collegeLounge && (
            <div className="hub-section college-hub glass fade-in">
              <div className="section-header">
                <h3><School size={18} color="#10b981" /> College Lounge</h3>
                <span className="badge hub">JOINED</span>
              </div>
              <div className="hub-card" onClick={() => handleJoinChat({ collegeId, categoryId: null, channel: collegeLounge })}>
                <div className="hub-icon lounge">🏛️</div>
                <div className="hub-info">
                  <h4>{collegeLounge.name}</h4>
                  <p>Official campus community lounge</p>
                </div>
                <button className="btn btn-primary sm">JOIN</button>
              </div>
            </div>
          )}
          {pendingInvites.length > 0 && (
            <div className="invites-section glass fade-in">
              <h3>📬 New Invitations</h3>
              <div className="invite-list">
                {pendingInvites.map(invite => (
                  <div key={invite.id} className="invite-card glass">
                    <span>{invite.channels?.icon} {invite.channels?.name}</span>
                    <div className="invite-actions">
                      <button className="btn btn-primary sm">Accept</button>
                      <button className="btn btn-outline sm">Ignore</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Private Groups */}
          <div className="groups-section glass fade-in">
            <div className="section-header">
              <h3><Shield size={18} color="#10b981" /> Private Groups</h3>
              <PlusCircle size={20} className="add-btn" onClick={() => setIsCreatingGroup(true)} />
            </div>
            <div className="groups-grid">
              {privateGroups.map(g => (
                <div key={g.id} className="group-card glass" onClick={() => handleJoinChat({ collegeId: null, categoryId: null, channel: g })}>
                  <div className="group-emoji">{g.icon || '🔒'}</div>
                  <span className="group-name">{g.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Global Lounge */}
          {globalChannels.length > 0 && (
            <div className="global-section glass fade-in">
              <div className="section-header">
                <h3>🌐 Global Lounge</h3>
                <span className="section-sub">Open to all students</span>
              </div>
              <div className="global-grid">
                {globalChannels.map(ch => (
                  <div key={ch.id} className="global-card glass" onClick={() => handleJoinChat({ collegeId: null, categoryId: null, channel: ch })}>
                    <div className="global-emoji">{ch.icon || '💬'}</div>
                    <span className="global-name">{ch.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback Discover */}
          {!collegeLounge && globalChannels.length === 0 && !loading && (
            <div className="discover-fallback glass fade-in">
              <Library size={48} />
              <h4>Explorer Mode</h4>
              <p>You haven't joined a college hub yet. Explore the directory to find your campus.</p>
              <button className="btn btn-primary" onClick={() => navigate('/directory')}>
                Browse Directory
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="loader-container">
              <div className="loader spin"></div>
              <p>Fetching your campus...</p>
            </div>
          )}
        </section>

        <aside className="dash-right glass">
          <h3>Campus Intel</h3>
          <div className="intel-item">
            <Info size={16} />
            <p>10 new messages in <strong>Engineering Lounge</strong></p>
          </div>
          <div className="intel-item">
            <Info size={16} />
            <p><strong>Stanford</strong> verification complete.</p>
          </div>
        </aside>
      </main>

      <nav className="mobile-nav glass">
        <Home size={24} className="active" onClick={() => navigate('/dashboard')} />
        <Compass size={24} onClick={() => navigate('/directory')} />
        <PlusCircle size={32} className="fab" />
        <Bell size={24} />
        <User size={24} onClick={() => navigate('/profile')} />
      </nav>
    </div>
  );
};

export default Dashboard;
