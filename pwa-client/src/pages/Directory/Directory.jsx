import React from 'react';
import { useNavigate } from 'react-router-dom';
import { School, MapPin, Users, ChevronRight, GraduationCap, Users2, Library, ChevronLeft } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import './Directory.css';

const Directory = () => {
  const navigate = useNavigate();
  const [colleges, setColleges] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchColleges();
  }, []);

  const fetchColleges = async () => {
    const { data } = await supabase.from('colleges').select('*').order('name');
    setColleges(data || []);
    setLoading(false);
  };

  return (
    <div className="directory-container scroll-fade">
      <header className="page-header">
        <button className="icon-btn back-btn" onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={24} />
        </button>
        <h3>Campus Explorer</h3>
      </header>

      <div className="directory-header fade-in">
        <h2>Campus Directory</h2>
        <p>Explore the elite communities and find your tribe.</p>
      </div>

      <div className="college-grid">
        {loading ? (
          <div className="loader-container"><div className="loader spin"></div></div>
        ) : colleges.map(college => (
          <div key={college.id} className="college-card glass fade-in">
            <div className="college-info">
              <div className="college-icon glass">{college.icon || '🏛️'}</div>
              <div className="college-details">
                <h3>{college.name}</h3>
                <div className="college-meta">
                  <span><MapPin size={14} /> Active Campus</span>
                  <span><Users size={14} /> Verified</span>
                </div>
              </div>
            </div>
            <button className="icon-btn glass"><ChevronRight size={20} /></button>
          </div>
        ))}
      </div>

      <div className="directory-footer glass fade-in">
        <h3>Don't see your college?</h3>
        <button className="btn btn-outline">Request Verification</button>
      </div>
    </div>
  );
};

export default Directory;
