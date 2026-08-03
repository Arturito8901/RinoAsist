import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { RefreshCw } from 'lucide-react';
import AdminDashboard from '../components/dashboards/AdminDashboard';
import TeacherDashboard from '../components/dashboards/TeacherDashboard';
import StudentDashboard from '../components/dashboards/StudentDashboard';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load User on mount
  useEffect(() => {
    const currentUser = api.getCurrentUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Check if there is a pending scan token and the user is a student
    if (currentUser.rol === 'alumno' && localStorage.getItem('pending_scan_token')) {
      navigate('/scan');
      return;
    }

    setUser(currentUser);
    
    // Fetch active period from database asynchronously to cache in localStorage
    api.getActivePeriod().catch(err => {
      console.warn("Could not load active school cycle from server, using local fallback:", err);
    });

    setLoading(false);
  }, [navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-bg-base text-txt-base flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-10 h-10 text-brand-primary animate-spin" />
        <span className="font-semibold text-txt-muted">Cargando panel de control...</span>
      </div>
    );
  }

  // Render dashboard based on role
  if (user.rol === 'admin') {
    return <AdminDashboard user={user} />;
  } else if (user.rol === 'docente') {
    return <TeacherDashboard user={user} />;
  } else if (user.rol === 'alumno') {
    return <StudentDashboard user={user} />;
  } else {
    return (
      <div className="min-h-screen bg-bg-base text-txt-base flex items-center justify-center flex-col gap-4">
        <span className="font-semibold text-rose-500">Rol no reconocido: {user.rol}</span>
      </div>
    );
  }
}
