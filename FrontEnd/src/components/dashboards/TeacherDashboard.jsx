import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getSchoolCycle } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import TeacherDashboardView from '../TeacherDashboardView';
import rhinoMascot from '../../assets/rhino_mascot.png';
import rinoasistBanner from '../../assets/rinoasist_banner.png';
import rinoasistBannerDark from '../../assets/rinoasist_banner_dark.png';
import rinoasistCollapsedLight from '../../assets/rinoasist_collapsed_light.png';
import roleDocente from '../../assets/role_docente.png';
import { 
  LogOut, Calendar, Layers, CheckCircle, Clock, QrCode, 
  TrendingUp, ShieldAlert, RefreshCw, ChevronDown
} from 'lucide-react';

export default function TeacherDashboard({ user }) {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
  
  // Layout states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Tabs and QR code states
  const [activeTab, setActiveTab] = useState('resumen');
  const [teacherGroups, setTeacherGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeTimer, setQrCodeTimer] = useState(30);
  const [qrToken, setQrToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groups = await api.getTeacherGroups();
        setTeacherGroups(groups);
        if (groups.length > 0) {
          setSelectedGroupId(groups[0].id);
        }
      } catch (err) {
        console.error("Error fetching teacher groups:", err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchGroups();
    }
  }, [user]);

  // QR Code Timer effect
  useEffect(() => {
    let interval;
    if (showQRModal && selectedGroupId) {
      interval = setInterval(() => {
        setQrCodeTimer((prev) => {
          if (prev <= 1) {
            loadQrToken(selectedGroupId);
            return 30; // Reset
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showQRModal, selectedGroupId]);

  async function loadQrToken(groupId) {
    try {
      const data = await api.generateQrToken(groupId);
      setQrToken(data.token);
    } catch (err) {
      console.error("Error generating QR:", err);
      setQrToken(`mock-qr-token-for-${groupId}-${Date.now()}`);
    }
  }

  const isCurrentTimeInSchedule = (scheduleStr) => {
    if (!scheduleStr) return true;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, ... 6 = Sábado
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const scheduleLower = scheduleStr.toLowerCase();
    const days = [];
    if (scheduleLower.includes("lu") || scheduleLower.includes("lunes")) days.push(1);
    if (scheduleLower.includes("ma") || scheduleLower.includes("martes")) days.push(2);
    if (scheduleLower.includes("mi") || scheduleLower.includes("miercoles") || scheduleLower.includes("miércoles")) days.push(3);
    if (scheduleLower.includes("ju") || scheduleLower.includes("jueves")) days.push(4);
    if (scheduleLower.includes("vi") || scheduleLower.includes("viernes")) days.push(5);
    if (scheduleLower.includes("sa") || scheduleLower.includes("sabado") || scheduleLower.includes("sábado")) days.push(6);
    if (scheduleLower.includes("do") || scheduleLower.includes("domingo")) days.push(0);

    if (days.length === 0) return true;
    if (!days.includes(currentDay)) return false;

    const timeRegex = /(\d{2}):(\d{2})/g;
    const matches = [];
    let match;
    while ((match = timeRegex.exec(scheduleLower)) !== null) {
      matches.push(parseInt(match[1]) * 60 + parseInt(match[2]));
    }

    if (matches.length === 0) return true;

    let startMinutes = matches[0];
    let endMinutes = matches[1];

    if (matches.length === 1) {
      endMinutes = startMinutes + 120; // Default 2 hours
    }

    return currentTimeInMinutes >= startMinutes && currentTimeInMinutes <= endMinutes;
  };

  const handleOpenQRModal = async (groupId = selectedGroupId) => {
    if (!groupId) return;

    // Validate schedule check before opening modal
    const selectedGroup = teacherGroups.find(g => g.id.toString() === groupId.toString());
    const scheduleStr = selectedGroup?.schedule;
    if (!isCurrentTimeInSchedule(scheduleStr)) {
      alert(`No está permitido iniciar el pase de lista QR fuera del horario programado para esta clase (${scheduleStr || 'Sin horario programado'}).`);
      return;
    }

    setSelectedGroupId(groupId);
    setShowQRModal(true);
    setQrCodeTimer(30);
    setQrToken(''); // Clear previous
    await loadQrToken(groupId);
  };

  const getAvailableCycles = (currentClave) => {
    const baseClave = "2026-1";
    const cycles = [baseClave];
    let tempClave = baseClave;
    
    let safetyCounter = 0;
    let targetFutureCycles = 2;
    let foundCurrent = (tempClave === currentClave);
    let futureCount = 0;

    while (safetyCounter < 50) {
      if (foundCurrent) {
        futureCount++;
        if (futureCount > targetFutureCycles) {
          break;
        }
      }

      const isInter = tempClave.toUpperCase().includes("INTER");
      const yearMatch = tempClave.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      
      if (isInter) {
        if (tempClave.endsWith("-1") || tempClave.endsWith(" 1")) {
          tempClave = `${year}-2`;
        } else {
          tempClave = `${year + 1}-1`;
        }
      } else {
        if (tempClave.endsWith("-1") || tempClave.endsWith(" 1")) {
          tempClave = `Inter ${year}-1`;
        } else {
          tempClave = `Inter ${year}-2`;
        }
      }

      if (!cycles.includes(tempClave)) {
        cycles.push(tempClave);
      }

      if (tempClave === currentClave) {
        foundCurrent = true;
      }
      
      safetyCounter++;
    }

    if (!cycles.includes(currentClave) && currentClave) {
      cycles.unshift(currentClave);
    }

    return cycles;
  };

  const schoolCyclesList = getAvailableCycles(getSchoolCycle());

  const handleCycleChange = async (cycleClave) => {
    try {
      setLoading(true);
      await api.setActivePeriodoByClave(cycleClave);
      window.location.reload();
    } catch (err) {
      alert(err.message || 'Error al cambiar de ciclo escolar');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    navigate('/');
  };

  const handleLogoClick = () => {
    if (window.innerWidth < 768) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  const getMascotMessage = () => {
    return `¡Hola, Docente! Rino te recuerda registrar a tiempo la asistencia de tus grupos y utilizar el código QR para un pase ágil. 🦏📝`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base text-txt-base flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-10 h-10 text-brand-primary animate-spin" />
        <span className="font-semibold text-txt-muted">Cargando panel de control...</span>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-bg-base text-txt-base flex flex-col md:flex-row theme-transition">
      
      {/* Mobile Header Bar */}
      <div className="md:hidden w-full bg-bg-surface border-b border-bdr-base p-4 flex justify-between items-center z-30 shrink-0 theme-transition">
        <div onClick={handleLogoClick} className="flex items-center cursor-pointer select-none h-8">
          <img 
            src={isDark ? rinoasistBannerDark : rinoasistBanner} 
            alt="RinoAsist Logo" 
            className="h-8 w-auto object-contain"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="p-2 border border-bdr-base bg-bg-card rounded-xl text-txt-muted hover:text-brand-primary cursor-pointer active:scale-95 transition-all"
          >
            <Layers className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop overlay */}
      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden transition-all duration-300" />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 md:relative md:translate-x-0 md:h-screen
        bg-bg-surface border-r border-bdr-base flex flex-col justify-between shrink-0
        sidebar-transition overflow-y-auto transform
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
      `}>
        <div>
          {/* Logo collapse trigger */}
          <div 
            onClick={handleLogoClick}
            className={`border-b border-bdr-base flex items-center theme-transition cursor-pointer hover:bg-bg-base/40 active:scale-[0.98] select-none h-20 transition-all duration-300 ${isSidebarCollapsed ? 'p-2 justify-center' : 'p-4 justify-start'}`}
          >
            <div className={`overflow-hidden transition-all duration-300 ease-in-out relative flex items-center shrink-0 ${isSidebarCollapsed ? 'w-16 h-16' : 'w-52 h-12'}`}>
              {isSidebarCollapsed ? (
                <img src={rinoasistCollapsedLight} alt="RinoAsist Icon" className="h-full w-full object-contain animate-fadeIn" />
              ) : (
                <img src={isDark ? rinoasistBannerDark : rinoasistBanner} alt="RinoAsist Logo" className="h-[46px] w-auto object-contain object-left" />
              )}
            </div>
          </div>

          {/* Profile Quick Info */}
          <div className="p-5 border-b border-bdr-base bg-bg-base/30 theme-transition flex justify-center md:block">
            <div className="flex items-center gap-3">
              <div className="bg-brand-primary/10 text-brand-primary p-2.5 rounded-xl border border-brand-primary/20 font-bold text-lg shrink-0 w-11 h-11 flex items-center justify-center">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out flex flex-col justify-center ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-36 opacity-100 ml-1'}`}>
                <h4 className="font-bold text-sm truncate">{user.name}</h4>
                <span className="text-xs text-txt-muted capitalize block font-semibold mt-0.5 whitespace-nowrap">
                  👨‍🏫 Docente
                </span>
                <span className="text-[9px] text-brand-primary font-bold bg-brand-primary/10 border border-brand-primary/15 px-1.5 py-0.5 rounded mt-1.5 inline-block w-fit whitespace-nowrap">
                  Ciclo: {getSchoolCycle()}
                </span>
              </div>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="p-4 space-y-1">
            <div className={`text-[10px] font-bold text-txt-subtle uppercase tracking-widest px-3 mb-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'h-0 opacity-0 mb-0' : 'h-4 opacity-100'}`}>
              Panel principal
            </div>
            
            <button 
              onClick={() => { setActiveTab('resumen'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'resumen' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Resumen</span>
            </button>

            <button 
              onClick={() => { setActiveTab('pase_lista'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'pase_lista' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Pase de Lista</span>
            </button>

            <button 
              onClick={() => { setActiveTab('riesgo'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'riesgo' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Alumnos en Riesgo</span>
            </button>

            <button 
              onClick={() => { setActiveTab('justificantes'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'justificantes' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Justificantes</span>
            </button>

            <button 
              onClick={() => { setActiveTab('analiticas'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'analiticas' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Analíticas</span>
            </button>

            <button 
              onClick={() => { setActiveTab('historial'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'historial' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Historial</span>
            </button>

            <button 
              onClick={() => { setActiveTab('escaneos'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'escaneos' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Escaneos QR</span>
            </button>
          </nav>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-bdr-base space-y-4 theme-transition">
          <button 
            onClick={handleLogout}
            className={`w-full bg-bg-base hover:bg-rose-500/10 text-txt-muted hover:text-rose-600 border border-bdr-base hover:border-rose-500/20 py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-2.5'}`}>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:p-10 space-y-8 overflow-y-auto">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-bdr-base theme-transition">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Panel de Control</h2>
            <p className="text-txt-muted text-sm mt-1">
              Bienvenido de nuevo, <span className="font-semibold text-txt-base">{user.name}</span>. Gestiona tus actividades.
            </p>
          </div>
          
          <div className="flex items-center gap-3.5">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsCycleDropdownOpen(!isCycleDropdownOpen)}
                className="flex items-center gap-2.5 bg-bg-surface hover:bg-bg-surface/85 border border-bdr-base px-4 py-2 rounded-xl text-sm font-semibold text-txt-muted theme-transition cursor-pointer select-none"
              >
                <Layers className="w-4 h-4 text-brand-primary" />
                <span>Ciclo: {getSchoolCycle()}</span>
                <ChevronDown className="w-3.5 h-3.5 text-txt-muted" />
              </button>
              
              {isCycleDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCycleDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-bg-card border border-bdr-base rounded-xl shadow-xl z-20 py-1.5 max-h-60 overflow-y-auto theme-transition text-left">
                    {schoolCyclesList.map((cycle) => (
                      <button
                        key={cycle}
                        onClick={() => {
                          handleCycleChange(cycle);
                          setIsCycleDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors ${
                          getSchoolCycle() === cycle 
                            ? 'text-brand-primary bg-brand-primary/10' 
                            : 'text-txt-subtle hover:text-txt-base hover:bg-bg-surface'
                        }`}
                      >
                        {cycle}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2.5 bg-bg-surface border border-bdr-base px-4 py-2 rounded-xl text-sm font-semibold text-txt-muted theme-transition">
              <Calendar className="w-4 h-4 text-brand-primary" />
              <span>Hoy: {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Welcome Header Card */}
        <div className="bg-bg-card border border-bdr-base p-6 rounded-3xl shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 theme-transition text-left relative overflow-hidden mb-8">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-brand-primary/10 to-blue-500/10 rounded-3xl -z-10"></div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4.5 flex-grow">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-tr from-brand-primary to-blue-500 rounded-full blur opacity-25 animate-pulse"></div>
              <img src={roleDocente} alt="Role Icon" className="relative w-20 h-20 object-contain drop-shadow-md" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">¡Hola de nuevo, {user.name.split(' ')[0]}!</h3>
              <p className="text-sm text-txt-muted max-w-md leading-relaxed">
                Listo para iniciar tus actividades del día. Recuerda que puedes proyectar el código QR para un pase de lista rápido.
              </p>
            </div>
          </div>

          {/* Mascot Interactive Panel */}
          <div className="flex items-center gap-3 bg-bg-surface/50 border border-bdr-base/60 p-3.5 rounded-2xl max-w-sm w-full lg:w-96 theme-transition hover:border-brand-primary/30 relative">
            <img src={rhinoMascot} alt="Rino" className="w-14 h-14 object-contain shrink-0 drop-shadow-md animate-pulse" />
            <div className="text-[11px] leading-relaxed font-semibold text-txt-muted text-left flex-grow">
              {getMascotMessage()}
            </div>
          </div>

          <button 
            onClick={() => handleOpenQRModal()}
            className="bg-brand-primary hover:bg-brand-hover text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-md hover:shadow-lg hover:shadow-brand-primary/10 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <QrCode className="w-4.5 h-4.5" />
            Proyectar QR
          </button>
        </div>

        {/* Render Teacher Views */}
        <TeacherDashboardView 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          isSidebarCollapsed={isSidebarCollapsed}
        />
      </main>

      {/* QR SCANNERS MODAL FOR TEACHERS */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="glass-modal rounded-3xl p-8 max-w-sm w-full relative space-y-6 text-center theme-transition">
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-blue-500 rounded-3xl blur-xl opacity-20 -z-10 animate-pulse"></div>

            <div>
              <h3 className="text-xl font-bold">Código QR Dinámico</h3>
              <p className="text-xs text-txt-muted mt-1">Escanear para auto-registrar asistencia en el grupo seleccionado.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl inline-block shadow-lg mx-auto relative group">
              <div className="w-48 h-48 bg-slate-50 flex items-center justify-center border border-slate-200 rounded-xl relative overflow-hidden">
                {qrToken ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/scan?token=${qrToken}`)}`} 
                    alt="Código QR de Asistencia" 
                    className="w-44 h-44 object-contain transition-all duration-300"
                  />
                ) : (
                  <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
                )}
                <div className="absolute left-0 right-0 h-0.5 bg-rose-500/80 shadow-md shadow-rose-500 animate-bounce top-1/2"></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-brand-primary">Actualizando en {qrCodeTimer}s</div>
              <div className="w-full bg-bg-surface border border-bdr-base/60 h-1.5 rounded-full overflow-hidden theme-transition">
                <div 
                  className="bg-brand-primary h-1.5 transition-all duration-1000 ease-linear" 
                  style={{ width: `${(qrCodeTimer / 30) * 100}%` }}
                ></div>
              </div>
            </div>

            <p className="text-[10px] text-txt-subtle leading-normal">
              Este código cambia de firma periódicamente para evitar pases de lista fraudulentos o capturas de pantalla fuera del aula.
            </p>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full bg-bg-surface hover:bg-bg-surface/80 border border-bdr-base text-txt-base font-semibold py-3 rounded-xl transition-all duration-300 cursor-pointer"
            >
              Cerrar Código
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
