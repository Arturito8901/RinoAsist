import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getSchoolCycle } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import StudentScheduleTab from '../StudentScheduleTab';
import StudentJustificantesTab from '../StudentJustificantesTab';
import StudentCalculatorTab from '../StudentCalculatorTab';
import rhinoMascot from '../../assets/rhino_mascot.png';
import rinoasistBanner from '../../assets/rinoasist_banner.png';
import rinoasistBannerDark from '../../assets/rinoasist_banner_dark.png';
import rinoasistCollapsedLight from '../../assets/rinoasist_collapsed_light.png';
import roleAlumno from '../../assets/role_alumno.png';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  LogOut, Calendar, Layers, Clock, QrCode, TrendingUp, AlertTriangle, 
  RefreshCw, Calculator, Award, WifiOff, Trash2, CheckCircle2
} from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-bg-card/85 backdrop-blur-md border border-bdr-base p-3.5 rounded-2xl shadow-xl text-left theme-transition select-none">
        <p className="text-[9px] font-extrabold text-txt-subtle uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5 mt-1.5">
          {payload.map((item, idx) => {
            const name = item.name === 'asistencias' || item.name === 'Asistencia' || item.name === 'asistencia_promedio' || item.name === 'attendanceRate' ? 'Asistencia' : item.name;
            const isRate = typeof item.value === 'number';
            const valueDisplay = isRate ? `${Math.round(item.value)}%` : item.value;
            
            let valColor = 'text-txt-base';
            if (name.toLowerCase().includes('asist') && isRate) {
              valColor = item.value < 80 ? 'text-rose-500 font-bold' : item.value < 85 ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold';
            } else if (name.toLowerCase().includes('falta')) {
              valColor = 'text-rose-500 font-bold';
            }
            
            return (
              <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-txt-muted font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.stroke }}></span>
                  {name}:
                </span>
                <span className={`font-semibold ${valColor}`}>{valueDisplay}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const isDateInWeek = (dateStr, weekId) => {
  if (!dateStr) return false;
  let yyyymmdd = dateStr;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 2) {
      yyyymmdd = `2026-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else if (parts.length === 3) {
      yyyymmdd = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const ranges = {
    w1: { start: '2026-05-25', end: '2026-05-29' },
    w2: { start: '2026-05-18', end: '2026-05-22' },
    w3: { start: '2026-05-11', end: '2026-05-15' },
    w4: { start: '2026-05-04', end: '2026-05-08' }
  };
  const range = ranges[weekId] || ranges['w1'];
  return yyyymmdd >= range.start && yyyymmdd <= range.end;
};

export default function StudentDashboard({ user }) {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Layout states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // General States
  const [activeTab, setActiveTab] = useState('resumen');
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [studentData, setStudentData] = useState(null);
  const [studentDropRequests, setStudentDropRequests] = useState([]);
  const [showOfflineQRModal, setShowOfflineQRModal] = useState(false);
  const [offlineQrToken, setOfflineQrToken] = useState('');
  const [liveTime, setLiveTime] = useState('');
  const [loading, setLoading] = useState(true);

  // Notification and Confirmation states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    isDanger: false,
    onConfirm: null
  });

  const [reminderToast, setReminderToast] = useState({ show: false, teacherName: '' });

  const handleOpenOfflineQRModal = () => {
    const studentMatricula = user?.id === 3 ? 'ST-001' : user?.id?.toString() || 'ST-000';
    const dateStr = new Date().toISOString().split('T')[0];
    const randStr = Math.random().toString(36).substr(2, 6).toUpperCase();
    setOfflineQrToken(`RINO-OFFLINE-${studentMatricula}-${dateStr}-${randStr}`);
    setShowOfflineQRModal(true);
  };

  useEffect(() => {
    let interval;
    if (showOfflineQRModal) {
      setTimeout(() => {
        setLiveTime(new Date().toLocaleTimeString());
      }, 0);
      interval = setInterval(() => {
        setLiveTime(new Date().toLocaleTimeString());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showOfflineQRModal]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [data, dropReqs] = await Promise.all([
          api.getStudentSummary(),
          api.getStudentDropRequests()
        ]);
        setStudentData(data);
        setStudentDropRequests(dropReqs);
      } catch (err) {
        console.error("Error loading student dashboard details:", err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const filteredStudentData = useMemo(() => {
    if (!studentData) return null;
    const logs = studentData.attendanceLog || [];
    const filteredLogs = logs.filter(log => isDateInWeek(log.date, selectedWeek));
    
    let total = filteredLogs.length;
    let justified = 0;
    let unjustified = 0;
    let attended = 0;
    let retardo = 0;
    
    filteredLogs.forEach(log => {
      const status = log.status.toLowerCase();
      if (status.includes('asistió') || status.includes('asistio')) {
        attended++;
      } else if (status.includes('retardo')) {
        retardo++;
      } else if (status.includes('justificad') || status.includes('justificac')) {
        justified++;
      } else {
        unjustified++;
      }
    });
    
    let attendancePct = 100;
    if (total > 0) {
      const scoreSum = attended * 1.0 + retardo * 0.8 + justified * 1.0;
      attendancePct = Math.round((scoreSum / total) * 100);
    }
    
    const filteredCourses = (studentData.myCourses || []).map(course => {
      const courseLogs = filteredLogs.filter(log => 
        log.course?.toLowerCase() === course.courseName?.toLowerCase() ||
        log.course?.toLowerCase().includes(course.courseName?.toLowerCase())
      );
      
      let courseTotal = courseLogs.length;
      let courseAtt = 0;
      let courseRet = 0;
      let courseJust = 0;
      
      courseLogs.forEach(log => {
        const status = log.status.toLowerCase();
        if (status.includes('asistió') || status.includes('asistio')) courseAtt++;
        else if (status.includes('retardo')) courseRet++;
        else if (status.includes('justificad') || status.includes('justificac')) courseJust++;
      });
      
      const courseRate = courseTotal > 0
        ? Math.round(((courseAtt * 1.0 + courseRet * 0.8 + courseJust * 1.0) / courseTotal) * 100)
        : course.attendanceRate;
      
      return {
        ...course,
        attendanceRate: courseRate
      };
    });
    
    return {
      kpis: {
        myAttendance: `${attendancePct}%`,
        totalClasses: total,
        justifiedFails: justified,
        unjustifiedFails: unjustified
      },
      myCourses: filteredCourses,
      attendanceLog: filteredLogs
    };
  }, [studentData, selectedWeek]);

  const handleDropCourseRequestClick = (asignacionId, courseName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Solicitar Baja de Materia',
      message: `¿Estás seguro de que deseas solicitar la baja de la materia "${courseName}"? Esta solicitud será enviada al administrador para su revisión y aprobación. Podrás cursarla en otro periodo si es autorizada.`,
      confirmText: 'Solicitar Baja',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.requestDropCourse(asignacionId);
          const [data, dropReqs] = await Promise.all([
            api.getStudentSummary(),
            api.getStudentDropRequests()
          ]);
          setStudentData(data);
          setStudentDropRequests(dropReqs);
          
          setReminderToast({ show: true, teacherName: `Solicitud de baja enviada con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        } catch (err) {
          console.error("Error requesting drop:", err);
        }
      }
    });
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
    if (filteredStudentData?.kpis) {
      const rateStr = filteredStudentData.kpis.myAttendance || "100%";
      const rate = parseInt(rateStr);
      if (rate >= 85) {
        return `¡Hola! Rino está muy orgulloso de ti. Tienes un promedio de asistencia de ${rateStr}. ¡Sigue así para conservar tu derecho a examen! 🦏🎉`;
      } else if (rate >= 80) {
        return `¡Hola! Vas por buen camino, pero no te confíes. Tu promedio actual es de ${rateStr}. ¡Evita faltar a tus próximas clases! 🦏💪`;
      } else {
        return `¡Alerta! Tu promedio de asistencia de ${rateStr} está por debajo del 80% mínimo requerido. Rino te aconseja subir justificantes pronto. 🦏⚠️`;
      }
    }
    return `¡Hola! Bienvenido al portal escolar de RinoAsist. 🦏`;
  };

  // Recharts style setup
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const primaryChartColor = isDark ? '#3b82f6' : '#0052cc';
  const fontColor = isDark ? '#94a3b8' : '#64748b';

  const handleExportStudentPDF = () => {
    const studentId = user.id === 3 ? 'ST-001' : user.id.toString();
    const printWindow = window.open('', '_blank');
    const sortedLogs = [...(studentData.attendanceLog || [])].reverse();
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Asistencia - ${user.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body { font-family: 'Outfit', sans-serif; color: #0f172a; margin: 40px; background-color: #ffffff; }
            .header { border-bottom: 3px double #0052cc; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
            .title-area { flex-grow: 1; }
            .title { font-size: 22px; font-weight: 800; color: #0052cc; letter-spacing: -0.5px; }
            .subtitle { font-size: 13px; color: #64748b; margin-top: 5px; font-weight: 500; }
            .watermark { height: 55px; opacity: 0.95; object-fit: contain; margin-left: 20px; }
            .kpi-container { display: flex; gap: 20px; margin-bottom: 30px; }
            .kpi-card { flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; }
            .kpi-val { font-size: 20px; font-weight: 800; color: #0052cc; }
            .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
            .section-title { font-size: 15px; font-weight: 700; margin-top: 30px; margin-bottom: 15px; color: #0052cc; border-left: 4px solid #0052cc; padding-left: 10px; text-transform: uppercase; page-break-after: avoid; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: avoid; }
            th { background-color: #0052cc; color: white; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
            tr:nth-child(even) td { background-color: #f8fafc; }
            .val-good { color: #15803d; font-weight: bold; }
            .val-danger { color: #b91c1c; font-weight: bold; }
            .status-badge { display: inline-block; padding: 3px 8px; font-size: 10px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; }
            .status-asistio { background-color: #dcfce7; color: #15803d; }
            .status-retardo { background-color: #fef3c7; color: #b45309; }
            .status-falta { background-color: #fee2e2; color: #b91c1c; }
            .status-justificada { background-color: #e0f2fe; color: #0369a1; }
            .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-area">
              <div class="title">REPORTE INDIVIDUAL DE ASISTENCIA (ALUMNO)</div>
              <div class="subtitle">Alumno: <strong>${user.name}</strong> | Matrícula: <strong>${studentId}</strong> | Generado: ${new Date().toLocaleString()}</div>
            </div>
            <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" class="watermark" />
          </div>

          <div class="kpi-container">
            <div class="kpi-card">
              <div class="kpi-val">${studentData.kpis.myAttendance}</div>
              <div class="kpi-label">Asistencia Global</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${studentData.kpis.totalClasses}</div>
              <div class="kpi-label">Clases Registradas</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${studentData.kpis.justifiedFails}</div>
              <div class="kpi-label">Faltas Justificadas</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val" style="${Number(studentData.kpis.unjustifiedFails) > 0 ? 'color: #ef4444;' : 'color: #10b981;'}">
                ${studentData.kpis.unjustifiedFails}
              </div>
              <div class="kpi-label">Faltas Sin Justificar</div>
            </div>
          </div>

          <div class="section-title">Resumen por Asignatura</div>
          <table>
            <thead>
              <tr>
                <th>Asignatura</th>
                <th>Profesor</th>
                <th style="text-align: right;">Tasa de Asistencia</th>
                <th style="text-align: right;">Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${studentData.myCourses.map(c => {
                const isRisk = c.attendanceRate < 80;
                return `
                  <tr>
                    <td><strong>${c.courseName}</strong></td>
                    <td>${c.teacherName}</td>
                    <td style="text-align: right;" class="${isRisk ? 'val-danger' : 'val-good'}">${c.attendanceRate}%</td>
                    <td style="text-align: right;">
                      <span class="status-badge ${isRisk ? 'status-falta' : 'status-asistio'}">
                        ${isRisk ? 'Riesgo' : 'Regular'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="section-title" style="margin-top: 35px;">Bitácora de Asistencias Recientes</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Asignatura</th>
                <th style="text-align: right;">Registro</th>
              </tr>
            </thead>
            <tbody>
              ${sortedLogs.map(log => {
                const statusClass = 
                  log.status.toLowerCase().includes('asistio') || log.status.toLowerCase().includes('asistió') ? 'status-asistio' :
                  log.status.toLowerCase().includes('retardo') ? 'status-retardo' :
                  log.status.toLowerCase().includes('justificad') ? 'status-justificada' : 'status-falta';
                return `
                  <tr>
                    <td><code>${log.date}</code></td>
                    <td><strong>${log.course}</strong></td>
                    <td style="text-align: right;">
                      <span class="status-badge ${statusClass}">${log.status}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">RinoAsist - Portal Escolar Oficial de Monitoreo de Asistencias</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  if (loading || !studentData) {
    return (
      <div className="min-h-screen bg-bg-base text-txt-base flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-10 h-10 text-brand-primary animate-spin" />
        <span className="font-semibold text-txt-muted">Cargando panel de control...</span>
      </div>
    );
  }

  const studentDataVal = filteredStudentData;
  const studentId = user.id === 3 ? 'ST-001' : user.id.toString();
  const riskCourses = studentDataVal.myCourses?.filter(c => c.attendanceRate < 80) || [];

  const getCourseTrend = (courseName, currentRate) => {
    const logs = studentDataVal.attendanceLog?.filter(log => 
      log.course?.toLowerCase() === courseName?.toLowerCase() ||
      log.course?.toLowerCase().includes(courseName?.toLowerCase())
    ) || [];
    
    if (logs.length < 2) return { isNegative: false, recentRate: currentRate };
    
    const recentLogs = logs.slice(0, 3);
    let scoreSum = 0;
    recentLogs.forEach(log => {
      const status = log.status.toLowerCase();
      if (status.includes('asistió') || status.includes('asistio')) scoreSum += 1.0;
      else if (status.includes('retardo')) scoreSum += 0.8;
      else if (status.includes('justificad') || status.includes('justificac')) scoreSum += 1.0;
    });
    
    const recentRate = Math.round((scoreSum / recentLogs.length) * 100);
    const isNegative = recentRate < 80 || recentRate < (currentRate - 5);
    return { isNegative, recentRate, recentLogsCount: recentLogs.length };
  };

  const trendRiskCourses = studentDataVal.myCourses?.filter(c => {
    if (c.attendanceRate < 80) return false;
    const trend = getCourseTrend(c.courseName, c.attendanceRate);
    return trend.isNegative;
  }) || [];
  
  const getPieData = () => {
    const counts = { Asistio: 0, Retardo: 0, Falta: 0, Justificado: 0 };
    studentDataVal.attendanceLog?.forEach(log => {
      const status = log.status.toLowerCase();
      if (status.includes('asistió') || status.includes('asistio')) counts.Asistio++;
      else if (status.includes('retardo')) counts.Retardo++;
      else if (status.includes('justificad') || status.includes('justificac')) counts.Justificado++;
      else counts.Falta++;
    });
    
    if (counts.Asistio === 0 && counts.Retardo === 0 && counts.Falta === 0 && counts.Justificado === 0) {
      return [];
    }

    return [
      { name: 'Asistencias', value: counts.Asistio, color: '#10b981' },
      { name: 'Retardos', value: counts.Retardo, color: '#f59e0b' },
      { name: 'Faltas', value: counts.Falta, color: '#ef4444' },
      { name: 'Justificados', value: counts.Justificado, color: '#3b82f6' }
    ].filter(item => item.value > 0);
  };

  const getAreaChartData = () => {
    const sortedLogs = [...(studentDataVal.attendanceLog || [])].reverse();
    let accumulatedClasses = 0;
    let accumulatedAttendance = 0;
    
    const chartPoints = sortedLogs.map((log) => {
      accumulatedClasses++;
      const status = log.status.toLowerCase();
      const score = (status.includes('asistió') || status.includes('asistio')) ? 100
        : status.includes('retardo') ? 70
        : (status.includes('justificad') || status.includes('justificac')) ? 100
        : 0;
      
      accumulatedAttendance += score;
      const currentRunningRate = Math.round(accumulatedAttendance / accumulatedClasses);
      
      return {
        fecha: log.date.split('-').slice(1).reverse().join('/'),
        Asistencia: currentRunningRate
      };
    });

    if (chartPoints.length === 0) {
      return [];
    }
    return chartPoints;
  };

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
                  🎓 Alumno
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
              onClick={() => { setActiveTab('horario'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'horario' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Horario Semanal</span>
            </button>

            <button 
              onClick={() => { setActiveTab('justificantes'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'justificantes' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Mis Justificantes</span>
            </button>

            <button 
              onClick={() => { setActiveTab('calculadora'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${activeTab === 'calculadora' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'} ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>Calculadora</span>
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
            <div className="flex items-center gap-2.5 bg-bg-surface border border-bdr-base px-4 py-2 rounded-xl text-sm font-semibold text-txt-muted theme-transition">
              <Layers className="w-4 h-4 text-brand-primary" />
              <span>Ciclo: {getSchoolCycle()}</span>
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
              <img src={roleAlumno} alt="Role Icon" className="relative w-20 h-20 object-contain drop-shadow-md" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">¡Hola de nuevo, {user.name.split(' ')[0]}!</h3>
              <p className="text-sm text-txt-muted max-w-md leading-relaxed">
                Monitorea tu porcentaje de asistencia por materia y mantente al corriente.
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
        </div>

        {/* Dynamic Views based on tab */}
        <div className="space-y-8 animate-fadeIn">
          {activeTab === 'resumen' && (
            <>
              {/* Actions Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-2">
                <div className="flex items-center gap-2 w-full sm:w-auto text-left">
                  <label className="text-xs font-bold text-txt-muted whitespace-nowrap">Semana:</label>
                  <select 
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs font-semibold cursor-pointer theme-transition w-full sm:w-44 shadow-sm"
                  >
                    <option value="w1">Semana Actual (25-29 May)</option>
                    <option value="w2">Semana Anterior (18-22 May)</option>
                    <option value="w3">Hace 2 Semanas (11-15 May)</option>
                    <option value="w4">Hace 3 Semanas (04-08 May)</option>
                  </select>
                </div>

                <div className="flex flex-wrap justify-end gap-3.5 w-full sm:w-auto">
                  <button
                    onClick={handleExportStudentPDF}
                    className="py-2.5 px-5 border border-brand-primary hover:bg-brand-primary/5 hover:scale-[1.01] rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-2 text-brand-primary theme-transition active:scale-[0.98]"
                    title="Descargar mi reporte de asistencia en PDF"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Descargar Reporte PDF</span>
                  </button>
                  <button
                    onClick={() => navigate('/scan')}
                    className="bg-brand-primary hover:bg-brand-hover text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.02] flex items-center gap-2 cursor-pointer animate-fadeIn active:scale-[0.98] transition-all"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Escanear Código QR</span>
                  </button>
                  <button
                    onClick={handleOpenOfflineQRModal}
                    className="bg-bg-card hover:bg-bg-surface border border-bdr-base text-txt-base font-bold py-2.5 px-5 rounded-xl shadow-sm hover:scale-[1.02] flex items-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
                  >
                    <WifiOff className="w-4 h-4 text-emerald-500" />
                    <span>Token Offline</span>
                  </button>
                </div>
              </div>

              {/* Warning Danger banner if student has classes under 80% */}
              {riskCourses.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/25 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse-subtle text-left">
                  <div className="flex items-start gap-3.5">
                    <div className="bg-rose-500/15 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl border border-rose-500/10 shrink-0">
                      <AlertTriangle className="w-6 h-6 text-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm text-rose-600 dark:text-rose-400">¡Alerta de Límite de Faltas!</h4>
                      <p className="text-xs text-txt-muted max-w-2xl leading-normal">
                        Tienes {riskCourses.length === 1 ? 'una materia' : `${riskCourses.length} materias`} con asistencia inferior al **80%** reglamentario:{' '}
                        {riskCourses.map((c, idx) => (
                          <span key={c.id} className="font-bold text-txt-base">
                            {c.courseName} ({c.attendanceRate}%){idx < riskCourses.length - 1 ? ', ' : ''}
                          </span>
                        ))}. 
                        Estás en riesgo de perder derecho a examen. Te aconsejamos enviar un justificante o hablar con tu profesor.
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setActiveTab('justificantes')}
                    className="bg-rose-600 hover:bg-rose-750 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    Solicitar Justificante
                  </button>
                </div>
              )}

              {/* Warning Predictive Trend banner (Early warning) */}
              {trendRiskCourses.length > 0 && (
                <div className="bg-amber-550/10 border border-amber-500/25 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left animate-fadeIn">
                  <div className="flex items-start gap-3.5">
                    <div className="bg-amber-500/15 text-amber-600 dark:text-amber-450 p-2.5 rounded-xl border border-amber-500/10 shrink-0">
                      <TrendingUp className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-sm text-amber-600 dark:text-amber-450">¡Alerta Preventiva de Tendencia!</h4>
                      <p className="text-xs text-txt-muted max-w-2xl leading-normal">
                        Tu ritmo de asistencia reciente en {trendRiskCourses.length === 1 ? 'la siguiente asignatura' : 'las siguientes asignaturas'} ha disminuido:{' '}
                        {trendRiskCourses.map((c, idx) => {
                          const trend = getCourseTrend(c.courseName, c.attendanceRate);
                          return (
                            <span key={c.id} className="font-bold text-txt-base">
                              {c.courseName} (Reciente: {trend.recentRate}% vs Global: {c.attendanceRate}%){idx < trendRiskCourses.length - 1 ? ', ' : ''}
                            </span>
                          );
                        })}. 
                        Si sigues acumulando faltas recientes, caerás muy pronto por debajo del 80% mínimo. Te recomendamos simular tu situación.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('calculadora')}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    Simular Faltas
                  </button>
                </div>
              )}

              {/* Student KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider block mb-2">Mi Asistencia Global</span>
                  <div className="text-3xl font-extrabold text-brand-primary">{studentDataVal.kpis.myAttendance}</div>
                  <p className="text-[10px] text-txt-subtle mt-1.5 font-semibold">Semestre actual</p>
                </div>

                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider block mb-2">Clases Totales</span>
                  <div className="text-3xl font-extrabold text-txt-base">{studentDataVal.kpis.totalClasses}</div>
                  <p className="text-[10px] text-txt-subtle mt-1.5 font-semibold">Sesiones evaluadas</p>
                </div>

                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider block mb-2">Faltas Justificadas</span>
                  <div className="text-3xl font-extrabold text-emerald-500 dark:text-emerald-450">{studentDataVal.kpis.justifiedFails}</div>
                  <p className="text-[10px] text-txt-subtle mt-1.5 font-semibold">Con justificante oficial</p>
                </div>

                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider block mb-2">Faltas Sin Justificar</span>
                  <div className="text-3xl font-extrabold text-rose-500">{studentDataVal.kpis.unjustifiedFails}</div>
                  <p className="text-[10px] text-txt-subtle mt-1.5 font-semibold">Afecta calificación</p>
                </div>
              </div>

              {/* Dynamic Analytics Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl lg:col-span-2 space-y-4 shadow-sm theme-transition text-left">
                  <div>
                    <h4 className="font-extrabold text-base">Tendencia de Asistencia</h4>
                    <p className="text-xs text-txt-muted mt-0.5">Progreso acumulado de tu porcentaje de asistencia a lo largo de las sesiones.</p>
                  </div>
                  <div className="h-44 w-full text-[10px]">
                    <ResponsiveContainer width="100%" height="100%" debounce={150}>
                      <AreaChart data={getAreaChartData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorStudentTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryChartColor} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={primaryChartColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="fecha" stroke={fontColor} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke={fontColor} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="Asistencia" stroke={primaryChartColor} strokeWidth={2} fillOpacity={1} fill="url(#colorStudentTrend)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl space-y-4 shadow-sm theme-transition text-left flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-base">Desglose de Registros</h4>
                    <p className="text-xs text-txt-muted mt-0.5">Distribución de estados marcados en tu bitácora.</p>
                  </div>
                  <div className="h-32 w-full relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%" debounce={150}>
                      <PieChart>
                        <Pie
                          data={getPieData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {getPieData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center flex flex-col items-center justify-center">
                      <span className="text-lg font-extrabold leading-none">{studentDataVal.kpis.myAttendance}</span>
                      <span className="text-[8px] text-txt-subtle font-bold uppercase mt-0.5">Asist.</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center text-[9px] font-bold text-txt-muted border-t border-bdr-base/40 pt-3">
                    {getPieData().map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                        <span className="truncate">{entry.name}: {entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Achievements and Medals Section */}
              <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-6 theme-transition text-left">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Award className="w-5 h-5 text-brand-primary" />
                    <span>Mis Logros y Medallas</span>
                  </h3>
                  <p className="text-txt-muted text-xs mt-0.5">
                    Fomenta tu puntualidad y desbloquea insignias especiales al cumplir tus metas de asistencia escolar.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {(() => {
                    const globalAttendance = studentDataVal.kpis.myAttendance ? parseFloat(studentDataVal.kpis.myAttendance) : 0;
                    
                    let totalAttended = 0;
                    studentDataVal.attendanceLog?.forEach(log => {
                      const s = log.status.toLowerCase();
                      if (s.includes('asistió') || s.includes('asistio')) totalAttended++;
                    });
                    
                    const savedJusts = JSON.parse(localStorage.getItem('approved_justifications') || '[]');
                    const savedClaims = JSON.parse(localStorage.getItem('attendance_claims') || '[]');
                    
                    const myJusts = savedJusts.filter(j => j.studentId === studentId || j.studentName?.toLowerCase() === user.name?.toLowerCase());
                    const myClaims = savedClaims.filter(c => c.studentId === studentId || c.studentName?.toLowerCase() === user.name?.toLowerCase());
                    
                    const hasRejected = myJusts.some(j => j.status === 'Rechazado') || myClaims.some(c => c.status === 'Rechazado');
                    
                    const achievements = [
                      {
                        id: 'bronze',
                        title: 'Rino de Bronce',
                        desc: 'Asistencia global >= 80% (Reglamentario).',
                        unlocked: globalAttendance >= 80,
                        icon: '🥉',
                        badgeColor: 'bg-amber-600/10 text-amber-700 border-amber-500/20',
                        progress: `${globalAttendance}% / 80%`
                      },
                      {
                        id: 'perfect',
                        title: 'Asistencia Perfecta',
                        desc: 'Asistencia global >= 95%.',
                        unlocked: globalAttendance >= 95,
                        icon: '🏆',
                        badgeColor: 'bg-yellow-400/10 text-yellow-600 border-yellow-450/20',
                        progress: `${globalAttendance}% / 95%`
                      },
                      {
                        id: 'steady',
                        title: 'Paso Firme',
                        desc: 'Registrar al menos 3 asistencias puntuales.',
                        unlocked: totalAttended >= 3,
                        icon: '⚡',
                        badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                        progress: `${totalAttended} / 3 asistencias`
                      },
                      {
                        id: 'current',
                        title: 'Alumno Al Corriente',
                        desc: 'Sin solicitudes rechazadas.',
                        unlocked: !hasRejected && studentDataVal.attendanceLog?.length > 0,
                        icon: '🛡️',
                        badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                        progress: hasRejected ? 'Rechazado' : (studentDataVal.attendanceLog?.length > 0 ? 'Al día' : 'Sin registros')
                      }
                    ];

                    return achievements.map(ach => (
                      <div 
                        key={ach.id} 
                        className={`border rounded-2xl p-5 flex flex-col justify-between space-y-4 theme-transition relative overflow-hidden ${
                          ach.unlocked 
                            ? 'bg-bg-surface/50 border-bdr-base/80 shadow-sm opacity-100' 
                            : 'bg-bg-surface/20 border-bdr-base/30 opacity-60 grayscale'
                        }`}
                      >
                        {ach.unlocked && (
                          <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-brand-primary/5 rounded-full blur-lg"></div>
                        )}
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-2xl">{ach.icon}</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${ach.badgeColor}`}>
                              {ach.unlocked ? 'Desbloqueado' : 'Bloqueado'}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-sm text-txt-base">{ach.title}</h4>
                          <p className="text-[10px] text-txt-muted leading-relaxed">{ach.desc}</p>
                        </div>

                        <div className="border-t border-bdr-base/40 pt-3 flex justify-between items-center text-[10px] font-bold">
                          <span className="text-txt-subtle">Progreso:</span>
                          <span className={ach.unlocked ? 'text-emerald-500' : 'text-txt-subtle'}>
                            {ach.progress}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Courses and logs details */}
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Course Attendance List */}
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl space-y-6 shadow-sm theme-transition">
                  <div>
                    <h3 className="text-lg font-bold">Asistencia por Asignatura</h3>
                    <p className="text-txt-muted text-xs mt-0.5">Porcentaje de asistencias acumuladas y docente de la materia.</p>
                  </div>
                  <div className="space-y-4">
                    {studentDataVal.myCourses.map((c, i) => {
                      const isAtRisk = c.attendanceRate < 80;
                      const trend = getCourseTrend(c.courseName, c.attendanceRate);
                      return (
                        <div key={i} className="bg-bg-surface border border-bdr-base p-4 rounded-xl flex items-center justify-between theme-transition">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-txt-base block">{c.courseName}</span>
                              {!isAtRisk && trend.isNegative && (
                                <span className="bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-450 text-[9px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                                  📉 Riesgo Reciente
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-txt-muted block">{c.teacherName}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className={`font-extrabold text-sm block ${isAtRisk ? 'text-rose-500' : 'text-brand-primary'}`}>
                                {c.attendanceRate}%
                              </span>
                              <span className="text-[9px] font-bold text-txt-subtle uppercase block">Tasa</span>
                            </div>
                            {studentDropRequests.some(r => String(r.asignacion_id) === String(c.asignacion_id) && r.estatus === 'pendiente') ? (
                              <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-extrabold rounded-lg uppercase tracking-wider select-none shrink-0" title="Baja solicitada al administrador">
                                Pendiente
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDropCourseRequestClick(c.asignacion_id, c.courseName)}
                                className="p-1.5 hover:bg-rose-500/10 text-txt-muted hover:text-rose-500 rounded-lg transition-all cursor-pointer active:scale-95 shrink-0"
                                title="Solicitar baja de materia"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Attendance Log Table */}
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl space-y-6 shadow-sm theme-transition">
                  <div>
                    <h3 className="text-lg font-bold">Bitácora de Asistencia</h3>
                    <p className="text-txt-muted text-xs mt-0.5">Registro de tus últimas firmas y entradas en el aula.</p>
                  </div>
                  <div className="space-y-3">
                    {studentDataVal.attendanceLog.map((log, i) => {
                      const isA = log.status.toLowerCase().includes('asistió') || log.status.toLowerCase().includes('asistio');
                      const isR = log.status.toLowerCase().includes('retardo');
                      const isJ = log.status.toLowerCase().includes('justificad');
                      return (
                        <div key={i} className="flex justify-between items-center py-3 border-b border-bdr-subtle last:border-0 theme-transition">
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-txt-base block">{log.course}</span>
                            <span className="text-xs text-txt-subtle block">{log.date}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                            isA ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20' : 
                            isR ? 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border-amber-500/20' : 
                            isJ ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' : 
                            'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          }`}>
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'horario' && (
            <StudentScheduleTab studentData={studentDataVal} />
          )}

          {activeTab === 'justificantes' && (
            <StudentJustificantesTab user={user} studentData={studentDataVal} />
          )}

          {activeTab === 'calculadora' && (
            <StudentCalculatorTab studentData={studentDataVal} />
          )}
        </div>
      </main>

      {/* OFFLINE QR TOKEN MODAL FOR STUDENTS */}
      {showOfflineQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-bg-card border border-bdr-base rounded-3xl p-8 max-w-sm w-full relative shadow-2xl space-y-6 text-center theme-transition">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur-xl opacity-20 -z-10 animate-pulse"></div>

            <div>
              <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                <WifiOff className="w-5 h-5 text-emerald-500" />
                <span>Token Offline</span>
              </h3>
              <p className="text-xs text-txt-muted mt-1.5">
                Muestra este código al profesor para registrar tu asistencia si no tienes datos móviles.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl inline-block shadow-lg mx-auto relative group">
              <div className="w-48 h-48 bg-slate-100 flex items-center justify-center border border-slate-200 rounded-xl relative overflow-hidden">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(offlineQrToken)}`} 
                  alt="Código QR Offline" 
                  className="w-44 h-44 object-contain transition-all duration-300"
                />
                <div className="absolute left-0 right-0 h-0.5 bg-emerald-500/80 shadow-md shadow-emerald-500 animate-bounce top-1/2"></div>
              </div>
            </div>

            {/* Live Clock and Verification indicators */}
            <div className="flex flex-col items-center justify-center gap-1 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-2xl theme-transition select-none">
              <span className="text-[9px] text-emerald-500 font-extrabold uppercase tracking-widest animate-pulse">● Pase de Lista en Vivo</span>
              <span className="text-xl font-mono font-extrabold text-txt-base tracking-widest">{liveTime}</span>
            </div>

            <div className="bg-bg-surface/50 border border-bdr-base/50 p-4 rounded-2xl text-left space-y-1.5 theme-transition">
              <div className="text-[10px] text-txt-subtle font-extrabold uppercase tracking-wider">Detalles de Credencial</div>
              <div className="text-xs font-semibold text-txt-base">Alumno: {user?.name}</div>
              <div className="text-xs font-semibold text-txt-base">Matrícula: {user?.id === 3 ? 'ST-001' : user?.id}</div>
              <div className="text-[10px] text-emerald-500 font-bold">● Válido solo por el día de hoy ({new Date().toLocaleDateString()})</div>
            </div>

            <button
              onClick={() => setShowOfflineQRModal(false)}
              className="w-full bg-bg-surface hover:bg-bg-surface/80 border border-bdr-base text-txt-base font-semibold py-3 rounded-xl transition-all duration-300 cursor-pointer"
            >
              Cerrar Token
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative text-left">
            <div className="flex items-center gap-2.5 pb-2 border-b border-bdr-base/60">
              {confirmModal.isDanger ? (
                <AlertTriangle className="text-rose-500 w-5.5 h-5.5 shrink-0 animate-bounce" />
              ) : (
                <CheckCircle2 className="text-brand-primary w-5.5 h-5.5 shrink-0" />
              )}
              <h3 className="font-extrabold text-lg text-txt-base">{confirmModal.title}</h3>
            </div>
            
            <p className="text-sm text-txt-muted leading-relaxed font-medium">
              {confirmModal.message}
            </p>
            
            <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base/60">
              <button 
                type="button" 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-bg-surface hover:bg-bg-surface/80 border border-bdr-base text-txt-base rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.97]"
              >
                {confirmModal.cancelText}
              </button>
              <button 
                type="button" 
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-[0.97] ${
                  confirmModal.isDanger 
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' 
                    : 'bg-brand-primary hover:bg-brand-hover shadow-brand-primary/10'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION FOR REMINDERS */}
      {reminderToast.show && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-scale-in max-w-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 animate-pulse" />
          <div className="space-y-0.5 text-left">
            <h5 className="font-extrabold text-sm text-txt-base">Acción Completada</h5>
            <p className="text-xs text-txt-muted font-semibold">{reminderToast.teacherName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
