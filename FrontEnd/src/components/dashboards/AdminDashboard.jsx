import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getSchoolCycle } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle';
import DesersionTab from '../DesersionTab';
import JustificantesTab from '../JustificantesTab';
import rhinoMascot from '../../assets/rhino_mascot.png';
import rinoasistBanner from '../../assets/rinoasist_banner.png';
import rinoasistBannerDark from '../../assets/rinoasist_banner_dark.png';
import rinoasistCollapsedLight from '../../assets/rinoasist_collapsed_light.png';
import roleAdmin from '../../assets/role_admin.png';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  LogOut, Calendar, Users, QrCode, 
  TrendingUp, AlertTriangle, RefreshCw, 
  ShieldAlert, UserCheck, Layers, ChevronDown, FileText, Download, Mail, BookOpen, Trash2, UserX,
  Clock, CheckCircle2, CheckCircle, Edit, Lock, Unlock, CalendarRange, UploadCloud, FileSpreadsheet
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

const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    return dateStr.split('-').slice(1).reverse().join('/');
  }
  return dateStr;
};

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('resumen');
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [expandedSemesters, setExpandedSemesters] = useState({});

  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [periodosList, setPeriodosList] = useState([]);
  const [selectedImportPeriodoId, setSelectedImportPeriodoId] = useState('');

  // Intersemestral states
  const [interClasses, setInterClasses] = useState([]);
  const [selectedInterClassId, setSelectedInterClassId] = useState(null);
  const [interStudents, setInterStudents] = useState([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [loadingInterData, setLoadingInterData] = useState(false);
  const [editingCupoId, setEditingCupoId] = useState(null);
  const [editingCupoValue, setEditingCupoValue] = useState(30);
  const [editingHorarioId, setEditingHorarioId] = useState(null);
  const [editingHorarioValue, setEditingHorarioValue] = useState('');
  const [showAllTeachersInInter, setShowAllTeachersInInter] = useState(false);
  const [allAlumnosList, setAllAlumnosList] = useState([]);

  const getCycleSafeStr = () => {
    const cycle = getSchoolCycle();
    return typeof cycle === 'string' ? cycle : '';
  };

  const isIntersemestral = getCycleSafeStr().toUpperCase().includes("INTER");


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

  // Load intersemestral classes
  const loadIntersemestralData = async () => {
    if (!isIntersemestral) return;
    setLoadingInterData(true);
    try {
      const classes = await api.getIntersemestralClasses();
      setInterClasses(classes);
      
      if (classes.length > 0) {
        setSelectedInterClassId(prev => {
          if (prev && classes.some(c => c.id === prev)) return prev;
          return classes[0].id;
        });
      } else {
        setSelectedInterClassId(null);
      }
    } catch (err) {
      console.error("Error loading intersemestral classes:", err);
    } finally {
      setLoadingInterData(false);
    }
  };

  const refreshDashboardData = async () => {
    try {
      const summaryData = await api.getAdminSummary();
      setAdminData(summaryData);
      if (adminSelectedTeacherId) {
        const details = await api.getTeacherOverview(null, adminSelectedTeacherId);
        setAdminTeacherDetail(details);
      }
    } catch (err) {
      console.error("Error refreshing dashboard data:", err);
    }
  };

  // Load classes on cycle/tab change
  useEffect(() => {
    if (isIntersemestral && activeTab === 'resumen') {
      loadIntersemestralData();
      
      // Load all students for the search autocomplete
      api.getAlumnosOverview()
        .then(data => {
          const list = Array.isArray(data) ? data : (data.alumnos || []);
          setAllAlumnosList(list);
        })
        .catch(err => console.error("Error loading all alumnos:", err));
    }
  }, [isIntersemestral, activeTab]);

  // Load students for selected class
  useEffect(() => {
    if (isIntersemestral && selectedInterClassId) {
      api.getIntersemestralStudents(selectedInterClassId)
        .then(data => setInterStudents(data))
        .catch(err => console.error("Error loading class students:", err));
    } else {
      setInterStudents([]);
    }
  }, [selectedInterClassId, isIntersemestral]);

  // Client-side search autocomplete filter
  useEffect(() => {
    if (studentSearchQuery.trim().length > 1) {
      const q = studentSearchQuery.toLowerCase();
      const filtered = allAlumnosList.filter(a => 
        (a.name || '').toLowerCase().includes(q) || 
        (a.email || '').toLowerCase().includes(q) || 
        (a.matricula || '').toLowerCase().includes(q)
      );
      setStudentSearchResults(filtered.slice(0, 5));
    } else {
      setStudentSearchResults([]);
    }
  }, [studentSearchQuery, allAlumnosList]);


  // Enroll student
  const handleEnrollStudent = async (alumno) => {
    if (!selectedInterClassId) return;
    
    const isEnrolled = interStudents.some(s => s.id === alumno.id);
    if (isEnrolled) {
      alert("El alumno ya está inscrito en esta materia.");
      return;
    }

    const currentClass = interClasses.find(c => c.id === selectedInterClassId);
    if (currentClass && currentClass.alumnos_inscritos >= currentClass.grupo_cupo) {
      alert(`No se puede inscribir: Cupo límite de ${currentClass.grupo_cupo} alcanzado.`);
      return;
    }

    try {
      await api.enrollStudentIntersemestral(alumno.id, selectedInterClassId);
      setStudentSearchQuery('');
      setStudentSearchResults([]);
      await loadIntersemestralData();
    } catch (err) {
      alert(err.message || 'Error al inscribir al alumno');
    }
  };

  // Deregister student
  const handleDeregisterStudent = async (alumnoId) => {
    if (!selectedInterClassId) return;
    if (!window.confirm("¿Estás seguro de que deseas desvincular a este alumno de la materia?")) return;

    try {
      await api.deregisterStudentIntersemestral(alumnoId, selectedInterClassId);
      await loadIntersemestralData();
      await refreshDashboardData();
    } catch (err) {
      alert(err.message || 'Error al desvincular al alumno');
    }
  };

  // Save capacity
  const handleSaveCupo = async (classId) => {
    if (editingCupoValue === undefined || editingCupoValue < 1) {
      alert("El cupo mínimo es 1.");
      return;
    }
    
    try {
      await api.updateIntersemestralCupo(classId, editingCupoValue);
      setEditingCupoId(null);
      await loadIntersemestralData();
      await refreshDashboardData();
    } catch (err) {
      alert(err.message || 'Error al actualizar cupo');
    }
  };

  // Save schedule (horario)
  const handleSaveHorario = async (classId) => {
    if (!editingHorarioValue || !editingHorarioValue.trim()) {
      alert("Por favor introduce un horario válido.");
      return;
    }
    
    try {
      await api.updateAssignment(classId, editingHorarioValue);
      setEditingHorarioId(null);
      await loadIntersemestralData();
      await refreshDashboardData();
    } catch (err) {
      alert(err.message || 'Error al actualizar el horario');
    }
  };

  // Delete intersemestral class
  const handleDeleteInterClass = async (classId, materiaNombre) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la materia "${materiaNombre}" de este periodo intersemestral? Esto eliminará también todas las inscripciones asociadas.`)) {
      return;
    }
    try {
      await api.deleteAssignment(classId);
      await loadIntersemestralData();
      await refreshDashboardData();
      if (selectedInterClassId === classId) {
        setSelectedInterClassId(null);
      }
    } catch (err) {
      alert(err.message || 'Error al eliminar la materia');
    }
  };

  // Clear all intersemestral classes
  const handleClearAllInterClasses = async () => {
    if (!window.confirm("¡ATENCIÓN! Estás a punto de eliminar TODOS los horarios, materias y asignaciones cargadas en este ciclo de golpe. Esto también eliminará a todos los alumnos inscritos de sus clases correspondientes. ¿Deseas continuar?")) {
      return;
    }
    
    try {
      await api.clearIntersemestralClasses();
      setSelectedInterClassId(null);
      await loadIntersemestralData();
      await refreshDashboardData();
      alert("Se han eliminado todos los horarios y asignaciones del ciclo escolar activo con éxito.");
    } catch (err) {
      alert(err.message || 'Error al vaciar materias del periodo activo');
    }
  };

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

  const handleImportHorarios = async (e) => {
    e.preventDefault();
    if (!importFile) {
      setImportError('Por favor selecciona un archivo Excel');
      return;
    }
    if (!selectedImportPeriodoId) {
      setImportError('Por favor selecciona el ciclo escolar destino');
      return;
    }

    setImportingExcel(true);
    setImportError('');
    setImportSuccess(false);
    setImportStats(null);

    try {
      const result = await api.importAssignments(importFile, selectedImportPeriodoId);
      setImportSuccess(true);
      setImportStats(result.stats);
      setImportFile(null);
      
      const fileInput = document.getElementById('excel-file-input-modal');
      if (fileInput) fileInput.value = '';

      const data = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
      setAdminData(data);
    } catch (err) {
      setImportError(err.message || 'Error al procesar la importación');
    } finally {
      setImportingExcel(false);
    }
  };

  const toggleSemesterExpand = (semesterName) => {
    setExpandedSemesters(prev => ({
      ...prev,
      [semesterName]: !prev[semesterName]
    }));
  };

  const getMascotMessage = () => {
    if (adminData?.kpis) {
      return `¡Hola, Administrador! El promedio general escolar es de ${adminData.kpis.avgAttendance}. Monitorea las alertas para prevenir la deserción escolar. 🦏📊`;
    }
    return `¡Hola! Bienvenido al portal escolar de RinoAsist. 🦏`;
  };

  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState('');

  const semesterLabel = (label) => label.replace(/\s+/g, '_').replace(/[()]/g, '');

  const renderCSSChartHTML = (dailyData, chartTitle) => {
    if (!dailyData || dailyData.length === 0) return '';
    return `
      <div style="margin: 15px 0 25px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; page-break-inside: avoid; font-family: 'Outfit', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
        <div style="font-size: 13px; font-weight: 700; color: #0052cc; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${chartTitle}</div>
        <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 120px; border-left: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; padding-left: 10px; padding-bottom: 8px; margin-bottom: 8px;">
          ${dailyData.map(d => {
            const val = d.Asistencia;
            const dayLabel = d.day;
            const barColor = val >= 85 ? 'linear-gradient(to top, #16a34a, #4ade80)' : val >= 80 ? 'linear-gradient(to top, #d97706, #fbbf24)' : 'linear-gradient(to top, #dc2626, #fca5a5)';
            return `
              <div style="display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%;">
                <div style="display: flex; align-items: flex-end; justify-content: center; height: 100%; width: 100%;">
                  <div style="width: 32px; height: ${val}%; background: ${barColor} !important; background-image: ${barColor} !important; border-radius: 3px 3px 0 0; display: flex; align-items: flex-start; justify-content: center; position: relative; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                    <span style="font-size: 9px; font-weight: 700; color: #ffffff; margin-top: 3px; font-family: sans-serif;">${val}%</span>
                  </div>
                </div>
                <div style="font-size: 11px; color: #475569; font-weight: 600; margin-top: 6px;">${dayLabel}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const renderCSSSubjectChartHTML = (subjects, chartTitle = "Desglose de Asistencia por Materia") => {
    if (!subjects || subjects.length === 0) return '';
    return `
      <div style="margin: 15px 0 25px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; page-break-inside: avoid; font-family: 'Outfit', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
        <div style="font-size: 13px; font-weight: 700; color: #0052cc; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${chartTitle}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${subjects.map(sub => {
            const val = sub.attendanceRate;
            const barColor = val >= 85 ? '#16a34a' : val >= 80 ? '#d97706' : '#dc2626';
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
                <span style="font-weight: 600; color: #475569; width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sub.name}</span>
                <div style="flex-grow: 1; height: 10px; background-color: #e2e8f0; border-radius: 5px; margin: 0 15px; overflow: hidden; position: relative;">
                  <div style="width: ${val}%; height: 100%; background-color: ${barColor} !important; border-radius: 5px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;"></div>
                </div>
                <span style="font-weight: bold; color: #0052cc; width: 45px; text-align: right;">${val}%</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const handleExportPDF = () => {
    setExportingPDF(true);
    setTimeout(() => {
      setExportingPDF(false);
      const weekLabel = adminData.weeks?.find(w => w.id === selectedWeek)?.label || 'Semana';
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Reporte de Asistencia General - ${weekLabel}</title>
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
              .title { font-size: 24px; font-weight: 800; color: #0052cc; letter-spacing: -0.5px; }
              .subtitle { font-size: 13px; color: #64748b; margin-top: 5px; font-weight: 500; }
              .watermark { height: 55px; opacity: 0.95; object-fit: contain; margin-left: 20px; }
              .kpi-container { display: flex; gap: 20px; margin-bottom: 30px; }
              .kpi-card { flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; }
              .kpi-val { font-size: 20px; font-weight: 800; color: #0052cc; }
              .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
              .section-title { font-size: 16px; font-weight: 700; margin-top: 35px; margin-bottom: 15px; color: #0052cc; border-left: 4px solid #0052cc; padding-left: 10px; text-transform: uppercase; page-break-after: avoid; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: avoid; }
              th { background-color: #0052cc; color: white; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
              td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #334155; }
              tr:nth-child(even) td { background-color: #f8fafc; }
              .status-badge { display: inline-block; padding: 3px 8px; font-size: 10px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; }
              .status-good { background-color: #dcfce7; color: #15803d; }
              .status-bad { background-color: #fee2e2; color: #b91c1c; }
              .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-weight: 500; }
              .semester-block { page-break-inside: avoid; margin-bottom: 40px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title-area">
                <div class="title">REPORTE INSTITUCIONAL DE ASISTENCIA (ISC)</div>
                <div class="subtitle">Semana de consulta: <strong>${weekLabel}</strong> | Generado: ${new Date().toLocaleString()}</div>
              </div>
              <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" class="watermark" />
            </div>
            
            <div class="kpi-container">
              <div class="kpi-card">
                <div class="kpi-val">${adminData.kpis?.avgAttendance || '85%'}</div>
                <div class="kpi-label">Promedio de Asistencia</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val">${adminData.kpis?.atRisk || '0'}</div>
                <div class="kpi-label">Grupos en Riesgo (<80%)</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val">80%</div>
                <div class="kpi-label">Meta Mínima Institucional</div>
              </div>
            </div>
            
            ${Object.keys(adminData.semesterDetailedData || {}).map(sem => {
              const semData = adminData.semesterDetailedData[sem];
              return `
                <div class="semester-block">
                  <div class="section-title">${sem} Semestre (Promedio General: ${semData.average}%)</div>
                  
                  ${renderCSSChartHTML(semData.generalDaily, `TENDENCIA DIARIA DE ASISTENCIA - ${sem.toUpperCase()} SEMESTRE`)}
                  
                  <table>
                    <thead>
                      <tr>
                        <th>Grupo</th>
                        <th>Asistencia Promedio Semanal</th>
                        <th>Estado de Meta (80%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${semData.groups.map(g => {
                        const statusClass = g.average >= 80 ? 'status-good' : 'status-bad';
                        const statusText = g.average >= 80 ? 'Cumple' : 'Alerta';
                        return `
                          <tr>
                            <td><strong>${g.name}</strong></td>
                            <td>${g.average}%</td>
                            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                  
                  ${renderCSSSubjectChartHTML(semData.subjects || [], `RENDIMIENTO DE MATERIAS - ${sem.toUpperCase()} SEMESTRE`)}
                </div>
              `;
            }).join('')}
            
            <div class="footer">RinoAsist - Portal Escolar Oficial de Monitoreo de Asistencias de Ingeniería en Sistemas Computacionales</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      setExportSuccessMessage('¡Reporte PDF institucional con gráficas generado!');
      setTimeout(() => setExportSuccessMessage(''), 4000);
    }, 1200);
  };

  const handleExportExcel = () => {
    setExportingExcel(true);
    setTimeout(() => {
      setExportingExcel(false);
      const weekLabel = adminData.weeks?.find(w => w.id === selectedWeek)?.label || 'Semana';
      
      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Resumen General</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; }
            th { background-color: #0052cc; color: #ffffff; font-family: Arial, sans-serif; font-size: 11pt; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; padding: 8px; }
            td { font-family: Arial, sans-serif; font-size: 10pt; border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            .title-row { font-size: 14pt; font-weight: bold; color: #0052cc; font-family: Arial, sans-serif; }
            .meta-row { font-size: 9pt; color: #64748b; font-style: italic; font-family: Arial, sans-serif; }
            .section-row { background-color: #e2e8f0; font-weight: bold; font-size: 11pt; color: #0f172a; }
            .val-good { color: #15803d; font-weight: bold; background-color: #dcfce7; text-align: right; }
            .val-warning { color: #b45309; font-weight: bold; background-color: #fef3c7; text-align: right; }
            .val-danger { color: #b91c1c; font-weight: bold; background-color: #fee2e2; text-align: right; }
            .bar-cell { font-family: 'Courier New', monospace; letter-spacing: -1px; text-align: left; font-weight: bold; color: #0052cc; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="10" class="title-row" style="border: none;">REPORTE INSTITUCIONAL DE ASISTENCIA - INGENIERÍA EN SISTEMAS COMPUTACIONALES</td>
            </tr>
            <tr>
              <td colspan="10" class="meta-row" style="border: none;">Semana de consulta: ${weekLabel} | Generado: ${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="10" style="border: none;"><strong>Meta Mínima Requerida:</strong> 80% de asistencia.</td>
            </tr>
            <tr><td colspan="10" style="border: none;"></td></tr>
            
            <thead>
              <tr>
                <th>Semestre</th>
                <th>Grupo / Detalle</th>
                <th>Asistencia Promedio</th>
                <th>Estado Meta</th>
                <th>Gráfico de Barras</th>
                <th>Lunes</th>
                <th>Martes</th>
                <th>Miércoles</th>
                <th>Jueves</th>
                <th>Viernes</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      Object.keys(adminData.semesterDetailedData || {}).forEach(sem => {
        const semData = adminData.semesterDetailedData[sem];
        const semAvg = semData.average;
        const semClass = semAvg >= 85 ? 'val-good' : semAvg >= 80 ? 'val-warning' : 'val-danger';
        const semStatus = semAvg >= 80 ? 'CUMPLE' : 'ALERTA';
        const semBar = '■'.repeat(Math.round(semAvg / 10)) + '□'.repeat(10 - Math.round(semAvg / 10));
        
        const dailyVals = {};
        semData.generalDaily.forEach(d => {
          dailyVals[d.day] = d.Asistencia;
        });
        
        htmlContent += `
          <tr class="section-row">
            <td>${sem}</td>
            <td>Consolidado Semestral</td>
            <td class="${semClass}">${semAvg}%</td>
            <td>${semStatus}</td>
            <td class="bar-cell">${semBar}</td>
            <td style="text-align: right;">${dailyVals['Lun'] || 0}%</td>
            <td style="text-align: right;">${dailyVals['Mar'] || 0}%</td>
            <td style="text-align: right;">${dailyVals['Mie'] || 0}%</td>
            <td style="text-align: right;">${dailyVals['Jue'] || 0}%</td>
            <td style="text-align: right;">${dailyVals['Vie'] || 0}%</td>
          </tr>
        `;

        if (semData.subjects) {
          semData.subjects.forEach(sub => {
            const subAvg = sub.attendanceRate;
            const subClass = subAvg >= 85 ? 'val-good' : subAvg >= 80 ? 'val-warning' : 'val-danger';
            const subBar = '■'.repeat(Math.round(subAvg / 10)) + '□'.repeat(10 - Math.round(subAvg / 10));
            htmlContent += `
              <tr>
                <td style="color: #64748b; font-style: italic; padding-left: 15px;">— ${sem}</td>
                <td style="color: #334155; font-weight: bold; padding-left: 10px;">Consolidado: ${sub.name}</td>
                <td class="${subClass}">${subAvg}%</td>
                <td></td>
                <td class="bar-cell" style="color: #475569;">${subBar}</td>
                <td colspan="5" style="background-color: #f1f5f9; color: #64748b; text-align: center; font-size: 8pt; font-style: italic;">Promedio Semestral Materia</td>
              </tr>
            `;
          });
        }
        
        semData.groups.forEach(g => {
          const gAvg = g.average;
          const gClass = gAvg >= 85 ? 'val-good' : gAvg >= 80 ? 'val-warning' : 'val-danger';
          const gStatus = gAvg >= 80 ? 'CUMPLE' : 'ALERTA';
          const gBar = '■'.repeat(Math.round(gAvg / 10)) + '□'.repeat(10 - Math.round(gAvg / 10));
          
          const gDailyVals = {};
          g.daily.forEach(d => {
            gDailyVals[d.day] = d.Asistencia;
          });
          
          htmlContent += `
            <tr>
              <td style="color: #64748b; font-style: italic; padding-left: 15px;">— ${sem}</td>
              <td><strong>${g.name}</strong></td>
              <td class="${gClass}">${gAvg}%</td>
              <td>${gStatus}</td>
              <td class="bar-cell">${gBar}</td>
              <td style="text-align: right;">${gDailyVals['Lun'] || 0}%</td>
              <td style="text-align: right;">${gDailyVals['Mar'] || 0}%</td>
              <td style="text-align: right;">${gDailyVals['Mie'] || 0}%</td>
              <td style="text-align: right;">${gDailyVals['Jue'] || 0}%</td>
              <td style="text-align: right;">${gDailyVals['Vie'] || 0}%</td>
            </tr>
          `;

          if (g.subjects) {
            g.subjects.forEach(sub => {
              const subAvg = sub.attendanceRate;
              const subClass = subAvg >= 85 ? 'val-good' : subAvg >= 80 ? 'val-warning' : 'val-danger';
              const subBar = '■'.repeat(Math.round(subAvg / 10)) + '□'.repeat(10 - Math.round(subAvg / 10));
              htmlContent += `
                <tr>
                  <td style="color: #94a3b8; font-style: italic; padding-left: 25px;">— — ${sem}</td>
                  <td style="color: #475569; padding-left: 20px;">${sub.name}</td>
                  <td class="${subClass}">${subAvg}%</td>
                  <td></td>
                  <td class="bar-cell" style="color: #64748b;">${subBar}</td>
                  <td colspan="5" style="background-color: #f8fafc; color: #94a3b8; text-align: center; font-size: 8pt; font-style: italic;">Detalle por Asignatura</td>
                </tr>
              `;
            });
          }
        });
      });
      
      htmlContent += `
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Reporte_Asistencia_Estilizado_${semesterLabel(weekLabel)}.xls`;
      link.click();
      
      setExportSuccessMessage('¡Reporte Excel estilizado (.xls) descargado!');
      setTimeout(() => setExportSuccessMessage(''), 4000);
    }, 1200);
  };

  const handleExportSemester = (semesterName, format = 'pdf') => {
    const semInfo = adminData.semesterDetailedData[semesterName];
    const weekLabel = adminData.weeks?.find(w => w.id === selectedWeek)?.label || 'Semana';
    
    if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Reporte de Asistencia - ${semesterName} Semestre</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body { font-family: 'Outfit', sans-serif; color: #0f172a; margin: 40px; }
              .header { border-bottom: 2px solid #0052cc; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
              .title-area { flex-grow: 1; }
              .title { font-size: 22px; font-weight: bold; color: #0052cc; }
              .subtitle { font-size: 13px; color: #64748b; margin-top: 5px; }
              .watermark { height: 55px; opacity: 0.95; object-fit: contain; margin-left: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; page-break-inside: avoid; }
              th { background-color: #0052cc; color: white; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; }
              td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
              tr:nth-child(even) td { background-color: #f8fafc; }
              .status-badge { display: inline-block; padding: 3px 8px; font-size: 10px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; }
              .status-good { background-color: #dcfce7; color: #15803d; }
              .status-bad { background-color: #fee2e2; color: #b91c1c; }
              .groups-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; page-break-inside: avoid; }
              .group-chart-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #ffffff; }
              .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title-area">
                <div class="title">REPORTE DE ASISTENCIA - ${semesterName.toUpperCase()} SEMESTRE</div>
                <div class="subtitle">Filtro: <strong>${weekLabel}</strong> | Promedio General Semestre: <strong>${semInfo.average}%</strong> | Generado: ${new Date().toLocaleString()}</div>
              </div>
              <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" class="watermark" />
            </div>
            
            ${renderCSSChartHTML(semInfo.generalDaily, `TENDENCIA GENERAL CONSOLIDADA - ${semesterName.toUpperCase()} SEMESTRE`)}
            
            <table>
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Asistencia Promedio Semanal</th>
                  <th>Estado de Meta (80%)</th>
                </tr>
              </thead>
              <tbody>
                ${semInfo.groups.map(g => {
                  const statusClass = g.average >= 80 ? 'status-good' : 'status-bad';
                  const statusText = g.average >= 80 ? 'Cumple' : 'Alerta';
                  return `
                    <tr>
                      <td><strong>${g.name}</strong></td>
                      <td>${g.average}%</td>
                      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            ${renderCSSSubjectChartHTML(semInfo.subjects || [], `RENDIMIENTO CONSOLIDADO DE MATERIAS - ${semesterName.toUpperCase()} SEMESTRE`)}

            <div style="font-size: 14px; font-weight: 700; color: #0052cc; margin-top: 30px; border-left: 3px solid #0052cc; padding-left: 8px; text-transform: uppercase;">Detalle de Asistencia Diaria y Materias por Grupo</div>
            <div class="groups-grid">
              ${semInfo.groups.map(g => `
                <div class="group-chart-card">
                  <div style="font-weight: bold; font-size: 13px; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between;">
                    <span>${g.name}</span>
                    <span style="color: #0052cc;">Promedio: ${g.average}%</span>
                  </div>
                  ${renderCSSChartHTML(g.daily, `Frecuencia Diaria`)}
                  
                  <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 0.3px;">Asistencia por Materia</div>
                    <table style="width: 100%; border: none; margin: 0; page-break-inside: avoid;">
                      <tbody>
                        ${g.subjects.map(sub => {
                          const rateColor = sub.attendanceRate < 80 ? '#b91c1c' : sub.attendanceRate < 85 ? '#b45309' : '#15803d';
                          return `
                            <tr>
                              <td style="padding: 2px 0; font-size: 10px; border: none; background: transparent !important; color: #475569; text-align: left;">${sub.name}</td>
                              <td style="padding: 2px 0; font-size: 10px; border: none; background: transparent !important; text-align: right; font-weight: bold; color: ${rateColor};">${sub.attendanceRate}%</td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <div class="footer">RinoAsist - Sistema de Control de Asistencias Oficial</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${semesterLabel(semesterName)}</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; }
            th { background-color: #0052cc; color: #ffffff; font-family: Arial, sans-serif; font-size: 11pt; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; padding: 8px; }
            td { font-family: Arial, sans-serif; font-size: 10pt; border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            .title-row { font-size: 14pt; font-weight: bold; color: #0052cc; font-family: Arial, sans-serif; }
            .meta-row { font-size: 9pt; color: #64748b; font-style: italic; font-family: Arial, sans-serif; }
            .val-good { color: #15803d; font-weight: bold; background-color: #dcfce7; text-align: right; }
            .val-warning { color: #b45309; font-weight: bold; background-color: #fef3c7; text-align: right; }
            .val-danger { color: #b91c1c; font-weight: bold; background-color: #fee2e2; text-align: right; }
            .bar-cell { font-family: 'Courier New', monospace; letter-spacing: -1px; text-align: left; font-weight: bold; color: #0052cc; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="9" class="title-row" style="border: none;">REPORTE DE ASISTENCIA DETALLADO - ${semesterName.toUpperCase()} SEMESTRE</td>
            </tr>
            <tr>
              <td colspan="9" class="meta-row" style="border: none;">Filtro: ${weekLabel} | Promedio General del Semestre: ${semInfo.average}% | Generado: ${new Date().toLocaleString()}</td>
            </tr>
            <tr><td colspan="9" style="border: none;"></td></tr>
            
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Asistencia Promedio</th>
                <th>Estado Meta (80%)</th>
                <th>Gráfico de Barras</th>
                <th>Lunes</th>
                <th>Martes</th>
                <th>Miércoles</th>
                <th>Jueves</th>
                <th>Viernes</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      semInfo.groups.forEach(g => {
        const gAvg = g.average;
        const gClass = gAvg >= 85 ? 'val-good' : gAvg >= 80 ? 'val-warning' : 'val-danger';
        const gStatus = gAvg >= 80 ? 'CUMPLE' : 'ALERTA';
        const gBar = '■'.repeat(Math.round(gAvg / 10)) + '□'.repeat(10 - Math.round(gAvg / 10));
        
        const gDailyVals = {};
        g.daily.forEach(d => {
          gDailyVals[d.day] = d.Asistencia;
        });
        
        htmlContent += `
          <tr>
            <td><strong>${g.name}</strong></td>
            <td class="${gClass}">${gAvg}%</td>
            <td>${gStatus}</td>
            <td class="bar-cell">${gBar}</td>
            <td style="text-align: right;">${gDailyVals['Lun'] || 0}%</td>
            <td style="text-align: right;">${gDailyVals['Mar'] || 0}%</td>
            <td style="text-align: right;">${gDailyVals['Mie'] || 0}%</td>
            <td style="text-align: right;">${gDailyVals['Jue'] || 0}%</td>
            <td style="text-align: right;">${gDailyVals['Vie'] || 0}%</td>
          </tr>
        `;

        if (g.subjects) {
          g.subjects.forEach(sub => {
            const subAvg = sub.attendanceRate;
            const subClass = subAvg >= 85 ? 'val-good' : subAvg >= 80 ? 'val-warning' : 'val-danger';
            const subBar = '■'.repeat(Math.round(subAvg / 10)) + '□'.repeat(10 - Math.round(subAvg / 10));
            htmlContent += `
              <tr>
                <td style="color: #64748b; padding-left: 15px; font-style: italic;">— ${sub.name}</td>
                <td class="${subClass}">${subAvg}%</td>
                <td></td>
                <td class="bar-cell" style="color: #64748b;">${subBar}</td>
                <td colspan="5" style="background-color: #f8fafc; color: #94a3b8; text-align: center; font-size: 8pt; font-style: italic;">Asignatura del Grupo</td>
              </tr>
            `;
          });
        }
      });
      
      if (semInfo.subjects) {
        htmlContent += `
              <tr><td colspan="9" style="border: none;"></td></tr>
              <tr style="background-color: #e2e8f0;">
                <td colspan="9" style="font-weight: bold; font-size: 11pt; color: #0052cc; padding: 8px; border: 1px solid #cbd5e1;">RENDIMIENTO CONSOLIDADO POR MATERIA - ${semesterName.toUpperCase()} SEMESTRE</td>
              </tr>
              <tr style="background-color: #0052cc;">
                <th colspan="3" style="color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">Materia</th>
                <th style="color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">Asistencia Promedio</th>
                <th style="color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">Estado Meta (80%)</th>
                <th colspan="4" style="color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">Gráfico de Barras</th>
              </tr>
        `;
        
        semInfo.subjects.forEach(sub => {
          const subAvg = sub.attendanceRate;
          const subClass = subAvg >= 85 ? 'val-good' : subAvg >= 80 ? 'val-warning' : 'val-danger';
          const subStatus = subAvg >= 80 ? 'CUMPLE' : 'ALERTA';
          const subBar = '■'.repeat(Math.round(subAvg / 10)) + '□'.repeat(10 - Math.round(subAvg / 10));
          
          htmlContent += `
            <tr>
              <td colspan="3"><strong>${sub.name}</strong></td>
              <td class="${subClass}">${subAvg}%</td>
              <td>${subStatus}</td>
              <td colspan="4" class="bar-cell">${subBar}</td>
            </tr>
          `;
        });
      }
      
      htmlContent += `
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Reporte_Asistencia_${semesterLabel(semesterName)}_${semesterLabel(weekLabel)}.xls`;
      link.click();
    }
    
    setExportSuccessMessage(`¡Reporte de ${semesterName} Semestre exportado con éxito!`);
    setTimeout(() => setExportSuccessMessage(''), 4000);
  };

  const handleExportGroup = (semesterName, group, format = 'pdf') => {
    const weekLabel = adminData.weeks?.find(w => w.id === selectedWeek)?.label || 'Semana';
    
    if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Ficha de Asistencia - ${group.name}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body { font-family: 'Outfit', sans-serif; color: #0f172a; margin: 40px; }
              .header { border-bottom: 2px solid #0052cc; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
              .title-area { flex-grow: 1; }
              .title { font-size: 20px; font-weight: bold; color: #0052cc; }
              .subtitle { font-size: 13px; color: #64748b; margin-top: 5px; }
              .watermark { height: 55px; opacity: 0.95; object-fit: contain; margin-left: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background-color: #0052cc; color: white; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; }
              td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
              tr:nth-child(even) td { background-color: #f8fafc; }
              .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title-area">
                <div class="title">FICHA DE CONTROL DE ASISTENCIA DIARIA - ${group.name.toUpperCase()}</div>
                <div class="subtitle">Semestre: <strong>${semesterName}</strong> | Semana de consulta: <strong>${weekLabel}</strong> | Asistencia Promedio Semanal: <strong>${group.average}%</strong> | Generado: ${new Date().toLocaleString()}</div>
              </div>
              <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" class="watermark" />
            </div>
            
            ${renderCSSChartHTML(group.daily, `TENDENCIA DE ASISTENCIA DIARIA - ${group.name.toUpperCase()}`)}
            
            <table>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Tasa de Asistencia</th>
                  <th>Estado Meta (80%)</th>
                </tr>
              </thead>
              <tbody>
                ${group.daily.map(d => {
                  const statusText = d.Asistencia >= 80 ? 'CUMPLE' : 'ALERTA';
                  const statusStyle = d.Asistencia >= 80 ? 'color: #15803d; font-weight: bold;' : 'color: #b91c1c; font-weight: bold;';
                  return `
                    <tr>
                      <td><strong>${d.day}</strong></td>
                      <td>${d.Asistencia}%</td>
                      <td style="${statusStyle}">${statusText}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            ${renderCSSSubjectChartHTML(group.subjects || [], `ASISTENCIA POR MATERIA - ${group.name.toUpperCase()}`)}
            
            <div class="footer">RinoAsist - Sistema de Control de Asistencias Oficial</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${semesterLabel(group.name)}</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; }
            th { background-color: #0052cc; color: #ffffff; font-family: Arial, sans-serif; font-size: 11pt; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; padding: 8px; }
            td { font-family: Arial, sans-serif; font-size: 10pt; border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            .title-row { font-size: 14pt; font-weight: bold; color: #0052cc; font-family: Arial, sans-serif; }
            .meta-row { font-size: 9pt; color: #64748b; font-style: italic; font-family: Arial, sans-serif; }
            .val-good { color: #15803d; font-weight: bold; background-color: #dcfce7; text-align: right; }
            .val-warning { color: #b45309; font-weight: bold; background-color: #fef3c7; text-align: right; }
            .val-danger { color: #b91c1c; font-weight: bold; background-color: #fee2e2; text-align: right; }
            .bar-cell { font-family: 'Courier New', monospace; letter-spacing: -1px; text-align: left; font-weight: bold; color: #0052cc; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="4" class="title-row" style="border: none;">FICHA DE ASISTENCIA DIARIA - ${group.name.toUpperCase()}</td>
            </tr>
            <tr>
              <td colspan="4" class="meta-row" style="border: none;">Semestre: ${semesterName} | Filtro: ${weekLabel} | Asistencia Promedio: ${group.average}% | Generado: ${new Date().toLocaleString()}</td>
            </tr>
            <tr><td colspan="4" style="border: none;"></td></tr>
            
            <thead>
              <tr>
                <th>Día</th>
                <th>Asistencia</th>
                <th>Estado Meta (80%)</th>
                <th>Gráfico de Barras</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      group.daily.forEach(d => {
        const val = d.Asistencia;
        const dClass = val >= 85 ? 'val-good' : val >= 80 ? 'val-warning' : 'val-danger';
        const dStatus = val >= 80 ? 'CUMPLE' : 'ALERTA';
        const dBar = '■'.repeat(Math.round(val / 10)) + '□'.repeat(10 - Math.round(val / 10));
        
        htmlContent += `
          <tr>
            <td><strong>${d.day}</strong></td>
            <td class="${dClass}">${val}%</td>
            <td>${dStatus}</td>
            <td class="bar-cell">${dBar}</td>
          </tr>
        `;
      });
      
      if (group.subjects) {
        htmlContent += `
              <tr><td colspan="4" style="border: none;"></td></tr>
              <tr style="background-color: #e2e8f0;">
                <td colspan="4" style="font-weight: bold; font-size: 11pt; color: #0052cc; padding: 8px; border: 1px solid #cbd5e1;">RENDIMIENTO POR ASIGNATURA - ${group.name.toUpperCase()}</td>
              </tr>
              <tr style="background-color: #0052cc;">
                <th colspan="2" style="color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">Asignatura</th>
                <th style="color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">Asistencia</th>
                <th style="color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px;">Gráfico de Barras</th>
              </tr>
        `;
        
        group.subjects.forEach(sub => {
          const val = sub.attendanceRate;
          const dClass = val >= 85 ? 'val-good' : val >= 80 ? 'val-warning' : 'val-danger';
          const dBar = '■'.repeat(Math.round(val / 10)) + '□'.repeat(10 - Math.round(val / 10));
          
          htmlContent += `
            <tr>
              <td colspan="2"><strong>${sub.name}</strong></td>
              <td class="${dClass}">${val}%</td>
              <td class="bar-cell">${dBar}</td>
            </tr>
          `;
        });
      }
      
      htmlContent += `
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Ficha_Asistencia_${semesterLabel(group.name)}_${semesterLabel(weekLabel)}.xls`;
      link.click();
    }
    
    setExportSuccessMessage(`¡Reporte del ${group.name} exportado con éxito!`);
    setTimeout(() => setExportSuccessMessage(''), 4000);
  };

  const [adminData, setAdminData] = useState(null);
  const [assignmentOptions, setAssignmentOptions] = useState({ docentes: [], materias: [], grupos: [] });
  const [loadingAssignmentOptions, setLoadingAssignmentOptions] = useState(false);

  const [adminSearch, setAdminSearch] = useState('');
  const [adminShift, setAdminShift] = useState('all');
  const [adminSelectedTeacherId, setAdminSelectedTeacherId] = useState(null);
  const [adminTeacherDetail, setAdminTeacherDetail] = useState(null);
  const [loadingTeacherDetail, setLoadingTeacherDetail] = useState(false);

  const displayedDocentes = useMemo(() => {
    if (!adminData?.docentes) return [];
    if (!isIntersemestral || showAllTeachersInInter) return adminData.docentes;
    const activeTeacherIds = new Set(interClasses.map(c => c.docente_id));
    return adminData.docentes.filter(d => activeTeacherIds.has(d.docente_id));
  }, [adminData?.docentes, isIntersemestral, interClasses, showAllTeachersInInter]);

  // Adjust selected teacher based on filtered list in Intersemestral
  useEffect(() => {
    if (isIntersemestral && displayedDocentes.length > 0) {
      const isSelectedValid = displayedDocentes.some(d => d.docente_id === adminSelectedTeacherId);
      if (!isSelectedValid) {
        setAdminSelectedTeacherId(displayedDocentes[0].docente_id);
      }
    }
  }, [displayedDocentes, adminSelectedTeacherId, isIntersemestral]);

  const [showRiskModal, setShowRiskModal] = useState(false);
  const [reminderToast, setReminderToast] = useState({ show: false, teacherName: '' });
  const [showEditTeacherModal, setShowEditTeacherModal] = useState(false);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherShift, setEditTeacherShift] = useState('Matutino');
  const [savingEditTeacher, setSavingEditTeacher] = useState(false);

  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editStudentId, setEditStudentId] = useState(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentEmail, setEditStudentEmail] = useState('');
  const [editStudentMatricula, setEditStudentMatricula] = useState('');
  const [editStudentGroupId, setEditStudentGroupId] = useState('');
  const [savingEditStudent, setSavingEditStudent] = useState(false);
  const [editStudentError, setEditStudentError] = useState('');

  const [showCreateTeacherModal, setShowCreateTeacherModal] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherShift, setNewTeacherShift] = useState('Matutino');
  const [savingNewTeacher, setSavingNewTeacher] = useState(false);

  const [showAssignClassModal, setShowAssignClassModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedGroupIdForClass, setSelectedGroupIdForClass] = useState('');
  const [assignedClassSchedule, setAssignedClassSchedule] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [showInviteStudentModal, setShowInviteStudentModal] = useState(false);
  const [inviteStudentEmail, setInviteStudentEmail] = useState('');
  const [selectedGroupIdForInvite, setSelectedGroupIdForInvite] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteGroupSemesterFilter, setInviteGroupSemesterFilter] = useState('all');
  const [inviteGroupShiftFilter, setInviteGroupShiftFilter] = useState('all');

  const [alumnosData, setAlumnosData] = useState({ alumnos: [], invitaciones: [] });
  const [loadingAlumnosData, setLoadingAlumnosData] = useState(false);
  const [alumnosSearchQuery, setAlumnosSearchQuery] = useState('');
  const [invitationsSearchQuery, setInvitationsSearchQuery] = useState('');
  const [alumnosSemesterFilter, setAlumnosSemesterFilter] = useState('all');
  const [alumnosGroupFilter, setAlumnosGroupFilter] = useState('all');
  const [invitationsGroupFilter, setInvitationsGroupFilter] = useState('all');
  const [invitationsStatusFilter, setInvitationsStatusFilter] = useState('all');

  const [alumnosSubTab, setAlumnosSubTab] = useState('invitaciones');
  const [selectedGroupIdForMateria, setSelectedGroupIdForMateria] = useState('');
  const [selectedMateriaIdForGroup, setSelectedMateriaIdForGroup] = useState('');
  const [selectedDocenteIdForGroup, setSelectedDocenteIdForGroup] = useState('');
  const [groupAssignmentSchedule, setGroupAssignmentSchedule] = useState('');
  const [savingGroupAssignment, setSavingGroupAssignment] = useState(false);
  const [groupAssignmentError, setGroupAssignmentError] = useState('');
  const [groupAssignmentSuccess, setGroupAssignmentSuccess] = useState(false);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');
  const [groupAssignmentFilter, setGroupAssignmentFilter] = useState('all');

  const [assignGroupSemesterFilter, setAssignGroupSemesterFilter] = useState('all');
  const [assignGroupShiftFilter, setAssignGroupShiftFilter] = useState('all');
  const [selectedScheduleSlots, setSelectedScheduleSlots] = useState([]);

  // States for interactive schedule editor
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [draggedClass, setDraggedClass] = useState(null);
  const [selectedSlotForQuickAssign, setSelectedSlotForQuickAssign] = useState(null);
  const [showQuickAssignModal, setShowQuickAssignModal] = useState(false);
  const [quickAssignSubjectId, setQuickAssignSubjectId] = useState('');
  const [quickAssignGroupId, setQuickAssignGroupId] = useState('');
  const [quickAssignDuration, setQuickAssignDuration] = useState(2);
  const [editingClassData, setEditingClassData] = useState(null);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editClassDay, setEditClassDay] = useState('Lunes');
  const [editClassStartHour, setEditClassStartHour] = useState(7);
  const [editClassDuration, setEditClassDuration] = useState(2);
  const [savingQuickAssignment, setSavingQuickAssignment] = useState(false);
  const [quickAssignmentError, setQuickAssignmentError] = useState('');
  const [savingClassEdit, setSavingClassEdit] = useState(false);
  const [classEditError, setClassEditError] = useState('');

  // Temporary group creation state variables
  const [showCreateTempGroupModal, setShowCreateTempGroupModal] = useState(false);
  const [tempGroupClave, setTempGroupClave] = useState('');
  const [tempGroupTurno, setTempGroupTurno] = useState('Matutino');
  const [tempGroupCupo, setTempGroupCupo] = useState(30);
  const [tempGroupSemestre, setTempGroupSemestre] = useState(1);
  const [tempGroupTeacherId, setTempGroupTeacherId] = useState('');
  const [tempGroupSubjectId, setTempGroupSubjectId] = useState('');
  const [savingTempGroup, setSavingTempGroup] = useState(false);
  const [tempGroupError, setTempGroupError] = useState('');
  const [resizingData, setResizingData] = useState(null);

  // Local transaction states for editing session safety
  const [backupGrupos, setBackupGrupos] = useState([]);
  const [editableGrupos, setEditableGrupos] = useState([]);
  const [pendingDeletions, setPendingDeletions] = useState([]);
  const [savingScheduleChanges, setSavingScheduleChanges] = useState(false);

  const [adminDropRequests, setAdminDropRequests] = useState([]);
  const [loadingDropRequests, setLoadingDropRequests] = useState(false);
  const [invitationsSemesterFilter, setInvitationsSemesterFilter] = useState('all');
  const [groupAssignmentSemesterFilter, setGroupAssignmentSemesterFilter] = useState('all');
  const [activeScheduleDay, setActiveScheduleDay] = useState('Lu');

  const parseHorario = (horarioStr) => {
    if (!horarioStr) return [];
    const slots = [];
    const segments = horarioStr.split(',').map(s => s.trim());
    segments.forEach(seg => {
      const spaceIndex = seg.indexOf(' ');
      if (spaceIndex === -1) return;
      const day = seg.substring(0, spaceIndex).trim();
      const timeParts = seg.substring(spaceIndex + 1).split('/');
      timeParts.forEach(tp => {
        const hours = tp.split('-').map(h => parseInt(h));
        if (hours.length === 2 && !isNaN(hours[0]) && !isNaN(hours[1])) {
          const start = hours[0];
          const end = hours[1];
          for (let h = start; h < end; h++) {
            slots.push({ day, hour: h });
          }
        }
      });
    });
    return slots;
  };

  const formatHorario = (selectedSlots) => {
    if (!selectedSlots || selectedSlots.length === 0) return '';
    const dayMap = {};
    selectedSlots.forEach(slot => {
      if (!dayMap[slot.day]) dayMap[slot.day] = [];
      dayMap[slot.day].push(slot.hour);
    });
    const dayOrder = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
    const formattedSegments = [];
    dayOrder.forEach(day => {
      if (!dayMap[day]) return;
      const hours = dayMap[day].sort((a, b) => a - b);
      const blocks = [];
      let start = hours[0];
      let prev = hours[0];
      for (let i = 1; i < hours.length; i++) {
        if (hours[i] === prev + 1) {
          prev = hours[i];
        } else {
          blocks.push(`${start}-${prev + 1}`);
          start = hours[i];
          prev = hours[i];
        }
      }
      blocks.push(`${start}-${prev + 1}`);
      formattedSegments.push(`${day} ${blocks.join('/')}`);
    });
    return formattedSegments.join(', ');
  };

  // Helper functions and event handlers for interactive schedule editor
  const parseScheduleBlocks = (scheduleStr) => {
    if (!scheduleStr || scheduleStr === 'Sin horario' || scheduleStr === 'Horario no especificado') return [];
    const blocks = [];
    const segments = scheduleStr.split(',').map(s => s.trim());
    segments.forEach(seg => {
      const spaceIndex = seg.indexOf(' ');
      if (spaceIndex === -1) return;
      const dayAbbrev = seg.substring(0, spaceIndex).trim();
      
      let day = 'Lunes';
      if (/lu/i.test(dayAbbrev)) day = 'Lunes';
      else if (/ma/i.test(dayAbbrev)) day = 'Martes';
      else if (/mi/i.test(dayAbbrev)) day = 'Miércoles';
      else if (/ju/i.test(dayAbbrev)) day = 'Jueves';
      else if (/vi/i.test(dayAbbrev)) day = 'Viernes';
      else return;
      
      const timeParts = seg.substring(spaceIndex + 1).split('/');
      timeParts.forEach(tp => {
        const hours = tp.split('-').map(h => parseInt(h));
        if (hours.length === 2 && !isNaN(hours[0]) && !isNaN(hours[1])) {
          const startHour = hours[0];
          const endHour = hours[1];
          blocks.push({
            day,
            startHour,
            endHour,
            duration: endHour - startHour
          });
        }
      });
    });
    return blocks;
  };

  const getTeacherBlocks = (grupos) => {
    const allBlocks = [];
    if (!grupos) return allBlocks;
    grupos.forEach(cls => {
      const blocks = parseScheduleBlocks(cls.schedule);
      blocks.forEach((block, idx) => {
        allBlocks.push({
          ...cls,
          blockId: `${cls.id}-${block.day}-${block.startHour}-${idx}`,
          day: block.day,
          startHour: block.startHour,
          endHour: block.endHour,
          duration: block.duration
        });
      });
    });
    return allBlocks;
  };

  const formatScheduleBlocks = (blocks) => {
    const dayNameMap = {
      'Lunes': 'Lu',
      'Martes': 'Ma',
      'Miércoles': 'Mi',
      'Jueves': 'Ju',
      'Viernes': 'Vi'
    };

    const dayMap = {};
    blocks.forEach(b => {
      const abbrev = dayNameMap[b.day] || b.day;
      if (!dayMap[abbrev]) dayMap[abbrev] = [];
      dayMap[abbrev].push({ start: b.startHour, end: b.startHour + b.duration });
    });

    const dayOrder = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi'];
    const segments = [];
    dayOrder.forEach(dayAbbrev => {
      if (dayMap[dayAbbrev] && dayMap[dayAbbrev].length > 0) {
        const sorted = dayMap[dayAbbrev].sort((a, b) => a.start - b.start);
        const timeParts = sorted.map(b => `${b.start}-${b.end}`);
        segments.push(`${dayAbbrev} ${timeParts.join('/')}`);
      }
    });

    return segments.join(', ');
  };

  const getVisibleHours = (grupos, shift) => {
    let minHour = shift === 'Vespertino' ? 14 : 7;
    let maxHour = shift === 'Vespertino' ? 22 : 15;

    const blocks = getTeacherBlocks(grupos);
    blocks.forEach(b => {
      if (b.startHour < minHour) minHour = b.startHour;
      if (b.endHour > maxHour) maxHour = b.endHour;
    });

    const hours = [];
    for (let h = minHour; h < maxHour; h++) {
      hours.push(h);
    }
    return { hours, minHour, maxHour };
  };

  const ensureAssignmentOptions = async () => {
    if (!assignmentOptions || !assignmentOptions.materias || assignmentOptions.materias.length === 0) {
      setLoadingAssignmentOptions(true);
      try {
        const options = await api.getAssignmentOptions();
        setAssignmentOptions(options);
        return options;
      } catch (err) {
        console.error("Error loading assignment options:", err);
      } finally {
        setLoadingAssignmentOptions(false);
      }
    }
    return assignmentOptions;
  };

  const handleStartEditing = () => {
    const currentList = adminTeacherDetail.data?.grupos || [];
    setBackupGrupos(JSON.parse(JSON.stringify(currentList)));
    setEditableGrupos(JSON.parse(JSON.stringify(currentList)));
    setPendingDeletions([]);
    setIsEditingSchedule(true);
  };

  const handleCancelChanges = () => {
    setEditableGrupos([]);
    setBackupGrupos([]);
    setPendingDeletions([]);
    setIsEditingSchedule(false);
  };

  const handleSaveChanges = async () => {
    setSavingScheduleChanges(true);
    try {
      const promises = [];

      // 1. Process Deletions
      pendingDeletions.forEach(id => {
        if (!id.startsWith('temp-')) {
          promises.push(api.deleteAssignment(id));
        }
      });

      // 2. Process Creations and Updates
      editableGrupos.forEach(item => {
        if (item.id.startsWith('temp-')) {
          promises.push(api.createAssignment({
            docente_id: adminSelectedTeacherId,
            materia_id: item.materia_id,
            grupo_id: item.grupo_id,
            horario: item.schedule
          }));
        } else {
          const original = backupGrupos.find(g => g.id === item.id);
          if (original && original.schedule !== item.schedule) {
            promises.push(api.updateAssignment(item.id, item.schedule));
          }
        }
      });

      await Promise.all(promises);

      const overview = await api.getTeacherOverview(adminSelectedTeacherId, selectedWeek);
      setAdminTeacherDetail(prev => ({
        ...prev,
        data: overview
      }));

      const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
      setAdminData(updatedAdminSummary);

      setIsEditingSchedule(false);
      setPendingDeletions([]);
      setEditableGrupos([]);
      setBackupGrupos([]);

      setReminderToast({ show: true, teacherName: `Horario guardado` });
      setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
    } catch (err) {
      console.error("Error saving schedule changes:", err);
      alert(err.message || "Error al guardar los cambios del horario.");
    } finally {
      setSavingScheduleChanges(false);
    }
  };

  const handleDragStart = (e, cls) => {
    if (!isEditingSchedule) return;
    setDraggedClass(cls);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!isEditingSchedule) return;
    e.preventDefault();
  };

  const handleDrop = (e, targetDay, targetStartHour) => {
    if (!isEditingSchedule || !draggedClass) return;
    e.preventDefault();

    const assignmentId = draggedClass.id;
    const originalDay = draggedClass.day;
    const originalStartHour = draggedClass.startHour;
    
    setEditableGrupos(prev => {
      return prev.map(g => {
        if (g.id === assignmentId) {
          const blocks = parseScheduleBlocks(g.schedule);
          const blockToUpdate = blocks.find(b => b.day === originalDay && b.startHour === originalStartHour);
          if (blockToUpdate) {
            blockToUpdate.day = targetDay;
            blockToUpdate.startHour = targetStartHour;
            blockToUpdate.endHour = targetStartHour + blockToUpdate.duration;
          }
          return {
            ...g,
            schedule: formatScheduleBlocks(blocks)
          };
        }
        return g;
      });
    });
    setDraggedClass(null);
  };

  const handleResizeMouseDown = (e, cls) => {
    if (!isEditingSchedule) return;
    e.preventDefault();
    e.stopPropagation();

    setResizingData({
      classId: cls.id,
      blockId: cls.blockId,
      day: cls.day,
      startHour: cls.startHour,
      initialDuration: cls.duration,
      currentDuration: cls.duration,
      startY: e.clientY
    });
  };

  useEffect(() => {
    if (!resizingData) return;

    const handleMouseMove = (e) => {
      const deltaY = e.clientY - resizingData.startY;
      const rowHeight = 60;
      const deltaHours = Math.round(deltaY / rowHeight);
      const newDuration = Math.max(1, Math.min(4, resizingData.initialDuration + deltaHours));
      
      setResizingData(prev => ({
        ...prev,
        currentDuration: newDuration
      }));
    };

    const handleMouseUp = () => {
      const finalData = resizingData;
      setResizingData(null);

      if (!finalData || finalData.currentDuration === finalData.initialDuration) return;

      setEditableGrupos(prev => {
        return prev.map(g => {
          if (g.id === finalData.classId) {
            const blocks = parseScheduleBlocks(g.schedule);
            const blockToUpdate = blocks.find(b => b.day === finalData.day && b.startHour === finalData.startHour);
            if (blockToUpdate) {
              blockToUpdate.duration = finalData.currentDuration;
              blockToUpdate.endHour = blockToUpdate.startHour + finalData.currentDuration;
            }
            return {
              ...g,
              schedule: formatScheduleBlocks(blocks)
            };
          }
          return g;
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingData]);

  const handleCellDoubleClick = async (day, hour) => {
    if (!isEditingSchedule) return;
    const opts = await ensureAssignmentOptions();
    setSelectedSlotForQuickAssign({ day, hour });
    
    let defaultSubjectId = '';
    let defaultGroupId = '';
    
    if (isIntersemestral && opts) {
      const interSub = opts.materias?.find(m => m.nombre === 'Intersemestral');
      if (interSub) defaultSubjectId = interSub.id || interSub.materia_id;
      const interGrp = opts.grupos?.find(g => g.clave === 'Intersemestral');
      if (interGrp) defaultGroupId = interGrp.id || interGrp.grupo_id;
    }

    setQuickAssignSubjectId(defaultSubjectId);
    setQuickAssignGroupId(defaultGroupId);
    setQuickAssignDuration(2);
    setQuickAssignmentError('');
    setShowQuickAssignModal(true);
  };

  const handleCardDoubleClick = (e, cls) => {
    if (!isEditingSchedule) return;
    e.stopPropagation();

    setEditingClassData({
      id: cls.id,
      blockId: cls.blockId,
      name: cls.name,
      key: cls.key,
      day: cls.day,
      startHour: cls.startHour,
      duration: cls.duration
    });
    setEditClassDay(cls.day);
    setEditClassStartHour(cls.startHour);
    setEditClassDuration(cls.duration);
    setClassEditError('');
    setShowEditClassModal(true);
  };

  const handleSaveQuickAssignment = (e) => {
    e.preventDefault();
    if (!quickAssignSubjectId || !quickAssignGroupId || !selectedSlotForQuickAssign) {
      setQuickAssignmentError('Todos los campos son obligatorios.');
      return;
    }

    const dayNameMap = {
      'Lunes': 'Lu',
      'Martes': 'Ma',
      'Miércoles': 'Mi',
      'Jueves': 'Ju',
      'Viernes': 'Vi'
    };
    const abbrev = dayNameMap[selectedSlotForQuickAssign.day] || 'Lu';
    const scheduleStr = `${abbrev} ${selectedSlotForQuickAssign.hour}-${selectedSlotForQuickAssign.hour + quickAssignDuration}`;

    const selectedMateria = assignmentOptions.materias?.find(m => String(m.id || m.materia_id) === String(quickAssignSubjectId));
    const selectedGrupo = assignmentOptions.grupos?.find(g => String(g.id || g.grupo_id) === String(quickAssignGroupId));

    const tempId = `temp-${Date.now()}`;
    const newAssignment = {
      id: tempId,
      name: selectedMateria ? selectedMateria.nombre : 'Materia',
      key: `${selectedMateria ? selectedMateria.clave : 'M'}-${selectedGrupo ? selectedGrupo.clave : 'G'}`,
      schedule: scheduleStr,
      totalStudents: 0,
      asistencia_promedio: 100,
      materia_id: quickAssignSubjectId,
      grupo_id: quickAssignGroupId
    };

    setEditableGrupos(prev => [...prev, newAssignment]);
    setShowQuickAssignModal(false);
  };

  const handleSaveClassEdit = (e) => {
    e.preventDefault();
    if (!editingClassData) return;

    setEditableGrupos(prev => {
      return prev.map(g => {
        if (g.id === editingClassData.id) {
          const blocks = parseScheduleBlocks(g.schedule);
          const blockToUpdate = blocks.find(b => b.day === editingClassData.day && b.startHour === editingClassData.startHour);
          if (blockToUpdate) {
            blockToUpdate.day = editClassDay;
            blockToUpdate.startHour = editClassStartHour;
            blockToUpdate.endHour = editClassStartHour + editClassDuration;
          }
          return {
            ...g,
            schedule: formatScheduleBlocks(blocks)
          };
        }
        return g;
      });
    });
    setShowEditClassModal(false);
  };

  const handleUnassignFromModal = () => {
    if (!editingClassData) return;
    if (window.confirm(`¿Estás seguro de que deseas desvincular la materia "${editingClassData.name}"?`)) {
      const assignmentId = editingClassData.id;
      
      if (!assignmentId.startsWith('temp-')) {
        setPendingDeletions(prev => [...prev, assignmentId]);
      }

      setEditableGrupos(prev => prev.filter(g => g.id !== assignmentId));
      setShowEditClassModal(false);
    }
  };

  const filteredAlumnos = useMemo(() => {
    let list = alumnosData?.alumnos || [];
    if (alumnosSemesterFilter !== 'all') {
      list = list.filter(a => String(a.semestre) === String(alumnosSemesterFilter));
    }
    if (alumnosGroupFilter !== 'all') {
      list = list.filter(a => String(a.grupo_clave) === String(alumnosGroupFilter));
    }
    const query = alumnosSearchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(a => 
        (a.nombre || '').toLowerCase().includes(query) ||
        (a.correo || '').toLowerCase().includes(query) ||
        (a.matricula || '').toLowerCase().includes(query) ||
        (a.grupo_clave || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [alumnosData?.alumnos, alumnosSearchQuery, alumnosSemesterFilter, alumnosGroupFilter]);

  const filteredInvitations = useMemo(() => {
    let list = alumnosData?.invitaciones || [];
    if (invitationsSemesterFilter !== 'all') {
      list = list.filter(i => String(i.semestre) === String(invitationsSemesterFilter));
    }
    if (invitationsGroupFilter !== 'all') {
      list = list.filter(i => String(i.grupo_clave) === String(invitationsGroupFilter));
    }
    if (invitationsStatusFilter !== 'all') {
      list = list.filter(i => {
        const isExpired = new Date(i.expires_at) < new Date() && i.estatus === 'Pendiente';
        const displayStatus = isExpired ? 'Expirada' : i.estatus;
        return displayStatus.toLowerCase() === invitationsStatusFilter.toLowerCase();
      });
    }
    const query = invitationsSearchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(i => 
        (i.correo || '').toLowerCase().includes(query) ||
        (i.grupo_clave || '').toLowerCase().includes(query) ||
        (i.estatus || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [alumnosData?.invitaciones, invitationsSearchQuery, invitationsGroupFilter, invitationsStatusFilter, invitationsSemesterFilter]);

  const filteredGroupsForInvite = useMemo(() => {
    if (!assignmentOptions?.grupos) return [];
    return assignmentOptions.grupos.filter(g => {
      const semMatch = inviteGroupSemesterFilter === 'all' ? true : String(g.semestre) === String(inviteGroupSemesterFilter);
      const shiftMatch = inviteGroupShiftFilter === 'all' ? true : g.turno.toLowerCase() === inviteGroupShiftFilter.toLowerCase();
      return semMatch && shiftMatch;
    });
  }, [assignmentOptions?.grupos, inviteGroupSemesterFilter, inviteGroupShiftFilter]);

  const filteredGroupsForAssign = useMemo(() => {
    if (!assignmentOptions?.grupos) return [];
    return assignmentOptions.grupos.filter(g => {
      const semMatch = assignGroupSemesterFilter === 'all' ? true : String(g.semestre) === String(assignGroupSemesterFilter);
      const shiftMatch = assignGroupShiftFilter === 'all' ? true : g.turno.toLowerCase() === assignGroupShiftFilter.toLowerCase();
      return semMatch && shiftMatch;
    });
  }, [assignmentOptions?.grupos, assignGroupSemesterFilter, assignGroupShiftFilter]);

  const filteredAssignments = useMemo(() => {
    const query = assignmentSearchQuery.trim().toLowerCase();
    const grpFilter = groupAssignmentFilter;
    let list = assignmentOptions?.asignaciones || [];
    if (groupAssignmentSemesterFilter !== 'all') {
      list = list.filter(a => String(a.semestre) === String(groupAssignmentSemesterFilter));
    }
    if (grpFilter !== 'all') {
      list = list.filter(a => String(a.grupo_id) === String(grpFilter));
    }
    if (query) {
      list = list.filter(a => 
        (a.materia_nombre || '').toLowerCase().includes(query) ||
        (a.materia_clave || '').toLowerCase().includes(query) ||
        (a.docente_nombre || '').toLowerCase().includes(query) ||
        (a.grupo_clave || '').toLowerCase().includes(query)
      );
    }
    return list;
  }, [assignmentOptions?.asignaciones, assignmentSearchQuery, groupAssignmentFilter, groupAssignmentSemesterFilter]);

  const groupOptionsForAlumnos = useMemo(() => {
    if (!assignmentOptions?.grupos) return [];
    return assignmentOptions.grupos.filter(g => {
      if (g.clave === '*') return false;
      return alumnosSemesterFilter === 'all' ? true : String(g.semestre) === String(alumnosSemesterFilter);
    });
  }, [assignmentOptions?.grupos, alumnosSemesterFilter]);

  const groupOptionsForInvitations = useMemo(() => {
    if (!assignmentOptions?.grupos) return [];
    return assignmentOptions.grupos.filter(g => {
      if (g.clave === '*') return false;
      return invitationsSemesterFilter === 'all' ? true : String(g.semestre) === String(invitationsSemesterFilter);
    });
  }, [assignmentOptions?.grupos, invitationsSemesterFilter]);

  const groupOptionsForAssignments = useMemo(() => {
    if (!assignmentOptions?.grupos) return [];
    return assignmentOptions.grupos.filter(g => {
      if (g.clave === '*') return false;
      return groupAssignmentSemesterFilter === 'all' ? true : String(g.semestre) === String(groupAssignmentSemesterFilter);
    });
  }, [assignmentOptions?.grupos, groupAssignmentSemesterFilter]);

  const selectedGroupTurno = useMemo(() => {
    if (!selectedGroupIdForMateria || !assignmentOptions?.grupos) return null;
    const group = assignmentOptions.grupos.find(g => String(g.id) === String(selectedGroupIdForMateria));
    return group ? group.turno : null;
  }, [selectedGroupIdForMateria, assignmentOptions?.grupos]);

  const hoursToShow = useMemo(() => {
    if (selectedGroupTurno === 'Matutino') {
      return Array.from({ length: 8 }, (_, i) => i + 7);
    } else if (selectedGroupTurno === 'Vespertino') {
      return Array.from({ length: 9 }, (_, i) => i + 13);
    }
    return Array.from({ length: 15 }, (_, i) => i + 7);
  }, [selectedGroupTurno]);

  const conflictSlots = useMemo(() => {
    const slots = [];
    const assignments = assignmentOptions?.asignaciones || [];
    assignments.forEach(asg => {
      const isGroupConflict = selectedGroupIdForMateria && String(asg.grupo_id) === String(selectedGroupIdForMateria);
      const isTeacherConflict = selectedDocenteIdForGroup && String(asg.docente_id) === String(selectedDocenteIdForGroup);
      if (isGroupConflict || isTeacherConflict) {
        const parsed = parseHorario(asg.horario);
        slots.push(...parsed.map(s => ({
          ...s,
          reason: isGroupConflict 
            ? `Grupo ocupado con "${asg.materia_nombre}" (${asg.docente_nombre})` 
            : `Docente ocupado con "${asg.materia_nombre}" en grupo ${asg.grupo_clave}`
        })));
      }
    });
    return slots;
  }, [assignmentOptions?.asignaciones, selectedGroupIdForMateria, selectedDocenteIdForGroup]);

  const toggleScheduleSlot = (day, hour) => {
    setSelectedScheduleSlots(prev => {
      const exists = prev.some(s => s.day === day && s.hour === hour);
      if (exists) {
        return prev.filter(s => !(s.day === day && s.hour === hour));
      } else {
        return [...prev, { day, hour }];
      }
    });
  };

  useEffect(() => {
    const formatted = formatHorario(selectedScheduleSlots);
    setGroupAssignmentSchedule(formatted);
  }, [selectedScheduleSlots]);

  useEffect(() => {
    setSelectedScheduleSlots([]);
  }, [selectedGroupIdForMateria, selectedDocenteIdForGroup]);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDanger: false,
    onConfirm: null
  });

  const [selectedClassDetailModal, setSelectedClassDetailModal] = useState({
    isOpen: false,
    classData: null
  });

  const getFilteredMateriasOptions = () => {
    if (!assignmentOptions.materias) return [];
    if (!isIntersemestral) return assignmentOptions.materias;
    const genericSub = assignmentOptions.materias.find(m => m.nombre === 'Intersemestral');
    const activeSubIds = new Set(interClasses.map(c => c.materia_id));
    const activeSubs = assignmentOptions.materias.filter(m => activeSubIds.has(m.id || m.materia_id));
    const combined = [];
    if (genericSub) combined.push(genericSub);
    activeSubs.forEach(m => {
      const mId = m.id || m.materia_id;
      const genId = genericSub ? (genericSub.id || genericSub.materia_id) : null;
      if (mId !== genId) {
        combined.push(m);
      }
    });
    return combined;
  };

  const getFilteredGruposOptions = () => {
    if (!assignmentOptions.grupos) return [];
    if (!isIntersemestral) return assignmentOptions.grupos;
    const genericGrp = assignmentOptions.grupos.find(g => g.clave === 'Intersemestral');
    const activeGrpIds = new Set(interClasses.map(c => c.grupo_id));
    const activeGrps = assignmentOptions.grupos.filter(g => activeGrpIds.has(g.id || g.grupo_id));
    const combined = [];
    if (genericGrp) combined.push(genericGrp);
    activeGrps.forEach(g => {
      const gId = g.id || g.grupo_id;
      const genId = genericGrp ? (genericGrp.id || genericGrp.grupo_id) : null;
      if (gId !== genId) {
        combined.push(g);
      }
    });
    return combined;
  };

  const handleAssignClassClick = async () => {
    setLoadingAssignmentOptions(true);
    setSelectedSubjectId('');
    setSelectedGroupIdForClass('');
    setAssignedClassSchedule('Lu-Mi 08:00');
    try {
      const options = await api.getAssignmentOptions();
      setAssignmentOptions(options);
      
      if (isIntersemestral && options) {
        const interSub = options.materias?.find(m => m.nombre === 'Intersemestral');
        if (interSub) setSelectedSubjectId(interSub.id || interSub.materia_id || '');
        const interGrp = options.grupos?.find(g => g.clave === 'Intersemestral');
        if (interGrp) setSelectedGroupIdForClass(interGrp.id || interGrp.grupo_id || '');
      }
      
      setShowAssignClassModal(true);
    } catch (err) {
      console.error("Error loading assignment options:", err);
    } finally {
      setLoadingAssignmentOptions(false);
    }
  };

  const handleInviteStudentClick = async () => {
    setLoadingAssignmentOptions(true);
    setInviteStudentEmail('');
    setSelectedGroupIdForInvite('');
    setInviteError('');
    setInviteSuccess(false);
    setInviteGroupSemesterFilter('all');
    setInviteGroupShiftFilter('all');
    try {
      const options = await api.getAssignmentOptions();
      setAssignmentOptions(options);
      setShowInviteStudentModal(true);
    } catch (err) {
      console.error("Error loading assignment options for invitation:", err);
    } finally {
      setLoadingAssignmentOptions(false);
    }
  };

  const handleSendStudentInvitation = async (e) => {
    e.preventDefault();
    let email = inviteStudentEmail.trim();
    if (!email || !selectedGroupIdForInvite) {
      setInviteError('Todos los campos son obligatorios.');
      return;
    }

    if (email.includes('@')) {
      email = email.split('@')[0];
    }
    email = `${email}@cuautitlan.tecnm.mx`;

    const institutionalPattern = /^[0-9]+@cuautitlan\.tecnm\.mx$/;
    if (!institutionalPattern.test(email)) {
      setInviteError('Introduce un número de control válido (ej: 223107422).');
      return;
    }

    setSendingInvite(true);
    setInviteError('');
    setInviteSuccess(false);

    try {
      await api.inviteStudent(email, selectedGroupIdForInvite);
      setInviteSuccess(true);
      setInviteStudentEmail('');
      loadAlumnosOverviewData();
      setTimeout(() => {
        setInviteSuccess(false);
      }, 4000);
    } catch (err) {
      console.error("Error sending student invitation:", err);
      setInviteError(err.message || "Error al enviar la invitación.");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSaveGroupAssignment = async (e) => {
    e.preventDefault();
    if (!selectedGroupIdForMateria || !selectedMateriaIdForGroup || !selectedDocenteIdForGroup) {
      setGroupAssignmentError('Todos los campos son obligatorios.');
      return;
    }
    setSavingGroupAssignment(true);
    setGroupAssignmentError('');
    setGroupAssignmentSuccess(false);
    try {
      await api.createAssignment({
        docenteId: parseInt(selectedDocenteIdForGroup),
        materiaId: parseInt(selectedMateriaIdForGroup),
        grupoId: parseInt(selectedGroupIdForMateria),
        horario: groupAssignmentSchedule
      });
      setGroupAssignmentSuccess(true);
      setSelectedMateriaIdForGroup('');
      setGroupAssignmentSchedule('Lu-Mi 08:00');
      await loadAlumnosOverviewData();

      const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
      setAdminData(updatedAdminSummary);

      setTimeout(() => setGroupAssignmentSuccess(false), 4000);
    } catch (err) {
      console.error("Error saving group assignment:", err);
      setGroupAssignmentError(err.message || 'Error al asignar la materia. Compruebe si ya está asignada.');
    } finally {
      setSavingGroupAssignment(false);
    }
  };

  const handleDeleteGroupAssignment = (assignmentId, materiaNombre, grupoClave) => {
    setConfirmModal({
      isOpen: true,
      title: 'Desvincular Materia del Grupo',
      message: `¿Estás seguro de que deseas desvincular la materia "${materiaNombre}" del grupo "${grupoClave}"? Todos los alumnos de este grupo serán desvinculados de esta materia y se perderán sus registros de asistencia. Esta acción no se puede deshacer.`,
      confirmText: 'Desvincular',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteAssignment(assignmentId);
          await loadAlumnosOverviewData();

          const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
          setAdminData(updatedAdminSummary);

          setReminderToast({ show: true, teacherName: `Materia desvinculada con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        } catch (err) {
          console.error("Error deleting assignment:", err);
          setReminderToast({ show: true, teacherName: `Error: ${err.message || 'No se pudo desvincular'}` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        }
      }
    });
  };

  const handleAdminApproveDropRequest = (requestId, alumnoNombre, courseName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Aprobar Solicitud de Baja',
      message: `¿Estás seguro de que deseas aprobar la baja del alumno "${alumnoNombre}" de la materia "${courseName}"? El alumno será desvinculado, perdiéndose todos sus registros de asistencia para esta clase. Esta acción no se puede deshacer.`,
      confirmText: 'Aprobar Baja',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.adminApproveDropRequest(requestId);
          await loadAlumnosOverviewData();
          
          const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
          setAdminData(updatedAdminSummary);
          
          setReminderToast({ show: true, teacherName: `Baja aprobada con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        } catch (err) {
          console.error("Error approving drop request:", err);
          alert(err.message || 'No se pudo aprobar la solicitud.');
        }
      }
    });
  };

  const handleAdminRejectDropRequest = (requestId, alumnoNombre, courseName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Rechazar Solicitud de Baja',
      message: `¿Estás seguro de que deseas rechazar la baja del alumno "${alumnoNombre}" de la materia "${courseName}"? La solicitud se cancelará y el alumno permanecerá inscrito.`,
      confirmText: 'Rechazar',
      cancelText: 'Cancelar',
      isDanger: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.adminRejectDropRequest(requestId);
          await loadAlumnosOverviewData();
          
          setReminderToast({ show: true, teacherName: `Solicitud rechazada con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        } catch (err) {
          console.error("Error rejecting drop request:", err);
          alert(err.message || 'No se pudo rechazar la solicitud.');
        }
      }
    });
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    const docenteId = adminSelectedTeacherId || selectedDocenteIdForGroup;
    if (!docenteId || !selectedSubjectId || !selectedGroupIdForClass) return;
    setSavingAssignment(true);
    try {
      await api.createAssignment({
        docenteId: Number(docenteId),
        materiaId: Number(selectedSubjectId),
        grupoId: Number(selectedGroupIdForClass),
        horario: null
      });
      setShowAssignClassModal(false);
      
      setReminderToast({ show: true, teacherName: `Clase asignada con éxito` });
      setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
      
      if (adminSelectedTeacherId) {
        const updatedOverview = await api.getTeacherOverview(adminSelectedTeacherId, selectedWeek);
        setAdminTeacherDetail(prev => ({
          ...prev,
          data: updatedOverview
        }));
      } else {
        await loadIntersemestralData();
        await refreshDashboardData();
      }
      
      const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
      setAdminData(updatedAdminSummary);
    } catch (err) {
      console.error("Error creating assignment:", err);
      alert(err.message || "Error al asignar la clase. Compruebe si ya está asignada.");
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleUnassignClass = (assignmentId, className) => {
    setConfirmModal({
      isOpen: true,
      title: 'Desvincular Clase',
      message: `¿Estás seguro de que deseas desvincular la asignatura "${className}" de este docente? Esta acción no se puede deshacer.`,
      confirmText: 'Desvincular',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteAssignment(assignmentId);
          setReminderToast({ show: true, teacherName: `Clase desvinculada con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
          
          const updatedOverview = await api.getTeacherOverview(adminSelectedTeacherId, selectedWeek);
          setAdminTeacherDetail(prev => ({
            ...prev,
            data: updatedOverview
          }));
          
          const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
          setAdminData(updatedAdminSummary);
        } catch (err) {
          console.error("Error deleting assignment:", err);
          setReminderToast({ show: true, teacherName: `Error: ${err.message || 'No se pudo desvincular'}` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        }
      }
    });
  };

  const handleDeleteTeacher = (docenteId, teacherName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Dar de Baja Docente',
      message: `¿Estás seguro de que deseas dar de baja al docente "${teacherName}"? Su acceso al sistema será inhabilitado y sus asignaciones actuales se cancelarán. Su historial se preservará para reportes escolares.`,
      confirmText: 'Confirmar Baja',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteDocente(docenteId);
          setReminderToast({ show: true, teacherName: `Docente dado de baja con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
          
          setAdminSelectedTeacherId(null);
          setAdminTeacherDetail(null);
          
          const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
          setAdminData(updatedAdminSummary);
        } catch (err) {
          console.error("Error deleting teacher:", err);
          setReminderToast({ show: true, teacherName: `Error: ${err.message || 'No se pudo desactivar'}` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        }
      }
    });
  };

  const handleEditAlumnoClick = (alumno) => {
    setEditStudentId(alumno.id);
    setEditStudentName(alumno.nombre);
    setEditStudentEmail(alumno.correo);
    setEditStudentMatricula(alumno.matricula);
    setEditStudentGroupId(alumno.grupo_id || '');
    setEditStudentError('');
    setShowEditStudentModal(true);
  };

  const handleSaveStudentEdit = async (e) => {
    e.preventDefault();
    setSavingEditStudent(true);
    setEditStudentError('');
    try {
      await api.updateAlumno(editStudentId, {
        nombre: editStudentName,
        correo: editStudentEmail,
        matricula: editStudentMatricula,
        grupoId: editStudentGroupId
      });
      setReminderToast({ show: true, teacherName: `Alumno actualizado con éxito` });
      setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
      setShowEditStudentModal(false);
      await loadAlumnosOverviewData();
    } catch (err) {
      console.error("Error updating student:", err);
      setEditStudentError(err.message || 'No se pudo actualizar la información');
    } finally {
      setSavingEditStudent(false);
    }
  };

  const handleDeleteAlumno = (alumnoId, alumnoNombre) => {
    setConfirmModal({
      isOpen: true,
      title: 'Dar de Baja Alumno',
      message: `¿Estás seguro de que deseas dar de baja al alumno "${alumnoNombre}" del sistema? Su acceso será revocado y no aparecerá en las listas de asistencia activas. Su historial se preservará para reportes institucionales.`,
      confirmText: 'Confirmar Baja',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteAlumno(alumnoId);
          setReminderToast({ show: true, teacherName: `Alumno dado de baja con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
          await loadAlumnosOverviewData();
        } catch (err) {
          console.error("Error deleting student:", err);
          setReminderToast({ show: true, teacherName: `Error: ${err.message || 'No se pudo dar de baja'}` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        }
      }
    });
  };

  const handleDeleteInvitation = (invitacionId, invitationEmail) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Invitación',
      message: `¿Estás seguro de que deseas cancelar la invitación para "${invitationEmail}"? El enlace enviado por correo dejará de ser válido permanentemente.`,
      confirmText: 'Cancelar Invitación',
      cancelText: 'Volver',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.deleteInvitation(invitacionId);
          setReminderToast({ show: true, teacherName: `Invitación cancelada con éxito` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
          await loadAlumnosOverviewData();
        } catch (err) {
          console.error("Error deleting invitation:", err);
          setReminderToast({ show: true, teacherName: `Error: ${err.message || 'No se pudo cancelar la invitación'}` });
          setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
        }
      }
    });
  };

  const getTeacherAvatar = (name, size = 'md') => {
    if (!name) return null;
    const initials = name.split(' ')
                         .filter(n => n.length > 0)
                         .slice(0, 2)
                         .map(n => n[0].toUpperCase())
                         .join('');
    
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-emerald-400 to-teal-600',
      'from-purple-500 to-pink-600',
      'from-amber-400 to-orange-600',
      'from-rose-500 to-red-600',
      'from-indigo-400 to-cyan-600'
    ];
    const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
    const gradient = colors[code % colors.length];

    const sizeClasses = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-16 h-16 text-xl'
    };

    return (
      <div className={`rounded-xl bg-gradient-to-br ${gradient} text-white font-extrabold flex items-center justify-center shadow-md shrink-0 select-none ${sizeClasses[size]}`}>
        {initials}
      </div>
    );
  };

  const handleCreateTeacherClick = () => {
    setNewTeacherName('');
    setNewTeacherEmail('');
    setNewTeacherShift('Matutino');
    setShowCreateTeacherModal(true);
  };

  const handleSaveNewTeacher = async (e) => {
    e.preventDefault();
    setSavingNewTeacher(true);
    try {
      const res = await api.createDocente({
        docente: newTeacherName,
        correo: newTeacherEmail,
        turno: newTeacherShift
      });
      setShowCreateTeacherModal(false);
      
      setReminderToast({ show: true, teacherName: `Registro de ${newTeacherName}` });
      setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
      
      const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
      setAdminData(updatedAdminSummary);
      
      if (res && res.docente) {
        setAdminSelectedTeacherId(res.docente.docente_id);
        const overview = await api.getTeacherOverview(res.docente.docente_id, selectedWeek);
        setAdminTeacherDetail({
          name: res.docente.docente,
          data: overview
        });
      }
    } catch (err) {
      console.error("Error creating teacher:", err);
    } finally {
      setSavingNewTeacher(false);
    }
  };

  const handleCreateTempGroup = async (e) => {
    e.preventDefault();
    if (!tempGroupClave || !tempGroupClave.trim()) {
      setTempGroupError('La clave del grupo es obligatoria.');
      return;
    }

    setSavingTempGroup(true);
    setTempGroupError('');
    try {
      await api.createGroup({
        clave: tempGroupClave.trim(),
        turno: tempGroupTurno,
        cupo: tempGroupCupo,
        semestre: tempGroupSemestre
      });
      
      const options = await api.getAssignmentOptions();
      setAssignmentOptions(options);
      
      alert(`Grupo temporal "${tempGroupClave}" creado con éxito.`);
      setShowCreateTempGroupModal(false);
      setTempGroupClave('');
      setTempGroupTurno('Matutino');
      setTempGroupCupo(30);
      setTempGroupSemestre(1);
    } catch (err) {
      setTempGroupError(err.message || 'Error al crear el grupo temporal.');
    } finally {
      setSavingTempGroup(false);
    }
  };

  const getWeeklySchedule = (grupos) => {
    const days = [
      { key: 'Lunes', label: 'Lunes' },
      { key: 'Martes', label: 'Martes' },
      { key: 'Miércoles', label: 'Miércoles' },
      { key: 'Jueves', label: 'Jueves' },
      { key: 'Viernes', label: 'Viernes' }
    ];
    
    if (!grupos) return days.map(d => ({ ...d, classes: [] }));

    return days.map(d => {
      const classesForDay = [];
      grupos.forEach(g => {
        const scheduleStr = g.schedule || '';
        const matchesDay = (
          (d.key === 'Lunes' && /(lunes|\blu\b|\blu-|^lu-)/i.test(scheduleStr)) ||
          (d.key === 'Martes' && /(martes|\bma\b|\bma-|^ma-)/i.test(scheduleStr)) ||
          (d.key === 'Miércoles' && /(mi(e|é)rcoles|\bmi\b|\bmi-|^mi-)/i.test(scheduleStr)) ||
          (d.key === 'Jueves' && /(jueves|\bju\b|\bju-|^ju-)/i.test(scheduleStr)) ||
          (d.key === 'Viernes' && /(viernes|\bvi\b|\bvi-|^vi-)/i.test(scheduleStr))
        );
        
        if (matchesDay) {
          const timeMatch = scheduleStr.match(/\d{2}:\d{2}(?:\s*-\s*\d{2}:\d{2})?(?:\s*(?:am|pm))?/i);
          const time = timeMatch ? timeMatch[0] : scheduleStr.replace(/(lunes|martes|miércoles|miercoles|jueves|viernes|lu-mi|ma-ju|lu|ma|mi|ju|vi|y)/gi, '').trim();
          classesForDay.push({
            id: g.id,
            name: g.name,
            key: g.key,
            time: time || 'Horario no especificado',
            schedule: g.schedule,
            totalStudents: g.totalStudents,
            asistencia_promedio: g.asistencia_promedio
          });
        }
      });
      return {
        ...d,
        classes: classesForDay
      };
    });
  };

  const handleSendReminder = (teacherName) => {
    setReminderToast({ show: true, teacherName });
    setTimeout(() => {
      setReminderToast({ show: false, teacherName: '' });
    }, 4000);
  };

  const handleEditTeacherClick = () => {
    if (adminTeacherDetail && adminSelectedTeacherId) {
      const currentDocente = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId);
      setEditTeacherName(currentDocente?.docente || adminTeacherDetail.name);
      setEditTeacherEmail(currentDocente?.correo || '');
      setEditTeacherShift(currentDocente?.turno || 'Matutino');
      setShowEditTeacherModal(true);
    }
  };

  const handleSaveTeacherEdit = async (e) => {
    e.preventDefault();
    if (!adminSelectedTeacherId) return;
    setSavingEditTeacher(true);
    try {
      await api.updateDocente(adminSelectedTeacherId, {
        docente: editTeacherName,
        correo: editTeacherEmail,
        turno: editTeacherShift
      });
      setShowEditTeacherModal(false);
      
      setReminderToast({ show: true, teacherName: `Edición de ${editTeacherName}` });
      setTimeout(() => setReminderToast({ show: false, teacherName: '' }), 4000);
      
      const updatedAdminSummary = await api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek });
      setAdminData(updatedAdminSummary);
      
      const updatedOverview = await api.getTeacherOverview(adminSelectedTeacherId, selectedWeek);
      setAdminTeacherDetail({
        name: editTeacherName,
        data: updatedOverview
      });
    } catch (err) {
      console.error("Error editing teacher:", err);
    } finally {
      setSavingEditTeacher(false);
    }
  };

  const getLiveClass = (grupos) => {
    if (!grupos || grupos.length === 0) return null;
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();
    const currentMinutes = hour * 60 + min;

    for (let g of grupos) {
      const sched = g.schedule.toLowerCase();
      let days = [];
      let startMin = 0;
      let endMin = 0;

      if (sched.includes('lunes')) days.push(1);
      if (sched.includes('martes')) days.push(2);
      if (sched.includes('miércoles')) days.push(3);
      if (sched.includes('jueves')) days.push(4);
      if (sched.includes('viernes')) days.push(5);

      const match = sched.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
      if (match) {
        startMin = parseInt(match[1]) * 60 + parseInt(match[2]);
        endMin = parseInt(match[3]) * 60 + parseInt(match[4]);
      }

      if (days.includes(day) && currentMinutes >= startMin && currentMinutes <= endMin) {
        return g;
      }
    }
    return null;
  };

  const handleExportTeacherPDF = (teacherDetail) => {
    if (!teacherDetail || !teacherDetail.data) return;
    const tData = teacherDetail.data;
    const tName = teacherDetail.name;
    const tEmail = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.correo || 'N/A';
    const tShift = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.turno || 'N/A';
    const tAvg = tData.grupos.length > 0 
      ? Math.round(tData.grupos.reduce((acc, g) => acc + g.asistencia_promedio, 0) / tData.grupos.length)
      : 85;
    const riskCount = tData.alumnosEnRiesgo?.length || 0;

    const printWindow = window.open('', '_blank');
    
    const dailyChartData = (tData.series || []).map(s => ({
      day: s.label,
      Asistencia: s.asistencias
    }));

    const breakdownSubjects = [
      { name: 'Asistencias Puntuales', attendanceRate: tData.asistencia_desglose?.asistieron || 0 },
      { name: 'Retardos (Tolerancia)', attendanceRate: tData.asistencia_desglose?.retardos || 0 },
      { name: 'Inasistencias (Faltas)', attendanceRate: tData.asistencia_desglose?.faltas || 0 },
      { name: 'Faltas Justificadas', attendanceRate: tData.asistencia_desglose?.justificados || 0 }
    ];

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Docente - ${tName}</title>
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
            .val-warning { color: #b45309; font-weight: bold; }
            .val-danger { color: #b91c1c; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-area">
              <div class="title">REPORTE INDIVIDUAL DE ASISTENCIA (DOCENTE)</div>
              <div class="subtitle">Docente: <strong>${tName}</strong> | Correo: <strong>${tEmail}</strong> | Turno: <strong>${tShift}</strong> | Generado: ${new Date().toLocaleString()}</div>
            </div>
            <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" class="watermark" />
          </div>

          <div class="kpi-container">
            <div class="kpi-card">
              <div class="kpi-val">${tAvg}%</div>
              <div class="kpi-label">Asistencia Promedio</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${tData.grupos?.length || 0}</div>
              <div class="kpi-label">Grupos Activos</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val" style="${riskCount > 0 ? 'color: #ef4444;' : 'color: #10b981;'}">${riskCount}</div>
              <div class="kpi-label">Alumnos en Riesgo</div>
            </div>
          </div>

          ${renderCSSChartHTML(dailyChartData, "HISTORIAL DE ASISTENCIA (TENDENCIA TEMPORAL)")}

          <div class="section-title">Grupos Asignados y Rendimiento</div>
          <table>
            <thead>
              <tr>
                <th>Clave</th>
                <th>Nombre del Grupo</th>
                <th>Horario de Clase</th>
                <th>Alumnos Inscritos</th>
                <th>Asistencia</th>
              </tr>
            </thead>
            <tbody>
              ${tData.grupos?.map(g => {
                const gRate = g.asistencia_promedio;
                const gClass = gRate >= 85 ? 'val-good' : gRate >= 80 ? 'val-warning' : 'val-danger';
                return `
                  <tr>
                    <td><strong>${g.key}</strong></td>
                    <td>${g.name}</td>
                    <td>${g.schedule}</td>
                    <td>${g.totalStudents}</td>
                    <td class="${gClass}">${gRate}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div style="page-break-inside: avoid; margin-top: 35px;">
            ${renderCSSSubjectChartHTML(breakdownSubjects, "DISTRIBUCIÓN PORCENTUAL DE REGISTROS DE ASISTENCIA")}
          </div>

          ${riskCount > 0 ? `
            <div class="section-title" style="color: #b91c1c; border-left-color: #b91c1c; margin-top: 35px;">Alumnos en Riesgo de Reprobar (< 80% Asistencia)</div>
            <table>
              <thead>
                <tr style="background-color: #b91c1c;">
                  <th style="background-color: #b91c1c;">Matrícula</th>
                  <th style="background-color: #b91c1c;">Nombre del Alumno</th>
                  <th style="background-color: #b91c1c;">Materia</th>
                  <th style="background-color: #b91c1c; text-align: right;">Asistencia</th>
                </tr>
              </thead>
              <tbody>
                ${tData.alumnosEnRiesgo.map(s => `
                  <tr>
                    <td><code>${s.id}</code></td>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.courseName} (${s.courseKey})</td>
                    <td class="val-danger" style="text-align: right;">${s.attendanceRate}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div style="margin-top: 35px; padding: 15px; border: 1px solid #dcfce7; border-radius: 8px; background-color: #f0fdf4; color: #16a34a; font-weight: 600; font-size: 13px; text-align: center; page-break-inside: avoid;">
              ✔ No se reportan alumnos en riesgo en las asignaturas asignadas a este docente.
            </div>
          `}

          <div class="footer">RinoAsist - Reporte Oficial de Dirección de Carrera</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportTeacherReport = (teacherDetail) => {
    if (!teacherDetail || !teacherDetail.data) return;
    const tData = teacherDetail.data;
    const tName = teacherDetail.name;
    const tEmail = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.correo || 'N/A';
    const tShift = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.turno || 'N/A';
    const tAvg = tData.grupos.length > 0 
      ? Math.round(tData.grupos.reduce((acc, g) => acc + g.asistencia_promedio, 0) / tData.grupos.length)
      : 85;

    let htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Reporte Docente</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; }
            th { background-color: #0052cc; color: #ffffff; font-family: Arial, sans-serif; font-size: 11pt; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; padding: 8px; }
            td { font-family: Arial, sans-serif; font-size: 10pt; border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
            .title-row { font-size: 14pt; font-weight: bold; color: #0052cc; font-family: Arial, sans-serif; }
            .section-title { font-size: 12pt; font-weight: bold; color: #0052cc; background-color: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; }
            .meta-row { font-size: 9pt; color: #64748b; font-style: italic; font-family: Arial, sans-serif; }
            .val-good { color: #15803d; font-weight: bold; background-color: #dcfce7; text-align: right; }
            .val-warning { color: #b45309; font-weight: bold; background-color: #fef3c7; text-align: right; }
            .val-danger { color: #b91c1c; font-weight: bold; background-color: #fee2e2; text-align: right; }
            .bar-cell { font-family: 'Courier New', monospace; letter-spacing: -1px; text-align: left; font-weight: bold; color: #0052cc; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="6" class="title-row" style="border: none;">REPORTE INDIVIDUAL DEL DOCENTE</td>
            </tr>
            <tr>
              <td colspan="6" class="meta-row" style="border: none;">Docente: ${tName} | Correo: ${tEmail} | Turno: ${tShift} | Asistencia General: ${tAvg}% | Generado: ${new Date().toLocaleString()}</td>
            </tr>
            <tr><td colspan="6" style="border: none;"></td></tr>
            
            <tr>
              <td colspan="6" class="section-title">GRUPOS ASIGNADOS Y RENDIMIENTO</td>
            </tr>
            <thead>
              <tr>
                <th>Grupo / Clave</th>
                <th>Materia</th>
                <th>Horario</th>
                <th>Alumnos Inscritos</th>
                <th>Tasa Asistencia</th>
                <th>Gráfico de Barras</th>
              </tr>
            </thead>
            <tbody>
      `;

    tData.grupos.forEach(g => {
      const val = g.asistencia_promedio;
      const gClass = val >= 85 ? 'val-good' : val >= 80 ? 'val-warning' : 'val-danger';
      const gBar = '■'.repeat(Math.round(val / 10)) + '□'.repeat(10 - Math.round(val / 10));
      htmlContent += `
        <tr>
          <td><strong>${g.key}</strong></td>
          <td>${g.name}</td>
          <td>${g.schedule}</td>
          <td style="text-align: right;">${g.totalStudents}</td>
          <td class="${gClass}">${val}%</td>
          <td class="bar-cell">${gBar}</td>
        </tr>
      `;
    });

    if (tData.asistencia_desglose) {
      htmlContent += `
        <tr><td colspan="6" style="border: none;"></td></tr>
        <tr>
          <td colspan="6" class="section-title">DISTRIBUCIÓN DE REGISTROS DE ASISTENCIA</td>
        </tr>
        <tr style="background-color: #0052cc; color: white;">
          <th colspan="2">Estatus</th>
          <th colspan="2">Porcentaje</th>
          <th colspan="2">Gráfico de Barras</th>
        </tr>
        <tr>
          <td colspan="2">Asistencias Puntuales</td>
          <td colspan="2" class="val-good">${tData.asistencia_desglose.asistieron}%</td>
          <td colspan="2" class="bar-cell" style="color: #16a34a;">${'■'.repeat(Math.round(tData.asistencia_desglose.asistieron / 10)) + '□'.repeat(10 - Math.round(tData.asistencia_desglose.asistieron / 10))}</td>
        </tr>
        <tr>
          <td colspan="2">Retardos (Tolerancia)</td>
          <td colspan="2" class="val-warning">${tData.asistencia_desglose.retardos}%</td>
          <td colspan="2" class="bar-cell" style="color: #d97706;">${'■'.repeat(Math.round(tData.asistencia_desglose.retardos / 10)) + '□'.repeat(10 - Math.round(tData.asistencia_desglose.retardos / 10))}</td>
        </tr>
        <tr>
          <td colspan="2">Inasistencias (Faltas)</td>
          <td colspan="2" class="val-danger">${tData.asistencia_desglose.faltas}%</td>
          <td colspan="2" class="bar-cell" style="color: #dc2626;">${'■'.repeat(Math.round(tData.asistencia_desglose.faltas / 10)) + '□'.repeat(10 - Math.round(tData.asistencia_desglose.faltas / 10))}</td>
        </tr>
        <tr>
          <td colspan="2">Faltas Justificadas</td>
          <td colspan="2" style="background-color: #e0f2fe; color: #0369a1; font-weight: bold; text-align: right;">${tData.asistencia_desglose.justificados}%</td>
          <td colspan="2" class="bar-cell" style="color: #0284c7;">${'■'.repeat(Math.round(tData.asistencia_desglose.justificados / 10)) + '□'.repeat(10 - Math.round(tData.asistencia_desglose.justificados / 10))}</td>
        </tr>
      `;
    }

    if (tData.alumnosEnRiesgo && tData.alumnosEnRiesgo.length > 0) {
      htmlContent += `
        <tr><td colspan="6" style="border: none;"></td></tr>
        <tr>
          <td colspan="6" class="section-title" style="color: #b91c1c;">ALUMNOS EN RIESGO DE REPROBAR (ASISTENCIA < 80%)</td>
        </tr>
        <tr style="background-color: #fee2e2;">
          <th>Matrícula</th>
          <th colspan="2">Nombre Completo</th>
          <th colspan="2">Materia</th>
          <th>Asistencia</th>
        </tr>
      `;
      tData.alumnosEnRiesgo.forEach(s => {
        htmlContent += `
          <tr>
            <td><code>${s.id}</code></td>
            <td colspan="2">${s.name}</td>
            <td colspan="2">${isIntersemestral ? 'Intersemestral' : `${s.course || s.courseName || ''} (${s.groupKey || s.courseKey || ''})`}</td>
            <td class="val-danger" style="text-align: right;">${s.attendanceRate || s.rate || 0}%</td>
          </tr>
        `;
      });
    } else {
      htmlContent += `
        <tr><td colspan="6" style="border: none;"></td></tr>
        <tr>
          <td colspan="6" style="font-style: italic; color: #16a34a; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px;">✔ No se registran alumnos en riesgo en los grupos de este docente.</td>
        </tr>
      `;
    }

    htmlContent += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement("a");
    const safeName = tName.replace(/\s+/g, '_');
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Docente_${safeName}.xls`;
    link.click();
  };

  const handleLogout = () => {
    api.logout();
    navigate('/');
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [data, periodos, activePeriod] = await Promise.all([
          api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek }),
          api.getPeriodos().catch(() => []),
          api.getActivePeriod().catch(() => null)
        ]);
        setAdminData(data);
        setPeriodosList(periodos);
        if (activePeriod) {
          setSelectedImportPeriodoId(activePeriod.periodo_id.toString());
        } else if (periodos.length > 0) {
          setSelectedImportPeriodoId(periodos[0].periodo_id.toString());
        }
        if (data.docentes && data.docentes.length > 0) {
          setAdminSelectedTeacherId(data.docentes[0].docente_id);
        }
      } catch (err) {
        console.error("Error loading admin summary:", err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      const delayDebounceFn = setTimeout(() => {
        api.getAdminSummary({ search: adminSearch, shift: adminShift, week: selectedWeek })
          .then(data => {
            setAdminData(data);
            if (data.docentes && data.docentes.length > 0) {
              const stillExists = data.docentes.some(d => d.docente_id === adminSelectedTeacherId);
              if (!stillExists) {
                setAdminSelectedTeacherId(data.docentes[0].docente_id);
              }
            } else {
              setAdminSelectedTeacherId(null);
            }
          })
          .catch(err => console.error("Error loading filtered admin summary:", err));
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [adminSearch, adminShift, selectedWeek, loading]);

  useEffect(() => {
    if (!loading && adminSelectedTeacherId) {
      setLoadingTeacherDetail(true);
      api.getTeacherOverview(adminSelectedTeacherId, selectedWeek)
        .then(data => {
          const tName = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.docente || 'Docente';
          setAdminTeacherDetail({
            name: tName,
            data
          });
        })
        .catch(err => console.error("Error loading teacher overview details:", err))
        .finally(() => setLoadingTeacherDetail(false));
    } else {
      setAdminTeacherDetail(null);
    }
  }, [adminSelectedTeacherId, adminData?.docentes, selectedWeek, loading]);

  const loadAlumnosOverviewData = async () => {
    setLoadingAlumnosData(true);
    setLoadingDropRequests(true);
    try {
      const [data, options, dropRequests] = await Promise.all([
        api.getAlumnosOverview(),
        api.getAssignmentOptions(),
        api.adminGetDropRequests()
      ]);
      setAlumnosData(data);
      setAssignmentOptions(options);
      setAdminDropRequests(dropRequests);
    } catch (err) {
      console.error("Error loading alumnos overview data:", err);
    } finally {
      setLoadingAlumnosData(false);
      setLoadingDropRequests(false);
    }
  };

  useEffect(() => {
    if (!loading && activeTab === 'alumnos') {
      loadAlumnosOverviewData();
    }
  }, [activeTab, loading]);

  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const primaryChartColor = isDark ? '#3b82f6' : '#0052cc';
  const fontColor = isDark ? '#94a3b8' : '#64748b';

  if (loading || !adminData) {
    return (
      <div className="min-h-screen bg-bg-base text-txt-base flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-10 h-10 text-brand-primary animate-spin" />
        <span className="font-semibold text-txt-muted">Cargando panel de control...</span>
      </div>
    );
  }

  const handleLogoClick = () => {
    if (window.innerWidth < 768) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-bg-base text-txt-base flex flex-col md:flex-row theme-transition">
      
      {/* Mobile Header Bar */}
      <div className="md:hidden w-full bg-bg-surface border-b border-bdr-base p-4 flex justify-between items-center z-30 shrink-0 theme-transition">
        <div 
          onClick={handleLogoClick}
          className="flex items-center cursor-pointer select-none h-8"
        >
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
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden transition-all duration-300"
        />
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
          <div 
            onClick={handleLogoClick}
            className={`border-b border-bdr-base flex items-center theme-transition cursor-pointer hover:bg-bg-base/40 active:scale-[0.98] select-none h-20 transition-all duration-300 ${isSidebarCollapsed ? 'p-2 justify-center' : 'p-4 justify-start'}`}
          >
            <div className={`overflow-hidden transition-all duration-300 ease-in-out relative flex items-center shrink-0 ${isSidebarCollapsed ? 'w-16 h-16' : 'w-52 h-12'}`}>
              {(!isDark && isSidebarCollapsed) ? (
                <img 
                  src={rinoasistCollapsedLight} 
                  alt="RinoAsist Icon" 
                  className="h-full w-full object-contain animate-fadeIn"
                />
              ) : (
                <img 
                  src={isDark ? rinoasistBannerDark : rinoasistBanner} 
                  alt="RinoAsist Logo" 
                  className={isSidebarCollapsed 
                    ? "h-[46px] w-auto max-w-none absolute left-0 top-[9px] object-contain object-left" 
                    : "h-[46px] w-auto object-contain object-left"
                  }
                />
              )}
            </div>
          </div>

          <div className="p-5 border-b border-bdr-base bg-bg-base/30 theme-transition flex justify-center md:block">
            <div className="flex items-center gap-3">
              <div className="bg-brand-primary/10 text-brand-primary p-2.5 rounded-xl border border-brand-primary/20 font-bold text-lg shrink-0 w-11 h-11 flex items-center justify-center">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out flex flex-col justify-center ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-36 opacity-100 ml-1'}`}>
                <h4 className="font-bold text-sm truncate">{user.name}</h4>
                <span className="text-xs text-txt-muted capitalize block font-semibold mt-0.5 whitespace-nowrap">
                  🛡️ Administrador
                </span>
                <span className="text-[9px] text-brand-primary font-bold bg-brand-primary/10 border border-brand-primary/15 px-1.5 py-0.5 rounded mt-1.5 inline-block w-fit whitespace-nowrap">
                  Ciclo: {getSchoolCycle()}
                </span>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <div className={`text-[10px] font-bold text-txt-subtle uppercase tracking-widest px-3 mb-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'h-0 opacity-0 mb-0' : 'h-4 opacity-100'}`}>
              Panel principal
            </div>
            <button 
              onClick={() => {
                setActiveTab('resumen');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${
                activeTab === 'resumen'
                  ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                  : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'
              } ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>
                {isIntersemestral ? 'Control Intersemestral' : 'Resumen'}
              </span>
            </button>
            <button 
              onClick={() => {
                setActiveTab('docentes');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${
                activeTab === 'docentes'
                  ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                  : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'
              } ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>
                Docentes
              </span>
            </button>
            {!isIntersemestral && (
              <button 
                onClick={() => {
                  setActiveTab('alumnos');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${
                  activeTab === 'alumnos'
                    ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                    : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'
                } ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>
                  Alumnos
                </span>
              </button>
            )}
            {!isIntersemestral && (
              <button 
                onClick={() => {
                  setActiveTab('desersion');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${
                  activeTab === 'desersion'
                    ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                    : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'
                } ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>
                  Deserción
                </span>
              </button>
            )}
            <button 
              onClick={() => {
                setActiveTab('justificantes');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${
                activeTab === 'justificantes'
                  ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                  : 'hover:bg-bg-base/40 text-txt-muted hover:text-brand-primary border border-transparent'
              } ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-3'}`}>
                Justificantes
              </span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-bdr-base space-y-4 theme-transition">
          <button 
            onClick={handleLogout}
            className={`w-full bg-bg-base hover:bg-rose-500/10 text-txt-muted hover:text-rose-600 border border-bdr-base hover:border-rose-500/20 py-2.5 px-3 rounded-xl flex items-center font-semibold text-sm cursor-pointer transition-all ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-28 opacity-100 ml-2.5'}`}>
              Cerrar Sesión
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:p-10 space-y-8 overflow-y-auto">
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
                className="flex items-center gap-2.5 bg-bg-surface border border-bdr-base px-4 py-2 rounded-xl text-sm font-semibold text-txt-muted hover:text-brand-primary hover:border-brand-primary/30 theme-transition cursor-pointer"
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
          <div className={`absolute -inset-[1px] bg-gradient-to-r from-brand-primary/10 to-blue-500/10 rounded-3xl -z-10`}></div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4.5 flex-grow">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-tr from-brand-primary to-blue-500 rounded-full blur opacity-25 animate-pulse"></div>
              <img 
                src={roleAdmin} 
                alt="Role Icon" 
                className="relative w-20 h-20 object-contain drop-shadow-md" 
              />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">¡Hola de nuevo, {user.name.split(' ')[0]}!</h3>
              <p className="text-sm text-txt-muted max-w-md leading-relaxed">
                Aquí tienes un resumen global del rendimiento de asistencia de la institución.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-bg-surface/50 border border-bdr-base/60 p-3.5 rounded-2xl max-w-sm w-full lg:w-96 theme-transition hover:border-brand-primary/30 relative">
            <img src={rhinoMascot} alt="Rino" className="w-14 h-14 object-contain shrink-0 drop-shadow-md animate-pulse" />
            <div className="text-[11px] leading-relaxed font-semibold text-txt-muted text-left flex-grow">
              {getMascotMessage()}
            </div>
          </div>
        </div>

        {/* RENDER VIEWS */}
        <div className="space-y-8 animate-fadeIn">
          {activeTab === 'resumen' && (
            isIntersemestral ? (
              <div className="space-y-6 text-left">
                {/* KPIs Intersemestral */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider block mb-2">Materias Ofertadas</span>
                    <div className="text-3xl font-extrabold text-txt-base">{interClasses.length}</div>
                    <div className="text-[10px] text-txt-muted font-semibold mt-1">Materias de recursamiento en este ciclo</div>
                  </div>
                  <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider block mb-2">Total Alumnos Inscritos</span>
                    <div className="text-3xl font-extrabold text-txt-base">
                      {interClasses.reduce((acc, c) => acc + c.alumnos_inscritos, 0)}
                    </div>
                    <div className="text-[10px] text-txt-muted font-semibold mt-1">Alumnos recursando materias actualmente</div>
                  </div>
                  <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider block mb-2">Ocupación Promedio</span>
                    <div className="text-3xl font-extrabold text-txt-base">
                      {(() => {
                        const totalCupos = interClasses.reduce((acc, c) => acc + c.grupo_cupo, 0);
                        const totalInscritos = interClasses.reduce((acc, c) => acc + c.alumnos_inscritos, 0);
                        return totalCupos > 0 ? `${Math.round((totalInscritos / totalCupos) * 100)}%` : '0%';
                      })()}
                    </div>
                    <div className="text-[10px] text-txt-muted font-semibold mt-1">Eficiencia de cupos ocupados</div>
                  </div>
                </div>

                {/* Workspace grid layout */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                  
                  {/* Left Column: Clases Ofertadas */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="font-extrabold text-base">Materias Ofertadas</h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTempGroupClave('');
                            setTempGroupTurno('Matutino');
                            setTempGroupCupo(30);
                            setTempGroupSemestre(1);
                            setTempGroupError('');
                            setShowCreateTempGroupModal(true);
                          }}
                          className="text-emerald-500 hover:text-emerald-600 text-[10px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                          title="Crear un grupo temporal para recursamiento"
                        >
                          <span>+ Grupo Temporal</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setAdminSelectedTeacherId('');
                            setAdminTeacherDetail(null);
                            setSelectedDocenteIdForGroup('');
                            await handleAssignClassClick();
                          }}
                          className="text-brand-primary hover:text-brand-hover text-[10px] font-bold uppercase bg-brand-primary/10 border border-brand-primary/15 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                          title="Asignar una nueva materia y grupo a un docente"
                        >
                          Asignar Clase
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsImportModalOpen(true)}
                          className="text-brand-primary hover:text-brand-hover text-[10px] font-bold uppercase bg-brand-primary/10 border border-brand-primary/15 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                          title="Cargar horarios"
                        >
                          Cargar Excel
                        </button>
                        {interClasses.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllInterClasses}
                            className="text-rose-500 hover:text-rose-600 text-[10px] font-bold uppercase bg-rose-500/10 border border-rose-500/15 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                            title="Eliminar todos los horarios cargados"
                          >
                            Vaciar Todo
                          </button>
                        )}
                        <span className="text-[10px] font-bold text-txt-muted uppercase bg-bg-surface px-2 py-1 rounded-md border border-bdr-base">
                          {interClasses.length} clases
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {interClasses.length === 0 ? (
                        <div className="bg-bg-card border border-bdr-base rounded-2xl p-8 text-center text-txt-muted font-semibold flex flex-col items-center justify-center gap-3">
                          <span>No hay materias registradas para este periodo intersemestral.</span>
                          <button
                            type="button"
                            onClick={() => setIsImportModalOpen(true)}
                            className="bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer shadow-sm transition-all"
                          >
                            Cargar Horarios desde Excel
                          </button>
                        </div>
                      ) : (
                        interClasses.map((item) => {
                          const isSelected = selectedInterClassId === item.id;
                          const isEditing = editingCupoId === item.id;
                          const percent = (item.grupo_cupo && item.grupo_cupo > 0) ? Math.round((item.alumnos_inscritos / item.grupo_cupo) * 100) : 0;
                          let progressColor = "bg-emerald-500";
                          if (percent >= 90) progressColor = "bg-rose-500";
                          else if (percent >= 75) progressColor = "bg-amber-500";

                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                if (!isEditing) {
                                  setSelectedInterClassId(item.id);
                                }
                              }}
                              className={`p-4 rounded-2xl border transition-all duration-200 text-left relative overflow-hidden group cursor-pointer ${
                                isSelected 
                                  ? 'bg-brand-primary/5 border-brand-primary shadow-sm' 
                                  : 'bg-bg-card border-bdr-base hover:border-brand-primary/45 shadow-sm'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2 mb-1.5">
                                <div className="space-y-0.5">
                                  <h5 className="font-extrabold text-sm text-txt-base line-clamp-1 group-hover:text-brand-primary transition-colors">
                                    {isIntersemestral ? 'Intersemestral' : item.materia_nombre}
                                  </h5>
                                  <p className="text-[10px] font-bold text-txt-muted uppercase">
                                    {isIntersemestral ? 'Recursamiento' : `Materia: ${item.materia_clave} | Grupo: ${item.grupo_clave}`}
                                  </p>
                                </div>
                                {editingHorarioId === item.id ? (
                                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={editingHorarioValue}
                                      onChange={(e) => setEditingHorarioValue(e.target.value)}
                                      className="w-24 bg-bg-surface border border-brand-primary text-txt-base rounded-md px-1.5 py-0.5 outline-none text-[10px] font-semibold"
                                      placeholder="Lu 08:00-10:00"
                                      autoFocus
                                    />
                                    <button 
                                      onClick={() => handleSaveHorario(item.id)}
                                      className="bg-brand-primary hover:bg-brand-hover text-white px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer"
                                    >
                                      ✓
                                    </button>
                                    <button 
                                      onClick={() => setEditingHorarioId(null)}
                                      className="bg-bg-surface border border-bdr-base text-txt-muted px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/15 whitespace-nowrap">
                                      {item.horario}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingHorarioId(item.id);
                                        setEditingHorarioValue(item.horario || '');
                                      }}
                                      className="text-txt-muted hover:text-brand-primary transition-colors cursor-pointer text-xs"
                                      title="Editar horario"
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                )}
                              </div>

                              <p className="text-xs text-txt-subtle font-medium truncate mb-3">
                                👤 Docente: {item.docente_nombre}
                              </p>

                              {/* Capacity block */}
                              <div className="pt-2 border-t border-bdr-base/50 space-y-1.5">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                  <span className="text-txt-muted uppercase tracking-wider">Cupo y Alumnos</span>
                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="number"
                                        value={editingCupoValue}
                                        onChange={(e) => setEditingCupoValue(parseInt(e.target.value))}
                                        className="w-12 bg-bg-surface border border-brand-primary text-txt-base rounded-md px-1 py-0.5 outline-none text-center text-xs"
                                        min="1"
                                      />
                                      <button 
                                        onClick={() => handleSaveCupo(item.id)}
                                        className="bg-brand-primary hover:bg-brand-hover text-white px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer"
                                      >
                                        ✓
                                      </button>
                                      <button 
                                        onClick={() => setEditingCupoId(null)}
                                        className="bg-bg-surface border border-bdr-base text-txt-muted px-1.5 py-0.5 rounded text-[9px] font-bold cursor-pointer"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-txt-subtle">
                                        Inscritos: <strong className="text-txt-base">{item.alumnos_inscritos} / {item.grupo_cupo}</strong>
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingCupoId(item.id);
                                          setEditingCupoValue(item.grupo_cupo);
                                        }}
                                        className="text-txt-muted hover:text-brand-primary p-0.5 cursor-pointer rounded transition-colors hover:bg-bg-surface"
                                        title="Editar cupo límite"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteInterClass(item.id, item.materia_nombre);
                                        }}
                                        className="text-txt-subtle hover:text-rose-500 p-0.5 cursor-pointer rounded transition-colors hover:bg-rose-500/10 text-xs shrink-0 flex items-center justify-center"
                                        title="Eliminar materia de intersemestral"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="w-full bg-bg-surface h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${progressColor} transition-all duration-300`} 
                                    style={{ width: `${Math.min(percent, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Students Enrollment */}
                  <div className="lg:col-span-3 space-y-4">
                    {selectedInterClassId ? (
                      (() => {
                        const currentClass = interClasses.find(c => c.id === selectedInterClassId);
                        if (!currentClass) return null;

                        const isFull = currentClass.alumnos_inscritos >= currentClass.grupo_cupo;

                        return (
                          <>
                            <div className="flex justify-between items-center px-1">
                              <h4 className="font-extrabold text-base">Alumnos Inscritos</h4>
                              <span className="text-[10px] font-bold text-txt-muted uppercase bg-bg-surface px-2 py-1 rounded-md border border-bdr-base">
                                {isIntersemestral ? 'Intersemestral' : `${currentClass.materia_nombre} (${currentClass.grupo_clave})`}
                              </span>
                            </div>

                            <div className="bg-bg-card border border-bdr-base rounded-2xl p-6 shadow-sm space-y-5 text-left theme-transition">
                              
                              {/* Quick Enrollment search */}
                              <div className="space-y-1.5 relative">
                                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                                  Inscribir Nuevo Alumno
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder={isFull ? "La clase está llena. Aumenta el cupo para inscribir." : "Buscar alumno por nombre, matrícula o correo..."}
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                    disabled={isFull}
                                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary disabled:opacity-50 text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                                  />
                                </div>

                                {/* Autocomplete Results */}
                                {studentSearchResults.length > 0 && (
                                  <div className="absolute left-0 right-0 mt-1 bg-bg-card border border-bdr-base rounded-xl shadow-xl z-30 py-1.5 max-h-48 overflow-y-auto theme-transition">
                                    {studentSearchResults.map((alumno) => (
                                      <button
                                        key={alumno.id}
                                        type="button"
                                        onClick={() => handleEnrollStudent(alumno)}
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-bg-surface flex justify-between items-center transition-colors cursor-pointer"
                                      >
                                        <div className="space-y-0.5">
                                          <p className="font-bold text-txt-base">{alumno.name}</p>
                                          <p className="text-[10px] text-txt-muted">Matrícula: {alumno.matricula} | Correo: {alumno.email}</p>
                                        </div>
                                        <span className="text-[10px] text-brand-primary font-bold hover:underline">
                                          Inscribir
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Enrolled Students list */}
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                                  Lista de Clase ({interStudents.length} alumnos)
                                </label>

                                {interStudents.length === 0 ? (
                                  <div className="border border-dashed border-bdr-base rounded-2xl p-8 text-center text-txt-muted font-medium text-xs">
                                    No hay alumnos inscritos en este recursamiento todavía.
                                  </div>
                                ) : (
                                  <div className="border border-bdr-base rounded-2xl overflow-hidden bg-bg-surface/10">
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="border-b border-bdr-base bg-bg-surface/30">
                                            <th className="p-3 font-bold text-txt-muted uppercase tracking-wider text-[10px]">Matrícula</th>
                                            <th className="p-3 font-bold text-txt-muted uppercase tracking-wider text-[10px]">Nombre</th>
                                            <th className="p-3 font-bold text-txt-muted uppercase tracking-wider text-[10px]">Correo</th>
                                            <th className="p-3 font-bold text-txt-muted uppercase tracking-wider text-[10px] text-center">Acciones</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-bdr-base/40">
                                          {interStudents.map((student) => (
                                            <tr key={student.id} className="hover:bg-bg-surface/20 transition-colors">
                                              <td className="p-3 font-semibold text-txt-base"><code>{student.matricula}</code></td>
                                              <td className="p-3 font-bold text-txt-base">{student.nombre}</td>
                                              <td className="p-3 font-medium text-txt-subtle">{student.correo}</td>
                                              <td className="p-3 text-center">
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeregisterStudent(student.id)}
                                                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 p-1.5 rounded-lg cursor-pointer transition-colors"
                                                  title="Desvincular alumno"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>

                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div className="bg-bg-card border border-bdr-base rounded-2xl p-12 text-center text-txt-muted font-semibold flex flex-col items-center justify-center gap-3">
                        <Layers className="w-10 h-10 text-txt-subtle" />
                        <span>Selecciona una materia ofertada de la izquierda para ver su lista de estudiantes e inscribir alumnos.</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ) : (
              <>
                {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Asistencia Promedio</span>
                    <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
                      <UserCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base">{adminData.kpis.avgAttendance}</div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-450 font-semibold mt-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>+0.5% esta semana</span>
                  </div>
                </div>

                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Alumnos en Riesgo</span>
                    <div className="bg-rose-500/10 text-rose-600 dark:text-rose-450 p-1.5 rounded-lg border border-rose-500/10">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base">{adminData.kpis.atRisk}</div>
                  <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-455 font-semibold mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-rose-500" />
                    <span>Tienen asistencia &lt; 80%</span>
                  </div>
                </div>

                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Grupos Activos</span>
                    <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base">{adminData.kpis.activeGroups}</div>
                  <div className="text-[10px] text-txt-subtle font-semibold mt-1.5">
                    Conexión directa a BD
                  </div>
                </div>

                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Alumnos Totales</span>
                    <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base">{adminData.kpis.totalStudents}</div>
                  <div className="text-[10px] text-txt-subtle font-semibold mt-1.5">
                    Inscritos en el ciclo actual
                  </div>
                </div>
              </div>

              {/* Filters & Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition">
                <div>
                  <h3 className="text-lg font-bold">Monitoreo Detallado por Semestre (ISC)</h3>
                  <p className="text-txt-muted text-xs mt-0.5">Reporte consolidado de pases de lista por materias de cada grupo y semestre.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3.5 w-full sm:w-auto">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-xs font-bold text-txt-muted whitespace-nowrap">Turno:</label>
                    <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 theme-transition">
                      {[
                        { id: 'all', label: 'Todos' },
                        { id: 'Matutino', label: 'Matutino' },
                        { id: 'Vespertino', label: 'Vespertino' }
                      ].map((shift) => (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => setAdminShift(shift.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none ${
                            adminShift === shift.id
                              ? 'bg-brand-primary text-white shadow-sm'
                              : 'text-txt-muted hover:text-brand-primary'
                          }`}
                        >
                          {shift.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-xs font-bold text-txt-muted whitespace-nowrap">Semana:</label>
                    <select 
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs font-semibold cursor-pointer theme-transition w-full sm:w-44"
                    >
                      {adminData.weeks?.map((w) => (
                        <option key={w.id} value={w.id}>{w.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Semester Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.keys(adminData.semesterDetailedData || {}).map((semesterName) => {
                  const semInfo = adminData.semesterDetailedData[semesterName];
                  const isExpanded = !!expandedSemesters[semesterName];
                  
                  return (
                    <div 
                      key={semesterName} 
                      className={`bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-5 theme-transition ${
                        isExpanded ? 'lg:col-span-2' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center flex-wrap gap-3">
                        <div>
                          <h4 className="font-extrabold text-base text-txt-base">{semesterName} Semestre</h4>
                          <span className="text-[10px] text-txt-subtle font-bold uppercase tracking-wider block mt-0.5">
                            ISC - Promedio General: <span className="text-brand-primary">{semInfo.average}%</span>
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center border border-bdr-base rounded-xl bg-bg-surface overflow-hidden shrink-0 theme-transition">
                            <button
                              onClick={() => handleExportSemester(semesterName, 'pdf')}
                              className="p-1.5 px-2 hover:bg-brand-primary/10 text-[9px] font-bold text-brand-primary border-r border-bdr-base cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleExportSemester(semesterName, 'excel')}
                              className="p-1.5 px-2 hover:bg-emerald-600/10 text-[9px] font-bold text-emerald-650 dark:text-emerald-500 cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all"
                            >
                              EXCEL
                            </button>
                          </div>
                          
                          <button
                            onClick={() => toggleSemesterExpand(semesterName)}
                            className="p-1.5 px-3 border border-bdr-base bg-bg-surface hover:border-brand-primary/45 hover:text-brand-primary rounded-xl text-txt-muted flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all select-none"
                          >
                            <span>{isExpanded ? 'Ocultar' : 'Ver Grupos'}</span>
                            <ChevronDown className={`w-4 h-4 text-txt-subtle transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="md:col-span-2 h-48 w-full text-[10px]">
                          <span className="text-[10px] font-bold text-txt-subtle uppercase tracking-wider block mb-1">
                            Historial Diario del Semestre
                          </span>
                          <ResponsiveContainer width="100%" height="100%" debounce={150}>
                            <AreaChart data={semInfo.generalDaily} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`colorSemester-${semesterName.replace(' ', '')}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={primaryChartColor} stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor={primaryChartColor} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="2 2" stroke={gridColor} />
                              <XAxis dataKey="day" stroke={fontColor} tickLine={false} />
                              <YAxis domain={[0, 100]} stroke={fontColor} tickLine={false} />
                              <Tooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="Asistencia" stroke={primaryChartColor} strokeWidth={2} fillOpacity={1} fill={`url(#colorSemester-${semesterName.replace(' ', '')})`} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="space-y-3 bg-bg-surface/50 border border-bdr-base/40 p-4 rounded-xl theme-transition">
                          <span className="text-[10px] font-bold text-txt-subtle uppercase tracking-wider block">
                            Promedios de Grupo
                          </span>
                          <div className="space-y-2">
                            {semInfo.groups.map((g) => (
                              <div key={g.name} className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-txt-muted">{g.name}</span>
                                <span className={`font-bold ${g.average < 80 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {g.average}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Collapsible breakdown */}
                      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
                        isExpanded 
                          ? 'max-h-[1400px] opacity-100 mt-4 pt-4 border-t border-bdr-base/60' 
                          : 'max-h-0 opacity-0 pointer-events-none'
                      }`}>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2 space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                              <h5 className="font-bold text-sm text-txt-base">Gráficas de Asistencia por Grupo</h5>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {semInfo.groups.map((group) => (
                                <div key={group.name} className="bg-bg-surface border border-bdr-base/50 p-4 rounded-xl flex flex-col justify-between space-y-3 theme-transition text-left">
                                  <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                      <span className="font-extrabold text-xs text-txt-base">{group.name}</span>
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <button 
                                          onClick={() => handleExportGroup(semesterName, group, 'pdf')}
                                          className="text-[9px] font-semibold text-brand-primary hover:underline cursor-pointer"
                                        >
                                          PDF
                                        </button>
                                        <span className="text-[9px] text-txt-subtle">•</span>
                                        <button 
                                          onClick={() => handleExportGroup(semesterName, group, 'excel')}
                                          className="text-[9px] font-semibold text-emerald-650 dark:text-emerald-500 hover:underline cursor-pointer"
                                        >
                                          Excel
                                        </button>
                                      </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                      group.average < 80 
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20' 
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20'
                                    }`}>
                                      {group.average}%
                                    </span>
                                  </div>

                                  <div className="h-28 w-full text-[9px]">
                                    <ResponsiveContainer width="100%" height="100%" debounce={150}>
                                      <BarChart data={group.daily} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="1 1" stroke={gridColor} />
                                        <XAxis dataKey="day" stroke={fontColor} tickLine={false} />
                                        <YAxis domain={[0, 100]} stroke={fontColor} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="Asistencia" radius={[3, 3, 0, 0]}>
                                          {group.daily.map((entry, index) => {
                                            const val = entry.Asistencia;
                                            const color = val >= 85 ? '#10b981' : val >= 80 ? '#f59e0b' : '#ef4444';
                                            return <Cell key={`bcell-${index}`} fill={color} />;
                                          })}
                                        </Bar>
                                      </BarChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Subject Breakdown */}
                          <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-sm theme-transition">
                            <div>
                              <h5 className="font-extrabold text-sm text-txt-base">Rendimiento por Materia</h5>
                              <p className="text-[10px] text-txt-muted mt-0.5">Consolidado general del semestre ordenado de mayor a menor asistencia.</p>
                            </div>

                            <div className="h-44 w-full text-[9px]">
                              <ResponsiveContainer width="100%" height="100%" debounce={150}>
                                <BarChart 
                                  data={[...(semInfo.subjects || [])].sort((a, b) => b.attendanceRate - a.attendanceRate)} 
                                  layout="vertical"
                                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                                >
                                  <CartesianGrid strokeDasharray="1 1" stroke={gridColor} />
                                  <XAxis type="number" domain={[0, 100]} stroke={fontColor} tickLine={false} />
                                  <YAxis type="category" dataKey="name" stroke={fontColor} width={40} tickFormatter={(name) => name.substring(0, 5) + '...'} tickLine={false} />
                                  <Tooltip content={<CustomTooltip />} />
                                  <Bar dataKey="attendanceRate" fill={primaryChartColor} radius={[0, 3, 3, 0]} barSize={10}>
                                    {(semInfo.subjects || []).map((entry, index) => {
                                      const rate = entry.attendanceRate;
                                      const color = rate < 80 ? '#f43f5e' : rate < 85 ? '#f59e0b' : '#10b981';
                                      return <Cell key={`mcell-${index}`} fill={color} />;
                                    })}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>

                            <div className="space-y-2 flex-grow max-h-60 overflow-y-auto pr-1">
                              {[...(semInfo.subjects || [])]
                                .sort((a, b) => b.attendanceRate - a.attendanceRate)
                                .map((sub, sIdx) => (
                                  <div key={sIdx} className="flex justify-between items-center text-xs border-b border-bdr-base/40 pb-1.5">
                                    <span className="font-medium text-txt-muted truncate max-w-[180px]" title={sub.name}>{sub.name}</span>
                                    <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                      sub.attendanceRate < 80 
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455' 
                                        : sub.attendanceRate < 85 
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-450' 
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450'
                                    }`}>
                                      {sub.attendanceRate}%
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Consolidated Section */}
              <div className="grid lg:grid-cols-3 gap-6 mt-8">
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl lg:col-span-2 space-y-4 shadow-sm theme-transition text-left">
                  <div>
                    <h3 className="text-lg font-bold">Histórico de Asistencia Diaria</h3>
                    <p className="text-txt-muted text-xs mt-0.5">Reporte del comportamiento de asistencia durante la última semana escolar.</p>
                  </div>
                  <div className="h-72 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%" debounce={150}>
                      <AreaChart data={adminData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAsistencia" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryChartColor} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={primaryChartColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="name" stroke={fontColor} />
                        <YAxis stroke={fontColor} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area type="monotone" dataKey="Asistencia" stroke={primaryChartColor} strokeWidth={2} fillOpacity={1} fill="url(#colorAsistencia)" />
                        <Area type="monotone" dataKey="Faltas" stroke="#f43f5e" strokeWidth={1} fill="none" strokeDasharray="4 4" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl flex flex-col justify-between shadow-sm theme-transition text-left">
                  <div>
                    <h3 className="text-lg font-bold mb-1">Porcentaje por Grupo</h3>
                    <p className="text-txt-muted text-xs mb-6">Comparativa de los grupos en el semestre en curso.</p>
                  </div>
                  <div className="space-y-4 flex-grow">
                    {adminData.attendanceByGroup.map((item, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-txt-muted">{item.grupo}</span>
                          <span className="font-bold text-brand-primary">{item.rate}%</span>
                        </div>
                        <div className="w-full bg-bg-surface border border-bdr-base/50 rounded-full h-2 theme-transition">
                          <div 
                            className="bg-gradient-to-r from-brand-primary to-blue-500 h-2 rounded-full" 
                            style={{ width: `${item.rate}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-bdr-base/60 mt-5 pt-5 space-y-3.5">
                    <div>
                      <h4 className="text-xs font-bold text-txt-base uppercase tracking-wider">Reportes Administrativos</h4>
                      <p className="text-txt-subtle text-[10px] mt-0.5 leading-normal">Exporta el resumen escolar consolidado de la semana elegida en formato oficial.</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={handleExportPDF}
                        disabled={exportingPDF || exportingExcel}
                        className="py-2 px-2.5 border border-brand-primary hover:bg-brand-primary/5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 text-brand-primary theme-transition"
                      >
                        {exportingPDF ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        <span>{exportingPDF ? 'Generando...' : 'Ficha PDF'}</span>
                      </button>
                      <button
                        onClick={handleExportExcel}
                        disabled={exportingPDF || exportingExcel}
                        className="py-2 px-2.5 border border-emerald-600 hover:bg-emerald-600/5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 text-emerald-650 dark:text-emerald-500 theme-transition"
                      >
                        {exportingExcel ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{exportingExcel ? 'Generando...' : 'Hoja Excel'}</span>
                      </button>
                    </div>

                    {exportSuccessMessage && (
                      <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-450 p-2.5 rounded-xl text-[10px] font-bold text-center animate-fadeIn theme-transition">
                        {exportSuccessMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) )}

          {activeTab === 'docentes' && (
            <>
              {/* Teacher Search */}
              <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center theme-transition text-left">
                <div className="flex-grow space-y-1">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Buscar Docente (ISC)</label>
                  <input 
                    type="text"
                    value={adminSearch}
                    onChange={(e) => setAdminSearch(e.target.value)}
                    placeholder="Buscar docente por nombre o correo..."
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto shrink-0">
                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block mb-1">Filtrar por Turno</label>
                    <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 theme-transition w-full sm:w-auto self-start">
                      {[
                        { id: 'all', label: 'Todos' },
                        { id: 'Matutino', label: 'Matutino' },
                        { id: 'Vespertino', label: 'Vespertino' }
                      ].map((shift) => (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => setAdminShift(shift.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none ${
                            adminShift === shift.id
                              ? 'bg-brand-primary text-white shadow-sm'
                              : 'text-txt-muted hover:text-brand-primary'
                          }`}
                        >
                          {shift.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {isIntersemestral && (
                    <div 
                      className="flex items-center gap-2 select-none cursor-pointer self-end pb-2 h-10" 
                      onClick={() => setShowAllTeachersInInter(!showAllTeachersInInter)}
                    >
                      <input 
                        type="checkbox" 
                        checked={showAllTeachersInInter} 
                        onChange={() => {}} // Handled by parent div
                        className="rounded border-bdr-base text-brand-primary focus:ring-brand-primary w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-txt-muted hover:text-txt-base transition-colors">Ver plantilla completa</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Docentes Grid */}
              <div className="space-y-4 text-left">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-extrabold text-xl">Docentes Registrados</h3>
                    <span className="text-xs font-semibold text-txt-muted">{displayedDocentes.length || 0} profesores en carrera</span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => setIsImportModalOpen(true)}
                      className="bg-bg-surface border border-bdr-base hover:border-brand-primary/30 text-txt-base hover:text-brand-primary font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm hover:scale-[1.02] transition-all cursor-pointer theme-transition"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-brand-primary" />
                      <span>Cargar Horarios</span>
                    </button>
                    <button 
                      onClick={handleCreateTeacherClick} 
                      className="bg-brand-primary hover:bg-brand-hover text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all cursor-pointer theme-transition"
                    >
                      <Users className="w-4 h-4" />
                      <span>Registrar Docente</span>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedDocentes.map((docente) => {
                    const isSelected = adminSelectedTeacherId === docente.docente_id;
                    return (
                      <div 
                        key={docente.docente_id}
                        onClick={() => setAdminSelectedTeacherId(docente.docente_id)}
                        className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer text-left relative overflow-hidden group hover:scale-[1.01] ${
                          isSelected 
                            ? 'bg-brand-primary/5 border-brand-primary shadow-md' 
                            : 'bg-bg-card border-bdr-base hover:border-brand-primary/45 shadow-sm'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 right-0 w-8 h-8 bg-brand-primary text-white flex items-center justify-center rounded-bl-xl font-bold">
                            ✓
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          {getTeacherAvatar(docente.docente, 'md')}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-base truncate pr-2 text-txt-base">{docente.docente}</h4>
                            <p className="text-xs text-txt-subtle mt-0.5 truncate">{docente.correo}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-bdr-base/60">
                          <div>
                            <span className="text-[10px] text-txt-subtle uppercase block font-semibold">Grupos</span>
                            <span className="text-sm font-bold text-txt-base">{docente.grupos}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-txt-subtle uppercase block font-semibold">Turno</span>
                            <span className="text-sm font-bold text-brand-primary">{docente.turno}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-txt-subtle uppercase block font-semibold">Asistencia</span>
                            <span className="text-sm font-bold text-emerald-500">{docente.asistencia_promedio}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!displayedDocentes || displayedDocentes.length === 0) && (
                    <p className="text-txt-subtle text-sm col-span-full">No se encontraron docentes con los criterios ingresados.</p>
                  )}
                </div>
              </div>

              {/* Selected Teacher Details */}
              {adminSelectedTeacherId && adminTeacherDetail && (
                <div className="border-t border-bdr-base pt-8 space-y-8 animate-fadeIn text-left">
                  <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col md:flex-row gap-5 items-center justify-between theme-transition text-left w-full">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      {getTeacherAvatar(adminTeacherDetail.name, 'lg')}
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold text-brand-primary uppercase tracking-widest bg-brand-primary/10 border border-brand-primary/20 px-2.5 py-0.5 rounded-md">Docente ISC</span>
                        <h3 className="text-2xl font-extrabold tracking-tight mt-0.5 text-txt-base">{adminTeacherDetail.name}</h3>
                        <p className="text-xs text-txt-muted font-semibold">{adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.correo}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                      <label className="text-xs font-bold text-txt-muted whitespace-nowrap">Semana:</label>
                      <select 
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs font-semibold cursor-pointer theme-transition w-36"
                      >
                        {adminData.weeks?.map((w) => (
                          <option key={w.id} value={w.id}>{w.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {loadingTeacherDetail ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition animate-pulse flex items-center gap-4">
                            <div className="h-12 w-12 bg-bg-surface rounded-xl"></div>
                            <div className="space-y-2 flex-grow">
                              <div className="h-3 w-16 bg-bg-surface rounded-md"></div>
                              <div className="h-5 w-24 bg-bg-surface rounded-md"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex items-center gap-4 theme-transition">
                          <div className="p-3.5 bg-brand-primary/10 text-brand-primary rounded-xl shrink-0">
                            <Clock className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-txt-subtle uppercase block font-bold tracking-wider">Estatus Actual</span>
                            {(() => {
                              const liveClass = getLiveClass(adminTeacherDetail.data?.grupos);
                              const hasPending = adminTeacherDetail.data?.cumplimiento?.some(c => c.estado === 'Pendiente');
                              if (liveClass) {
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                                    <span className="text-xs font-bold text-emerald-500">En Clase Ahora</span>
                                  </div>
                                );
                              } else if (hasPending) {
                                return (
                                  <div className="flex items-center gap-1 text-rose-500">
                                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse shrink-0" />
                                    <span className="text-xs font-bold">Falta Pase de Lista</span>
                                  </div>
                                );
                              } else {
                                return <span className="text-xs font-bold text-txt-muted block">Sin clase en curso</span>;
                              }
                            })()}
                            <span className="text-xs font-semibold text-txt-subtle block">
                              Turno: {adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.turno || 'Matutino'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex items-center gap-4 theme-transition">
                          <div className="p-3.5 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0">
                            <Calendar className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] text-txt-subtle uppercase block font-bold tracking-wider">Cumplimiento Pases Lista</span>
                            {(() => {
                              const totalListTakes = adminTeacherDetail.data?.cumplimiento?.length || 8;
                              const completedListTakes = adminTeacherDetail.data?.cumplimiento?.filter(c => c.estado === 'Completado').length || 8;
                              const compliancePct = Math.round((completedListTakes / totalListTakes) * 100);
                              return (
                                <>
                                  <div className="text-lg font-extrabold text-txt-base">{compliancePct}%</div>
                                  <span className="text-xs font-semibold text-txt-muted block">
                                    {completedListTakes} de {totalListTakes} clases registradas
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div 
                          onClick={() => {
                            const riskCount = adminTeacherDetail.data?.alumnosEnRiesgo?.length || 0;
                            if (riskCount > 0) setShowRiskModal(true);
                          }}
                          className={`p-5 rounded-2xl border flex items-center gap-4 shadow-sm transition-all duration-300 theme-transition ${
                            (adminTeacherDetail.data?.alumnosEnRiesgo?.length || 0) > 0 
                              ? 'bg-rose-500/5 border-rose-500/35 hover:bg-rose-500/10 cursor-pointer hover:scale-[1.01]' 
                              : 'bg-bg-card border-bdr-base'
                          }`}
                        >
                          <div className={`p-3.5 rounded-xl shrink-0 ${
                            (adminTeacherDetail.data?.alumnosEnRiesgo?.length || 0) > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                          <div className="space-y-1 flex-1">
                            <span className="text-[10px] text-txt-subtle uppercase block font-bold tracking-wider">Alumnos en Riesgo</span>
                            {(() => {
                              const riskCount = adminTeacherDetail.data?.alumnosEnRiesgo?.length || 0;
                              return (
                                <>
                                  <div className={`text-lg font-extrabold ${riskCount > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`}>
                                    {riskCount} Alumnos
                                  </div>
                                  {riskCount > 0 ? (
                                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-455 hover:underline flex items-center gap-1 cursor-pointer">
                                      Ver alumnos en riesgo ➔
                                    </span>
                                  ) : (
                                    <span className="text-xs font-semibold text-txt-muted block">Todos arriba del 80%</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Live Banner */}
                      {(() => {
                        const activeGrp = getLiveClass(adminTeacherDetail.data?.grupos);
                        if (activeGrp) {
                          return (
                            <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-pulse theme-transition text-left">
                              <div className="flex items-center gap-2.5">
                                <span className="w-3.5 h-3.5 bg-emerald-500 rounded-full shrink-0 flex items-center justify-center">
                                  <span className="w-2 h-2 bg-white rounded-full"></span>
                                </span>
                                <div className="text-xs">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-450 block sm:inline mr-1">EN CURSO AHORA:</span>
                                  <span className="font-semibold text-txt-base">{activeGrp.name} ({activeGrp.key})</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider bg-bg-surface px-2.5 py-1 rounded-xl border border-bdr-base theme-transition shrink-0">
                                Horario: {activeGrp.schedule}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Teacher detailed lists & panels */}
                      <div className="grid lg:grid-cols-3 gap-6 items-start text-left">
                        <div className="lg:col-span-2 space-y-6">
                          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition">
                            <div className="flex justify-between items-center pb-2 border-b border-bdr-base/50">
                              <h4 className="font-extrabold text-lg">Grupos Asignados y Rendimiento</h4>
                              <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 rounded-lg">
                                {adminTeacherDetail.data?.grupos?.length || 0} Grupos
                              </span>
                            </div>
                            
                            <div className="space-y-4">
                              {adminTeacherDetail.data?.grupos?.map((grupo) => (
                                <div key={grupo.id} className="p-4 rounded-xl border border-bdr-base bg-bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 theme-transition">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-txt-base">
                                        {isIntersemestral ? 'Intersemestral' : grupo.name}
                                      </span>
                                      {!isIntersemestral && (
                                        <span className="text-[10px] font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.2 rounded border border-brand-primary/20">
                                          {grupo.key}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 text-xs text-txt-muted">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-txt-subtle" />
                                        Horario: {grupo.schedule}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-txt-subtle" />
                                        Inscritos: {grupo.totalStudents} alumnos
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 w-full sm:w-auto self-stretch sm:self-auto justify-between sm:justify-end">
                                    <div className="text-right space-y-1">
                                      <span className="text-xs text-txt-subtle block font-semibold">Tasa Asistencia</span>
                                      <span className="text-base font-extrabold text-emerald-500 block leading-none">{grupo.asistencia_promedio}%</span>
                                    </div>
                                    
                                    <button 
                                      onClick={() => handleUnassignClass(grupo.id, grupo.name)}
                                      className="p-2 border border-bdr-base text-txt-subtle hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center shadow-sm hover:scale-105"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {(!adminTeacherDetail.data?.grupos || adminTeacherDetail.data?.grupos.length === 0) && (
                                <p className="text-txt-subtle text-sm">Este docente no tiene grupos activos.</p>
                              )}
                            </div>
                          </div>

                          {/* Weekly Timetable Grid */}
                          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                <h4 className="font-extrabold text-lg">Distribución de Horario Semanal</h4>
                                <p className="text-xs text-txt-muted mt-0.5">Visualización y edición interactiva de la agenda de clases del docente.</p>
                              </div>
                              {isEditingSchedule ? (
                                <div className="flex items-center gap-2 select-none">
                                  <button
                                    type="button"
                                    onClick={handleCancelChanges}
                                    className="px-4 py-2 border border-bdr-base hover:bg-bg-surface text-txt-subtle rounded-xl text-xs font-semibold cursor-pointer transition-all select-none"
                                  >
                                    Cancelar Cambios
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveChanges}
                                    disabled={savingScheduleChanges}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 transition-all select-none"
                                  >
                                    {savingScheduleChanges ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    )}
                                    <span>Guardar Cambios</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleStartEditing}
                                  className="px-4 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 transition-all select-none"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Editar Horario</span>
                                </button>
                              )}
                            </div>

                            {isEditingSchedule && (
                              <div className="bg-brand-primary/5 border border-brand-primary/20 p-4 rounded-xl flex items-start gap-2.5 text-xs text-brand-primary font-medium theme-transition">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="font-bold">Modo Edición Activado (Cambios sin guardar)</p>
                                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-txt-muted">
                                    <li>Haz <strong>doble clic en una celda vacía</strong> para asignar una materia rápido.</li>
                                    <li>Haz <strong>doble clic en una materia</strong> para editar su horario o desvincularla.</li>
                                    <li><strong>Arrastra una materia</strong> a otra celda para reubicarla.</li>
                                    <li>Mantén presionado y <strong>arrastra la línea inferior</strong> de una materia para ajustar su duración.</li>
                                  </ul>
                                </div>
                              </div>
                            )}

                            {/* Calendar CSS Grid */}
                            {(() => {
                              const teacherShift = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.turno || 'Matutino';
                              const currentGrupos = isEditingSchedule ? editableGrupos : (adminTeacherDetail.data?.grupos || []);
                              const { hours: visibleHours, minHour } = getVisibleHours(currentGrupos, teacherShift);
                              const DAYS_OF_WEEK = [
                                { key: 'Lunes', label: 'Lunes', colIndex: 2 },
                                { key: 'Martes', label: 'Martes', colIndex: 3 },
                                { key: 'Miércoles', label: 'Miércoles', colIndex: 4 },
                                { key: 'Jueves', label: 'Jueves', colIndex: 5 },
                                { key: 'Viernes', label: 'Viernes', colIndex: 6 }
                              ];

                              return (
                                <div className="border border-bdr-base rounded-2xl overflow-hidden bg-bg-surface/30 theme-transition select-none">
                                  {/* Grid Container */}
                                  <div 
                                    className="grid grid-cols-6"
                                    style={{
                                      gridTemplateColumns: '70px repeat(5, minmax(0, 1fr))'
                                    }}
                                  >
                                    {/* Header Row */}
                                    <div className="text-[10px] font-bold text-txt-muted text-center py-2.5 bg-bg-surface border-b border-r border-bdr-base uppercase tracking-wider flex items-center justify-center">
                                      Hora
                                    </div>
                                    {DAYS_OF_WEEK.map(d => (
                                      <div 
                                        key={d.key} 
                                        className="text-[10px] font-bold text-txt-muted text-center py-2.5 bg-bg-surface border-b border-r border-bdr-base last:border-r-0 uppercase tracking-wider flex items-center justify-center"
                                      >
                                        {d.label}
                                      </div>
                                    ))}

                                    {/* Background Grid Cells */}
                                    {visibleHours.map((h) => {
                                      const startRow = h - minHour + 2;
                                      const timeLabel = `${String(h).padStart(2, '0')}:00`;
                                      
                                      return (
                                        <React.Fragment key={h}>
                                          {/* Time Label Column */}
                                          <div 
                                            className="text-[10px] font-bold text-txt-muted flex items-center justify-center border-b border-r border-bdr-base bg-bg-surface/20 h-[68px]"
                                            style={{ gridRow: startRow, gridColumn: 1 }}
                                          >
                                            {timeLabel}
                                          </div>
                                          
                                          {/* Days Columns */}
                                          {DAYS_OF_WEEK.map(d => (
                                            <div 
                                              key={d.key}
                                              className={`border-b border-r border-bdr-base last:border-r-0 h-[68px] transition-colors ${
                                                isEditingSchedule ? 'hover:bg-brand-primary/5 cursor-pointer' : ''
                                              }`}
                                              style={{ gridRow: startRow, gridColumn: d.colIndex }}
                                              onDragOver={handleDragOver}
                                              onDrop={(e) => handleDrop(e, d.key, h)}
                                              onDoubleClick={() => handleCellDoubleClick(d.key, h)}
                                            />
                                          ))}
                                        </React.Fragment>
                                      );
                                    })}

                                    {/* Foreground Class Cards */}
                                    {getTeacherBlocks(currentGrupos).map((cls) => {
                                      const dayObj = DAYS_OF_WEEK.find(d => d.key === cls.day);
                                      if (!dayObj) return null;

                                      const startRow = cls.startHour - minHour + 2;
                                      const isResizingThis = resizingData && resizingData.blockId === cls.blockId;
                                      const duration = isResizingThis ? resizingData.currentDuration : cls.duration;

                                      // Skip drawing if outside our calculated rows
                                      if (cls.startHour < minHour) return null;

                                      return (
                                        <div
                                          key={cls.blockId}
                                          className={`group relative m-1 p-2 rounded-xl border flex flex-col justify-between shadow-sm transition-all overflow-hidden ${
                                            isEditingSchedule 
                                              ? 'border-brand-primary/30 bg-brand-primary/10 hover:border-brand-primary/50 cursor-grab active:cursor-grabbing' 
                                              : 'border-brand-primary/20 bg-brand-primary/5'
                                          }`}
                                          style={{
                                            gridColumn: dayObj.colIndex,
                                            gridRow: `${startRow} / span ${duration}`,
                                            zIndex: 10,
                                            minHeight: `${duration * 68 - 8}px`
                                          }}
                                          draggable={isEditingSchedule}
                                          onDragStart={(e) => handleDragStart(e, cls)}
                                          onDoubleClick={(e) => handleCardDoubleClick(e, cls)}
                                        >
                                          <div className="flex flex-col gap-1 select-none">
                                            <div className="flex items-start justify-between gap-1">
                                              <span className="text-[11px] font-extrabold leading-tight block break-words line-clamp-3 text-left text-txt-base group-hover:text-brand-primary transition-colors" title={isIntersemestral ? 'Intersemestral' : cls.name}>
                                                {isIntersemestral ? 'Intersemestral' : cls.name}
                                              </span>
                                              
                                              {isEditingSchedule && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => handleCardDoubleClick(e, cls)}
                                                  className="p-0.5 bg-bg-card border border-bdr-base rounded hover:text-brand-primary cursor-pointer transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center shrink-0"
                                                >
                                                  <Edit className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-[9px] select-none shrink-0 border-t border-brand-primary/10 pt-1.5 mt-1.5">
                                            {!isIntersemestral && (
                                              <span className="font-bold bg-brand-primary/15 text-brand-primary px-1.5 py-0.5 rounded border border-brand-primary/25 shrink-0 w-max">{cls.key}</span>
                                            )}
                                            <span className="text-txt-muted font-bold whitespace-nowrap">
                                              {cls.startHour}:00 - {cls.startHour + duration}:00
                                            </span>
                                          </div>

                                          {/* Resize Handle */}
                                          {isEditingSchedule && (
                                            <div 
                                              className="absolute bottom-0 left-0 right-0 h-2 bg-transparent hover:bg-brand-primary/30 cursor-ns-resize transition-all flex items-center justify-center"
                                              onMouseDown={(e) => handleResizeMouseDown(e, cls)}
                                              title="Arrastra para cambiar la duración"
                                            >
                                              <div className="w-6 h-0.5 bg-brand-primary/30 rounded-full hover:bg-brand-primary/70" />
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Compliance timeline */}
                          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition">
                            <div>
                              <h4 className="font-extrabold text-lg">Calendario de Cumplimiento</h4>
                              <p className="text-xs text-txt-muted mt-0.5">Seguimiento en tiempo real de los pases de lista registrados en las últimas clases programadas.</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                              {adminTeacherDetail.data?.cumplimiento?.map((classSession) => {
                                const isCompleted = classSession.estado === 'Completado';
                                const dateFormatted = new Date(classSession.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                                  day: 'numeric',
                                  month: 'short'
                                });
                                return (
                                  <div 
                                    key={classSession.id} 
                                    className={`p-3 rounded-xl border flex flex-col justify-between h-20 transition-all duration-300 theme-transition ${
                                      isCompleted 
                                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-450' 
                                        : 'bg-amber-500/5 border-amber-500/35 text-amber-600 dark:text-amber-550'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start text-[10px] font-bold">
                                      <span className="text-txt-muted">{dateFormatted}</span>
                                      <span className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="text-xs font-bold text-txt-base block truncate" title={classSession.materia}>{classSession.materia}</span>
                                      <div className="flex justify-between items-center text-[9px] text-txt-muted">
                                        <span>Grupo {classSession.grupo}</span>
                                        <span className={`font-extrabold uppercase ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-550'}`}>
                                          {isCompleted ? 'Registró' : 'Faltante'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {(!adminTeacherDetail.data?.cumplimiento || adminTeacherDetail.data?.cumplimiento.length === 0) && (
                                <p className="text-txt-subtle text-xs col-span-full">No se registran clases calendarizadas recientemente.</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Column details */}
                        <div className="space-y-6">
                          {adminTeacherDetail.data?.asistencia_desglose && (
                            <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition text-left">
                              <div>
                                <h4 className="font-extrabold text-lg">Distribución de Registros</h4>
                                <p className="text-xs text-txt-muted mt-0.5">Desglose porcentual de los estados marcados en lista.</p>
                              </div>

                              <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-txt-muted">Asistencias Puntuales</span>
                                    <span className="text-emerald-500 font-bold">{adminTeacherDetail.data.asistencia_desglose.asistieron}%</span>
                                  </div>
                                  <div className="w-full bg-bg-surface border border-bdr-base/40 rounded-full h-1.5 theme-transition">
                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${adminTeacherDetail.data.asistencia_desglose.asistieron}%` }}></div>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-txt-muted">Retardos (Tolerancia)</span>
                                    <span className="text-amber-500 font-bold">{adminTeacherDetail.data.asistencia_desglose.retardos}%</span>
                                  </div>
                                  <div className="w-full bg-bg-surface border border-bdr-base/40 rounded-full h-1.5 theme-transition">
                                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${adminTeacherDetail.data.asistencia_desglose.retardos}%` }}></div>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-txt-muted">Inasistencias (Faltas)</span>
                                    <span className="text-rose-500 font-bold">{adminTeacherDetail.data.asistencia_desglose.faltas}%</span>
                                  </div>
                                  <div className="w-full bg-bg-surface border border-bdr-base/40 rounded-full h-1.5 theme-transition">
                                    <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${adminTeacherDetail.data.asistencia_desglose.faltas}%` }}></div>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-txt-muted">Faltas Justificadas</span>
                                    <span className="text-brand-primary font-bold">{adminTeacherDetail.data.asistencia_desglose.justificados}%</span>
                                  </div>
                                  <div className="w-full bg-bg-surface border border-bdr-base/40 rounded-full h-1.5 theme-transition">
                                    <div className="bg-brand-primary h-1.5 rounded-full" style={{ width: `${adminTeacherDetail.data.asistencia_desglose.justificados}%` }}></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Quick Actions Panel */}
                          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition text-left">
                            <h4 className="font-extrabold text-lg">Acciones Rápidas de Control</h4>
                            <div className="flex flex-col gap-2.5">
                              <button
                                onClick={handleAssignClassClick}
                                className="w-full py-2.5 px-4 bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                              >
                                <BookOpen className="w-4 h-4" />
                                Asignar Nueva Asignatura
                              </button>
                              <button 
                                onClick={handleEditTeacherClick}
                                className="w-full py-2.5 px-4 bg-bg-surface border border-bdr-base hover:border-brand-primary/45 text-txt-base hover:text-brand-primary text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Users className="w-4 h-4 text-txt-subtle" />
                                Editar Datos Personales
                              </button>
                              <button 
                                onClick={() => handleSendReminder(adminTeacherDetail.name)}
                                className="w-full py-2.5 px-4 bg-bg-surface border border-bdr-base hover:border-brand-primary/45 text-txt-base hover:text-brand-primary text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Mail className="w-4 h-4 text-txt-subtle" />
                                Enviar Alerta de Pase Lista
                              </button>
                              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-bdr-base/60">
                                <button
                                  onClick={() => handleExportTeacherPDF(adminTeacherDetail)}
                                  className="py-2 px-3 border border-bdr-base hover:bg-brand-primary/5 rounded-xl text-[10px] font-bold cursor-pointer text-brand-primary flex items-center justify-center gap-1 transition-all"
                                >
                                  Ficha PDF
                                </button>
                                <button
                                  onClick={() => handleExportTeacherReport(adminTeacherDetail)}
                                  className="py-2 px-3 border border-bdr-base hover:bg-emerald-600/5 rounded-xl text-[10px] font-bold cursor-pointer text-emerald-650 dark:text-emerald-500 flex items-center justify-center gap-1 transition-all"
                                >
                                  Excel XLS
                                </button>
                              </div>
                              <button 
                                onClick={() => handleDeleteTeacher(adminSelectedTeacherId, adminTeacherDetail.name)}
                                className="w-full py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 hover:text-rose-700 border border-rose-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Dar de Baja Docente
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'alumnos' && (
            <div className="space-y-6 text-left">
              <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-grow">
                  <h3 className="font-extrabold text-2xl">Gestión de Alumnos y Grupos</h3>
                  <p className="text-xs font-semibold text-txt-muted mt-1">
                    Administra e invita alumnos al sistema, y gestiona las materias y horarios correspondientes a cada grupo.
                  </p>
                </div>
                <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 theme-transition shrink-0">
                  {[
                    { id: 'invitaciones', label: 'Invitaciones y Alumnos' },
                    { id: 'materias', label: 'Asignar Materias' },
                    { id: 'bajas', label: 'Solicitudes de Baja' }
                  ].map((subTab) => (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={() => setAlumnosSubTab(subTab.id)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer select-none relative ${
                        alumnosSubTab === subTab.id
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'text-txt-muted hover:text-brand-primary'
                      }`}
                    >
                      <span>{subTab.label}</span>
                      {subTab.id === 'bajas' && adminDropRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-bg-card animate-pulse"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {alumnosSubTab === 'invitaciones' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                  <div className="lg:col-span-4 bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4 h-fit">
                    <div>
                      <h4 className="font-bold text-lg text-txt-base">Invitar Nuevo Alumno</h4>
                      <p className="text-[11px] text-txt-muted mt-0.5">
                        El alumno recibirá un correo para completar su registro en el grupo asignado.
                      </p>
                    </div>

                    <form onSubmit={handleSendStudentInvitation} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Número de Control / Correo
                        </label>
                        <div className="flex items-center bg-bg-surface border border-bdr-base focus-within:border-brand-primary rounded-xl overflow-hidden theme-transition">
                          <input
                            type="text"
                            required
                            value={inviteStudentEmail}
                            onChange={(e) => setInviteStudentEmail(e.target.value)}
                            placeholder="ej: 223107422"
                            className="flex-1 bg-transparent text-txt-base px-4 py-2.5 outline-none text-sm"
                          />
                          <span className="bg-bg-card border-l border-bdr-base text-txt-muted px-4 py-2.5 text-xs select-none font-bold font-mono theme-transition">
                            @cuautitlan.tecnm.mx
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Filtrar por Semestre (Grupo)
                        </label>
                        <select
                          value={inviteGroupSemesterFilter}
                          onChange={(e) => {
                            setInviteGroupSemesterFilter(e.target.value);
                            setSelectedGroupIdForInvite('');
                          }}
                          className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                        >
                          <option value="all">Todos los Semestres</option>
                          {Array.from({ length: 9 }, (_, i) => String(i + 1)).map(sem => (
                            <option key={sem} value={sem}>{sem}° Semestre</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Filtrar por Turno (Grupo)
                        </label>
                        <select
                          value={inviteGroupShiftFilter}
                          onChange={(e) => {
                            setInviteGroupShiftFilter(e.target.value);
                            setSelectedGroupIdForInvite('');
                          }}
                          className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                        >
                          <option value="all">Todos los Turnos</option>
                          <option value="Matutino">Matutino</option>
                          <option value="Vespertino">Vespertino</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Grupo a Asignar
                        </label>
                        <select
                          required
                          value={selectedGroupIdForInvite}
                          onChange={(e) => setSelectedGroupIdForInvite(e.target.value)}
                          className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                        >
                          <option value="">Selecciona un grupo...</option>
                          {filteredGroupsForInvite.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.clave} - {g.turno} ({g.semestre}° Sem)
                            </option>
                          ))}
                        </select>
                      </div>

                      {inviteError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>{inviteError}</span>
                        </div>
                      )}

                      {inviteSuccess && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 text-xs rounded-xl flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>¡Invitación enviada con éxito!</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={sendingInvite || !selectedGroupIdForInvite || !inviteStudentEmail}
                        className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none"
                      >
                        {sendingInvite ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            <span>Enviar Invitación</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-8 flex flex-col space-y-6 animate-fadeIn">
                    <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h4 className="font-bold text-lg text-txt-base">Alumnos Registrados</h4>
                          <p className="text-xs font-semibold text-txt-muted">
                            {filteredAlumnos.length} de {alumnosData.alumnos?.length || 0} alumnos activos
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <select
                            value={alumnosSemesterFilter}
                            onChange={(e) => {
                              setAlumnosSemesterFilter(e.target.value);
                              setAlumnosGroupFilter('all');
                            }}
                            className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                          >
                            <option value="all">Semestre: Todos</option>
                            {Array.from({ length: 9 }, (_, i) => String(i + 1)).map(sem => (
                              <option key={sem} value={sem}>{sem}° Semestre</option>
                            ))}
                          </select>
                          <select
                            value={alumnosGroupFilter}
                            onChange={(e) => setAlumnosGroupFilter(e.target.value)}
                            className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                          >
                            <option value="all">Grupo: Todos</option>
                            {groupOptionsForAlumnos.map(g => (
                              <option key={g.id} value={g.clave}>{g.clave}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={alumnosSearchQuery}
                            onChange={(e) => setAlumnosSearchQuery(e.target.value)}
                            placeholder="Buscar alumno..."
                            className="w-full sm:w-36 bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs theme-transition"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider">
                              <th className="py-3 px-4">Nombre Completo</th>
                              <th className="py-3 px-4">No. Control</th>
                              <th className="py-3 px-4">Correo</th>
                              <th className="py-3 px-4 text-center">Semestre</th>
                              <th className="py-3 px-4 text-center">Grupo Clave</th>
                              <th className="py-3 px-4 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-bdr-base/40 text-xs">
                            {loadingAlumnosData ? (
                              <tr>
                                <td colSpan="6" className="py-8 text-center text-txt-muted">
                                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                                  <span>Cargando alumnos...</span>
                                </td>
                              </tr>
                            ) : filteredAlumnos.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="py-8 text-center text-txt-muted italic">
                                  No se encontraron alumnos registrados.
                                </td>
                              </tr>
                            ) : (
                              filteredAlumnos.map(al => (
                                <tr key={al.id} className="hover:bg-bg-surface/30 theme-transition">
                                  <td className="py-3.5 px-4 font-semibold text-txt-base">{al.nombre}</td>
                                  <td className="py-3.5 px-4 text-txt-subtle font-mono">{al.matricula}</td>
                                  <td className="py-3.5 px-4 text-txt-muted">{al.correo}</td>
                                  <td className="py-3.5 px-4 text-center font-bold text-txt-subtle">{al.semestre}°</td>
                                  <td className="py-3.5 px-4 text-center">
                                    <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary font-bold rounded-lg text-[10px] border border-brand-primary/20">
                                      {al.grupo_clave || 'Sin Grupo'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleEditAlumnoClick(al)}
                                        className="p-1 text-txt-muted hover:text-brand-primary rounded-lg hover:bg-brand-primary/10 transition-all cursor-pointer"
                                        title="Editar alumno"
                                      >
                                        <Edit className="w-4.5 h-4.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteAlumno(al.id, al.nombre)}
                                        className="p-1 text-txt-muted hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                                        title="Dar de baja alumno"
                                      >
                                        <UserX className="w-4.5 h-4.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h4 className="font-bold text-lg text-txt-base">Historial y Estatus de Invitaciones</h4>
                          <p className="text-xs font-semibold text-txt-muted">
                            {filteredInvitations.length} de {alumnosData.invitaciones?.length || 0} invitaciones totales
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                           <select
                             value={invitationsSemesterFilter}
                             onChange={(e) => {
                               setInvitationsSemesterFilter(e.target.value);
                               setInvitationsGroupFilter('all');
                             }}
                             className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                           >
                             <option value="all">Semestre: Todos</option>
                             {Array.from({ length: 9 }, (_, i) => String(i + 1)).map(sem => (
                               <option key={sem} value={sem}>{sem}° Semestre</option>
                             ))}
                           </select>
                           <select
                             value={invitationsGroupFilter}
                             onChange={(e) => setInvitationsGroupFilter(e.target.value)}
                             className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                           >
                             <option value="all">Grupo: Todos</option>
                             {groupOptionsForInvitations.map(g => (
                               <option key={g.id} value={g.clave}>{g.clave}</option>
                             ))}
                           </select>
                          <select
                            value={invitationsStatusFilter}
                            onChange={(e) => setInvitationsStatusFilter(e.target.value)}
                            className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                          >
                            <option value="all">Estatus: Todos</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="aceptada">Aceptada</option>
                            <option value="expirada">Expirada</option>
                          </select>
                          <input
                            type="text"
                            value={invitationsSearchQuery}
                            onChange={(e) => setInvitationsSearchQuery(e.target.value)}
                            placeholder="Buscar invitación..."
                            className="w-full sm:w-36 bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs theme-transition"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider">
                              <th className="py-3 px-4">Correo Destinatario</th>
                              <th className="py-3 px-4">Grupo Asignado</th>
                              <th className="py-3 px-4 text-center">Fecha Envío</th>
                              <th className="py-3 px-4 text-center">Expiración</th>
                              <th className="py-3 px-4 text-center">Estatus</th>
                              <th className="py-3 px-4 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-bdr-base/40 text-xs">
                            {loadingAlumnosData ? (
                              <tr>
                                <td colSpan="6" className="py-8 text-center text-txt-muted">
                                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                                  <span>Cargando historial...</span>
                                </td>
                              </tr>
                            ) : filteredInvitations.length === 0 ? (
                              <tr>
                                <td colSpan="6" className="py-8 text-center text-txt-muted italic">
                                  No hay invitaciones registradas.
                                </td>
                              </tr>
                            ) : (
                              filteredInvitations.map(inv => {
                                const isExpired = new Date(inv.expires_at) < new Date() && inv.estatus === 'Pendiente';
                                const displayStatus = isExpired ? 'Expirada' : inv.estatus;
                                
                                let badgeClass = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
                                if (displayStatus === 'Aceptada' || displayStatus === 'aceptada') badgeClass = "bg-green-500/10 text-green-500 border-green-500/20";
                                if (displayStatus === 'Expirada' || displayStatus === 'expirada') badgeClass = "bg-red-500/10 text-red-500 border-red-500/20";

                                return (
                                  <tr key={inv.id} className="hover:bg-bg-surface/30 theme-transition">
                                    <td className="py-3.5 px-4 font-semibold text-txt-base">{inv.correo}</td>
                                    <td className="py-3.5 px-4 font-semibold text-brand-primary">{inv.grupo_clave}</td>
                                    <td className="py-3.5 px-4 text-center text-txt-muted">
                                      {new Date(inv.creado_en).toLocaleDateString()}
                                    </td>
                                    <td className="py-3.5 px-4 text-center text-txt-muted">
                                      {new Date(inv.expires_at).toLocaleDateString()}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                      <span className={`px-2.5 py-1 border rounded-full font-bold text-[9px] uppercase tracking-wider ${badgeClass}`}>
                                        {displayStatus}
                                      </span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                      {inv.estatus.toLowerCase() !== 'aceptada' && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteInvitation(inv.id, inv.correo)}
                                          className="p-1 text-txt-muted hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                                          title="Cancelar invitación"
                                        >
                                          <Trash2 className="w-4.5 h-4.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {alumnosSubTab === 'materias' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
                  <div className="lg:col-span-4 bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4 h-fit">
                    <div>
                      <h4 className="font-bold text-lg text-txt-base">Asignar Materia a Grupo</h4>
                      <p className="text-[11px] text-txt-muted mt-0.5">
                        Asigna una materia y un docente a un grupo específico. Todos los alumnos registrados en el grupo serán inscritos automáticamente.
                      </p>
                    </div>

                    <form onSubmit={handleSaveGroupAssignment} className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                            Semestre (Filtro)
                          </label>
                          <select
                            value={assignGroupSemesterFilter}
                            onChange={(e) => {
                              setAssignGroupSemesterFilter(e.target.value);
                              setSelectedGroupIdForMateria('');
                            }}
                            className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-2 outline-none text-xs theme-transition cursor-pointer"
                          >
                            <option value="all">Todos</option>
                            {Array.from({ length: 9 }, (_, i) => String(i + 1)).map(sem => (
                              <option key={sem} value={sem}>{sem}° Semestre</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                            Turno (Filtro)
                          </label>
                          <select
                            value={assignGroupShiftFilter}
                            onChange={(e) => {
                              setAssignGroupShiftFilter(e.target.value);
                              setSelectedGroupIdForMateria('');
                            }}
                            className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-2 outline-none text-xs theme-transition cursor-pointer"
                          >
                            <option value="all">Todos</option>
                            <option value="Matutino">Matutino</option>
                            <option value="Vespertino">Vespertino</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Seleccionar Grupo
                        </label>
                        <select
                          required
                          value={selectedGroupIdForMateria}
                          onChange={(e) => setSelectedGroupIdForMateria(e.target.value)}
                          className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                        >
                          <option value="">Selecciona un grupo...</option>
                          {filteredGroupsForAssign.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.clave} - {g.turno} ({g.semestre}° Sem)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Seleccionar Materia
                        </label>
                        <select
                          required
                          value={selectedMateriaIdForGroup}
                          onChange={(e) => setSelectedMateriaIdForGroup(e.target.value)}
                          className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                        >
                          <option value="">Selecciona una materia...</option>
                          {assignmentOptions.materias?.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.clave} - {m.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Seleccionar Docente
                        </label>
                        <select
                          required
                          value={selectedDocenteIdForGroup}
                          onChange={(e) => setSelectedDocenteIdForGroup(e.target.value)}
                          className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                        >
                          <option value="">Selecciona un docente...</option>
                          {assignmentOptions.docentes?.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.nombre} ({d.turno})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Calendario de Horarios (Días)
                        </label>
                        {!selectedGroupIdForMateria ? (
                          <div className="p-4 bg-bg-surface/50 border border-bdr-base rounded-xl text-center text-xs text-txt-muted italic">
                            Selecciona un grupo para habilitar el calendario de horarios.
                          </div>
                        ) : (
                          <div className="space-y-3 animate-fadeIn">
                            {(() => {
                              const getSelectedHoursForDay = (dayKey) => {
                                const daySlots = selectedScheduleSlots.filter(s => s.day === dayKey).map(s => s.hour).sort((a, b) => a - b);
                                if (daySlots.length === 0) return 'Sin asignar';
                                const blocks = [];
                                let start = daySlots[0];
                                let prev = daySlots[0];
                                for (let i = 1; i < daySlots.length; i++) {
                                  if (daySlots[i] === prev + 1) {
                                    prev = daySlots[i];
                                  } else {
                                    blocks.push(`${start}-${prev + 1}`);
                                    start = daySlots[i];
                                    prev = daySlots[i];
                                  }
                                }
                                blocks.push(`${start}-${prev + 1}`);
                                return blocks.join('/');
                              };
                              
                              return (
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    { key: 'Lu', label: 'Lunes' },
                                    { key: 'Ma', label: 'Martes' },
                                    { key: 'Mi', label: 'Miércoles' },
                                    { key: 'Ju', label: 'Jueves' },
                                    { key: 'Vi', label: 'Viernes' },
                                    { key: 'Sa', label: 'Sábado' }
                                  ].map(day => {
                                    const isDayActive = activeScheduleDay === day.key;
                                    const hoursText = getSelectedHoursForDay(day.key);
                                    const hasHours = hoursText !== 'Sin asignar';
                                    return (
                                      <button
                                        key={day.key}
                                        type="button"
                                        onClick={() => setActiveScheduleDay(day.key)}
                                        className={`p-2 rounded-xl border text-left transition-all relative cursor-pointer outline-none select-none flex flex-col justify-between h-14 ${
                                          isDayActive 
                                            ? 'bg-brand-primary/10 border-brand-primary ring-2 ring-brand-primary/25 shadow-md shadow-brand-primary/5' 
                                            : 'bg-bg-surface border-bdr-base hover:border-brand-primary/40'
                                        }`}
                                      >
                                        <span className="text-[10px] font-bold uppercase tracking-wider block text-txt-muted">{day.label}</span>
                                        <span className={`text-[9.5px] font-extrabold truncate block mt-1 ${hasHours ? 'text-brand-primary' : 'text-txt-subtle'}`}>
                                          {hoursText}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            <div className="bg-bg-surface/30 border border-bdr-base rounded-2xl p-4 space-y-3 theme-transition">
                              <div className="flex justify-between items-center border-b border-bdr-base/60 pb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-brand-primary"></span>
                                  <h5 className="text-[11px] font-extrabold uppercase tracking-widest text-txt-base">
                                    Configurar Horario - {
                                      activeScheduleDay === 'Lu' ? 'Lunes' : 
                                      activeScheduleDay === 'Ma' ? 'Martes' : 
                                      activeScheduleDay === 'Mi' ? 'Miércoles' : 
                                      activeScheduleDay === 'Ju' ? 'Jueves' : 
                                      activeScheduleDay === 'Vi' ? 'Viernes' : 'Sábado'
                                    }
                                  </h5>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const activeDayConflicts = conflictSlots.filter(s => s.day === activeScheduleDay).map(s => s.hour);
                                      const activeDayFreeSlots = hoursToShow.filter(h => !activeDayConflicts.includes(h));
                                      setSelectedScheduleSlots(prev => {
                                        const otherDays = prev.filter(s => s.day !== activeScheduleDay);
                                        const activeDaySelected = prev.filter(s => s.day === activeScheduleDay);
                                        if (activeDaySelected.length === activeDayFreeSlots.length) {
                                          return otherDays;
                                        } else {
                                          return [...otherDays, ...activeDayFreeSlots.map(h => ({ day: activeScheduleDay, hour: h }))];
                                        }
                                      });
                                    }}
                                    className="text-[9px] font-bold text-brand-primary hover:underline"
                                  >
                                    Seleccionar todo
                                  </button>
                                  <span className="text-txt-subtle text-[9px]">•</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedScheduleSlots(prev => prev.filter(s => s.day !== activeScheduleDay));
                                    }}
                                    className="text-[9px] font-bold text-rose-500 hover:underline"
                                  >
                                    Limpiar
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {hoursToShow.map(hour => {
                                  const timeLabel = `${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`;
                                  const conflict = conflictSlots.find(s => s.day === activeScheduleDay && s.hour === hour);
                                  const isSelected = selectedScheduleSlots.some(s => s.day === activeScheduleDay && s.hour === hour);
                                  
                                  if (conflict) {
                                    return (
                                      <div
                                        key={hour}
                                        className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-[9.5px] font-semibold cursor-not-allowed select-none relative group/slot text-center"
                                        title={conflict.reason}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          <span>{timeLabel}</span>
                                          <span className="text-[8px] bg-rose-500 text-white px-1 py-0.2 rounded font-extrabold">Ocupado</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <button
                                      key={hour}
                                      type="button"
                                      onClick={() => toggleScheduleSlot(activeScheduleDay, hour)}
                                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs select-none active:scale-[0.98] ${
                                        isSelected 
                                          ? 'bg-brand-primary border-brand-primary text-white shadow-md shadow-brand-primary/10' 
                                          : 'bg-bg-surface border-bdr-base text-txt-muted hover:border-brand-primary/45 hover:text-brand-primary'
                                      }`}
                                    >
                                      {timeLabel}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                          Horario Seleccionado
                        </label>
                        <input
                          type="text"
                          readOnly
                          required
                          value={groupAssignmentSchedule}
                          placeholder="Selecciona horas en el calendario..."
                          className="w-full bg-bg-surface/50 border border-bdr-base text-txt-muted rounded-xl px-4 py-2.5 outline-none text-xs theme-transition font-mono cursor-not-allowed"
                        />
                      </div>

                      {groupAssignmentError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>{groupAssignmentError}</span>
                        </div>
                      )}

                      {groupAssignmentSuccess && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 text-xs rounded-xl flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>¡Materia asignada con éxito!</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={savingGroupAssignment || !selectedGroupIdForMateria || !selectedMateriaIdForGroup || !selectedDocenteIdForGroup || !groupAssignmentSchedule}
                        className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none animate-pulse-subtle"
                      >
                        {savingGroupAssignment ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Guardando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Asignar Asignatura</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  <div className="lg:col-span-8 bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4 h-fit">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="font-bold text-lg text-txt-base">Materias Asignadas por Grupo</h4>
                        <p className="text-xs font-semibold text-txt-muted">
                          {filteredAssignments.length} asignaciones totales encontradas
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <select
                          value={groupAssignmentSemesterFilter}
                          onChange={(e) => {
                            setGroupAssignmentSemesterFilter(e.target.value);
                            setGroupAssignmentFilter('all');
                          }}
                          className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                        >
                          <option value="all">Semestre: Todos</option>
                          {Array.from({ length: 9 }, (_, i) => String(i + 1)).map(sem => (
                            <option key={sem} value={sem}>{sem}° Semestre</option>
                          ))}
                        </select>
                        <select
                          value={groupAssignmentFilter}
                          onChange={(e) => setGroupAssignmentFilter(e.target.value)}
                          className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                        >
                          <option value="all">Grupo: Todos</option>
                          {groupOptionsForAssignments.map(g => (
                            <option key={g.id} value={g.id}>{g.clave}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={assignmentSearchQuery}
                          onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                          placeholder="Buscar asignación..."
                          className="w-full sm:w-36 bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs theme-transition"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider">
                            <th className="py-3 px-4 text-center">Semestre</th>
                            <th className="py-3 px-4">Grupo Clave</th>
                            <th className="py-3 px-4">Asignatura (Clave)</th>
                            <th className="py-3 px-4">Docente</th>
                            <th className="py-3 px-4">Horario</th>
                            <th className="py-3 px-4 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-bdr-base/40 text-xs">
                          {loadingAlumnosData ? (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-txt-muted">
                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                                <span>Cargando asignaciones...</span>
                              </td>
                            </tr>
                          ) : filteredAssignments.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-8 text-center text-txt-muted italic">
                                No se encontraron materias vinculadas a grupos.
                              </td>
                            </tr>
                          ) : (
                            filteredAssignments.map(asg => (
                              <tr key={asg.id} className="hover:bg-bg-surface/30 theme-transition">
                                <td className="py-3.5 px-4 text-center font-bold text-txt-subtle">{asg.semestre}°</td>
                                <td className="py-3.5 px-4 font-bold text-brand-primary">{asg.grupo_clave}</td>
                                <td className="py-3.5 px-4 font-semibold text-txt-base">
                                  {asg.materia_nombre}
                                  <span className="text-[10px] text-txt-muted block font-mono font-normal">{asg.materia_clave}</span>
                                </td>
                                <td className="py-3.5 px-4 text-txt-subtle">{asg.docente_nombre}</td>
                                <td className="py-3.5 px-4 text-txt-muted font-semibold">{asg.horario || 'Sin horario'}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    onClick={() => handleDeleteGroupAssignment(asg.id, asg.materia_nombre, asg.grupo_clave)}
                                    className="p-1.5 hover:bg-rose-500/10 text-txt-muted hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {alumnosSubTab === 'bajas' && (
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4 animate-fadeIn">
                  <div>
                    <h4 className="font-bold text-lg text-txt-base">Solicitudes de Baja de Materia</h4>
                    <p className="text-xs font-semibold text-txt-muted">
                      {adminDropRequests.length} solicitudes pendientes de revisión
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider">
                          <th className="py-3 px-4">Alumno</th>
                          <th className="py-3 px-4">Matrícula</th>
                          <th className="py-3 px-4">Materia</th>
                          <th className="py-3 px-4 text-center">Grupo</th>
                          <th className="py-3 px-4 text-center">Semestre</th>
                          <th className="py-3 px-4 text-center">Fecha Solicitud</th>
                          <th className="py-3 px-4 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bdr-base/40 text-xs">
                        {loadingDropRequests ? (
                          <tr>
                            <td colSpan="7" className="py-8 text-center text-txt-muted">
                              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                              <span>Cargando solicitudes...</span>
                            </td>
                          </tr>
                        ) : adminDropRequests.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="py-8 text-center text-txt-muted italic">
                              No hay solicitudes de baja pendientes.
                            </td>
                          </tr>
                        ) : (
                          adminDropRequests.map(req => (
                            <tr key={req.id} className="hover:bg-bg-surface/30 theme-transition">
                              <td className="py-3.5 px-4 font-semibold text-txt-base">{req.alumno_nombre}</td>
                              <td className="py-3.5 px-4 font-mono text-txt-subtle">{req.alumno_matricula}</td>
                              <td className="py-3.5 px-4 text-txt-base font-semibold">{req.materia_nombre}</td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="px-2.5 py-1 bg-brand-primary/10 text-brand-primary font-bold rounded-lg text-[10px] border border-brand-primary/20">
                                  {req.grupo_clave}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold text-txt-subtle">{req.grupo_semestre}°</td>
                              <td className="py-3.5 px-4 text-center text-txt-muted">
                                {new Date(req.creado_en).toLocaleDateString()}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleAdminApproveDropRequest(req.id, req.alumno_nombre, req.materia_nombre)}
                                    className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Aprobar
                                  </button>
                                  <button
                                    onClick={() => handleAdminRejectDropRequest(req.id, req.alumno_nombre, req.materia_nombre)}
                                    className="py-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Rechazar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'desersion' && (
            <DesersionTab adminData={adminData} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />
          )}

          {activeTab === 'justificantes' && (
            <JustificantesTab />
          )}
        </div>
      </main>

      {/* EXCEL IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full shadow-2xl p-6 relative theme-transition animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3 mb-4">
              <h4 className="font-extrabold text-base text-txt-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-primary" />
                Cargar Distribución de Horarios
              </h4>
              <button 
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportError('');
                  setImportSuccess(false);
                  setImportStats(null);
                }} 
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportHorarios} className="space-y-4 text-left">
              {/* Target Cycle Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                  1. Ciclo Escolar Destino
                </label>
                <select
                  value={selectedImportPeriodoId}
                  onChange={(e) => setSelectedImportPeriodoId(e.target.value)}
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                  required
                >
                  <option value="" disabled>Seleccionar ciclo...</option>
                  {periodosList.map((p) => (
                    <option key={p.periodo_id} value={p.periodo_id}>
                      {p.clave} - {p.nombre} {p.activo ? '(Ciclo Activo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drag & Drop File Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                  2. Archivo Excel (.xlsx)
                </label>
                <div className="border-2 border-dashed border-bdr-base hover:border-brand-primary/50 rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center gap-3 bg-bg-surface/30 group">
                  <UploadCloud className="w-10 h-10 text-txt-subtle group-hover:text-brand-primary transition-colors" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-txt-base">
                      {importFile ? importFile.name : 'Selecciona tu distribución horaria'}
                    </p>
                    <p className="text-[10px] text-txt-muted font-medium">
                      {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'Formato compatible: Excel (.xlsx)'}
                    </p>
                  </div>
                  <input
                    id="excel-file-input-modal"
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setImportFile(file);
                        setImportError('');
                        setImportSuccess(false);
                        setImportStats(null);
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('excel-file-input-modal').click()}
                    className="bg-bg-card hover:bg-bg-base border border-bdr-base text-txt-base text-xs font-bold py-1.5 px-3 rounded-xl transition-all cursor-pointer shadow-sm mt-1"
                  >
                    Examinar Archivo
                  </button>
                </div>
              </div>

              {/* Notifications */}
              {importError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && importStats && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-green-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>¡Horarios sincronizados con éxito!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-green-700/80 pt-1.5 border-t border-green-500/10">
                    <div>Filas procesadas: <span className="text-txt-base">{importStats.processedCount}</span></div>
                    <div>Docentes creados: <span className="text-txt-base">{importStats.createdDocentesCount}</span></div>
                    <div>Materias creadas: <span className="text-txt-base">{importStats.createdMateriasCount}</span></div>
                    <div>Grupos creados: <span className="text-txt-base">{importStats.createdGruposCount}</span></div>
                    <div className="col-span-2 font-extrabold">Horarios vinculados: <span className="text-txt-base">{importStats.createdAsignacionesCount}</span></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportError('');
                    setImportSuccess(false);
                    setImportStats(null);
                  }}
                  disabled={importingExcel}
                  className="bg-bg-surface border border-bdr-base text-txt-base hover:bg-bg-base text-xs font-bold py-2 px-4 rounded-xl cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={importingExcel || !importFile || !selectedImportPeriodoId}
                  className="bg-brand-primary hover:bg-brand-hover text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md select-none"
                >
                  {importingExcel ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sincronizar Excel</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {showEditStudentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <h3 className="font-extrabold text-lg">Editar Información del Alumno</h3>
              <button onClick={() => setShowEditStudentModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            <form onSubmit={handleSaveStudentEdit} className="space-y-4 text-left">
              {editStudentError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3 rounded-xl text-xs font-semibold">
                  {editStudentError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Nombre Completo</label>
                <input 
                  type="text" 
                  value={editStudentName} 
                  onChange={(e) => setEditStudentName(e.target.value)} 
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">No. Control (Matrícula)</label>
                <input 
                  type="text" 
                  value={editStudentMatricula} 
                  onChange={(e) => setEditStudentMatricula(e.target.value)} 
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={editStudentEmail} 
                  onChange={(e) => setEditStudentEmail(e.target.value)} 
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Grupo Asignado</label>
                <select 
                  value={editStudentGroupId} 
                  onChange={(e) => setEditStudentGroupId(e.target.value)}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value="" disabled>Selecciona un grupo</option>
                  {assignmentOptions?.grupos?.map(g => (
                    <option key={g.id || g.grupo_id} value={g.id || g.grupo_id}>
                      {g.clave} - {g.turno || 'N/A'} ({g.semestre}° Sem)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-txt-muted mt-1 leading-relaxed">
                  ⚠️ Cambiar el grupo desvinculará al alumno de las materias del grupo anterior y eliminará su historial de asistencia en ellas.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
                <button type="button" onClick={() => setShowEditStudentModal(false)} className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingEditStudent} className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5">
                  {savingEditStudent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. EDIT TEACHER MODAL */}
      {showEditTeacherModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <h3 className="font-extrabold text-lg">Editar Información del Docente</h3>
              <button onClick={() => setShowEditTeacherModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            <form onSubmit={handleSaveTeacherEdit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Nombre del Docente</label>
                <input 
                  type="text" 
                  value={editTeacherName} 
                  onChange={(e) => setEditTeacherName(e.target.value)} 
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={editTeacherEmail} 
                  onChange={(e) => setEditTeacherEmail(e.target.value)} 
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Turno</label>
                <select 
                  value={editTeacherShift} 
                  onChange={(e) => setEditTeacherShift(e.target.value)}
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
                <button type="button" onClick={() => setShowEditTeacherModal(false)} className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingEditTeacher} className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 font-bold">
                  {savingEditTeacher ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CREATE TEACHER MODAL */}
      {showCreateTeacherModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <h3 className="font-extrabold text-lg">Registrar Nuevo Docente</h3>
              <button onClick={() => setShowCreateTeacherModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            <form onSubmit={handleSaveNewTeacher} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Nombre del Docente</label>
                <input 
                  type="text" 
                  value={newTeacherName} 
                  onChange={(e) => setNewTeacherName(e.target.value)} 
                  required
                  placeholder="Ej. Prof. Juan Pérez"
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={newTeacherEmail} 
                  onChange={(e) => setNewTeacherEmail(e.target.value)} 
                  required
                  placeholder="Ej. juan.perez@escuela.com"
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Turno</label>
                <select 
                  value={newTeacherShift} 
                  onChange={(e) => setNewTeacherShift(e.target.value)}
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
                <button type="button" onClick={() => setShowCreateTeacherModal(false)} className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingNewTeacher} className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 font-bold animate-pulse-subtle">
                  {savingNewTeacher ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Registrar Docente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ASSIGN CLASS MODAL */}
      {showAssignClassModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <h3 className="font-extrabold text-lg">Asignar Materia y Grupo</h3>
              <button onClick={() => setShowAssignClassModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            <form onSubmit={handleSaveAssignment} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Docente</label>
                {adminTeacherDetail?.name ? (
                  <input 
                    type="text" 
                    value={adminTeacherDetail.name} 
                    disabled
                    className="w-full bg-bg-surface/50 border border-bdr-base text-txt-muted rounded-xl px-4 py-2.5 outline-none text-sm theme-transition cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={selectedDocenteIdForGroup}
                    onChange={(e) => setSelectedDocenteIdForGroup(e.target.value)}
                    required
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                  >
                    <option value="">Selecciona un Docente</option>
                    {assignmentOptions.docentes?.map(d => (
                      <option key={d.id || d.docente_id} value={d.id || d.docente_id}>
                        {d.nombre || d.docente || d.nombre_completo}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Materia</label>
                <select 
                  value={selectedSubjectId} 
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  {assignmentOptions.materias?.map(m => (
                    <option key={m.id || m.materia_id} value={m.id || m.materia_id}>
                      {m.nombre}{isIntersemestral ? ' (Intersemestral)' : ''} ({m.clave})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Grupo</label>
                <select 
                  value={selectedGroupIdForClass} 
                  onChange={(e) => setSelectedGroupIdForClass(e.target.value)}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value="">Selecciona un Grupo</option>
                  {assignmentOptions.grupos?.map(g => (
                    <option key={g.id || g.grupo_id} value={g.id || g.grupo_id}>
                      {g.clave}{isIntersemestral ? ' (Intersemestral)' : ''} - Turno {g.turno || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              {adminTeacherDetail?.data?.grupos && adminTeacherDetail.data.grupos.length > 0 && (
                <div className="bg-bg-surface/50 border border-bdr-base p-4 rounded-xl space-y-2 mt-2 theme-transition">
                  <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest block flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse text-rose-500" />
                    Horarios Reservados de este Docente
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {adminTeacherDetail.data.grupos.map((g) => (
                      <div key={g.id} className="flex justify-between items-center text-[10px] font-semibold text-txt-muted bg-bg-card border border-bdr-base/60 px-2.5 py-1.5 rounded-lg">
                        <span className="font-bold text-txt-base">{g.name} ({g.key})</span>
                        <span className="bg-rose-500/10 text-rose-600 dark:text-rose-455 border border-rose-500/20 px-2 py-0.5 rounded font-mono font-bold">{g.schedule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
                <button type="button" onClick={() => setShowAssignClassModal(false)} className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingAssignment} className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 font-bold">
                  {savingAssignment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Asignar Clase</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ASSIGN MODAL */}
      {showQuickAssignModal && selectedSlotForQuickAssign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <h3 className="font-extrabold text-lg">Asignar Materia Rápida</h3>
              <button onClick={() => setShowQuickAssignModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            <div className="bg-brand-primary/5 border border-brand-primary/20 px-3 py-2 rounded-xl text-xs text-brand-primary font-semibold flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Slot: {selectedSlotForQuickAssign.day} a las {String(selectedSlotForQuickAssign.hour).padStart(2, '0')}:00</span>
            </div>
            <form onSubmit={handleSaveQuickAssignment} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Materia</label>
                <select 
                  value={quickAssignSubjectId} 
                  onChange={(e) => setQuickAssignSubjectId(e.target.value)}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value="">Selecciona una Materia</option>
                  {assignmentOptions.materias?.map(m => (
                    <option key={m.id || m.materia_id} value={m.id || m.materia_id}>
                      {m.nombre}{isIntersemestral ? ' (Intersemestral)' : ''} ({m.clave})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Grupo</label>
                <select 
                  value={quickAssignGroupId} 
                  onChange={(e) => setQuickAssignGroupId(e.target.value)}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value="">Selecciona un Grupo</option>
                  {assignmentOptions.grupos?.map(g => (
                    <option key={g.id || g.grupo_id} value={g.id || g.grupo_id}>
                      {g.clave}{isIntersemestral ? ' (Intersemestral)' : ''} - Turno {g.turno || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Duración (Horas)</label>
                <select 
                  value={quickAssignDuration} 
                  onChange={(e) => setQuickAssignDuration(parseInt(e.target.value, 10))}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value={1}>1 hora</option>
                  <option value={2}>2 horas</option>
                  <option value={3}>3 horas</option>
                  <option value={4}>4 horas</option>
                </select>
              </div>

              {quickAssignmentError && (
                <div className="text-xs text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                  {quickAssignmentError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
                <button type="button" onClick={() => setShowQuickAssignModal(false)} className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingQuickAssignment} className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 font-bold">
                  {savingQuickAssignment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Asignar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TEMPORARY GROUP MODAL */}
      {showCreateTempGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <h3 className="font-extrabold text-lg text-txt-base">Crear Grupo Temporal</h3>
              <button onClick={() => setShowCreateTempGroupModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            <form onSubmit={handleCreateTempGroup} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Clave del Grupo Temporal</label>
                <input 
                  type="text" 
                  value={tempGroupClave}
                  onChange={(e) => setTempGroupClave(e.target.value)}
                  placeholder="Ej. Redes Inter, Inter-A, etc."
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Turno</label>
                  <select 
                    value={tempGroupTurno} 
                    onChange={(e) => setTempGroupTurno(e.target.value)}
                    required
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                  >
                    <option value="Matutino">Matutino</option>
                    <option value="Vespertino">Vespertino</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Semestre</label>
                  <select 
                    value={tempGroupSemestre} 
                    onChange={(e) => setTempGroupSemestre(parseInt(e.target.value))}
                    required
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                      <option key={sem} value={sem}>{sem}° Semestre</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Cupo Máximo</label>
                <input 
                  type="number" 
                  value={tempGroupCupo}
                  onChange={(e) => setTempGroupCupo(parseInt(e.target.value))}
                  min="1"
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>

              {tempGroupError && (
                <div className="text-xs text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                  {tempGroupError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
                <button type="button" onClick={() => setShowCreateTempGroupModal(false)} className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingTempGroup} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 font-bold">
                  {savingTempGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Crear Grupo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CLASS MODAL */}
      {showEditClassModal && editingClassData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <h3 className="font-extrabold text-lg">Gestionar Asignación</h3>
              <button onClick={() => setShowEditClassModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            <div className="bg-brand-primary/5 border border-brand-primary/20 px-3.5 py-2.5 rounded-xl text-xs text-brand-primary flex flex-col gap-1">
              <span className="font-extrabold text-sm">{editingClassData.name}</span>
              <span className="font-medium text-txt-muted">Clave: {editingClassData.key}</span>
            </div>
            <form onSubmit={handleSaveClassEdit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Día</label>
                <select 
                  value={editClassDay} 
                  onChange={(e) => setEditClassDay(e.target.value)}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                >
                  <option value="Lunes">Lunes</option>
                  <option value="Martes">Martes</option>
                  <option value="Miércoles">Miércoles</option>
                  <option value="Jueves">Jueves</option>
                  <option value="Viernes">Viernes</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Hora de Inicio</label>
                  <select 
                    value={editClassStartHour} 
                    onChange={(e) => setEditClassStartHour(parseInt(e.target.value, 10))}
                    required
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                  >
                    {(() => {
                      const teacherShift = adminData?.docentes?.find(d => d.docente_id === adminSelectedTeacherId)?.turno || 'Matutino';
                      const { hours } = getVisibleHours(adminTeacherDetail.data?.grupos, teacherShift);
                      return hours.map(h => (
                        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                      ));
                    })()}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Duración</label>
                  <select 
                    value={editClassDuration} 
                    onChange={(e) => setEditClassDuration(parseInt(e.target.value, 10))}
                    required
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                  >
                    <option value={1}>1 hora</option>
                    <option value={2}>2 horas</option>
                    <option value={3}>3 horas</option>
                    <option value={4}>4 horas</option>
                  </select>
                </div>
              </div>

              {classEditError && (
                <div className="text-xs text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                  {classEditError}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-bdr-base">
                <button 
                  type="button" 
                  onClick={handleUnassignFromModal}
                  disabled={savingClassEdit}
                  className="px-4 py-2 border border-rose-500/30 hover:border-rose-500/50 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Desvincular</span>
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowEditClassModal(false)} className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer">Cancelar</button>
                  <button type="submit" disabled={savingClassEdit} className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 font-bold">
                    {savingClassEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Guardar</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. RISK MODAL */}
      {showRiskModal && adminTeacherDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 theme-transition max-h-[90vh] flex flex-col relative text-left">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-rose-500 w-5 h-5" />
                <h3 className="font-extrabold text-lg">Alumnos en Riesgo - {adminTeacherDetail.name}</h3>
              </div>
              <button onClick={() => setShowRiskModal(false)} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            
            <p className="text-xs text-txt-muted shrink-0">
              A continuación se muestran los alumnos inscritos en los grupos del docente que tienen un porcentaje de asistencia menor al 80%.
            </p>

            <div className="overflow-y-auto flex-grow pr-1">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider sticky top-0 bg-bg-card z-10">
                    <th className="py-2.5 px-3">No. Control</th>
                    <th className="py-2.5 px-3">Nombre Completo</th>
                    <th className="py-2.5 px-3">Grupo (Clave)</th>
                    <th className="py-2.5 px-3 text-right">Asistencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-base/40 text-xs">
                  {adminTeacherDetail.data?.alumnosEnRiesgo?.map((s) => (
                    <tr key={s.id} className="hover:bg-bg-surface/30 theme-transition">
                      <td className="py-3 px-3 font-mono font-semibold text-txt-subtle">{s.id}</td>
                      <td className="py-3 px-3 font-bold text-txt-base">{s.name}</td>
                      <td className="py-3 px-3 text-txt-muted">
                        {isIntersemestral ? 'Intersemestral' : `${s.course || s.courseName || ''} (${s.groupKey || s.courseKey || ''})`}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-rose-500 bg-rose-500/5">{s.attendanceRate}%</td>
                    </tr>
                  ))}
                  {(!adminTeacherDetail.data?.alumnosEnRiesgo || adminTeacherDetail.data?.alumnosEnRiesgo.length === 0) && (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-txt-subtle italic">No hay alumnos en riesgo actualmente.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-3 border-t border-bdr-base shrink-0">
              <button onClick={() => setShowRiskModal(false)} className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-95">Cerrar Lista</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center theme-transition">
            <div className="space-y-2 text-left">
              <h3 className="font-extrabold text-lg text-txt-base">{confirmModal.title}</h3>
              <p className="text-xs text-txt-muted leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base/50">
              <button 
                type="button" 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer select-none"
              >
                {confirmModal.cancelText}
              </button>
              <button 
                type="button" 
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer select-none transition-all ${
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

      {/* 6. INTERACTIVE CLASS DETAIL MODAL */}
      {selectedClassDetailModal.isOpen && selectedClassDetailModal.classData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative text-left">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="text-brand-primary w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-lg text-txt-base">Detalle de Asignatura</h3>
              </div>
              <button onClick={() => setSelectedClassDetailModal(prev => ({ ...prev, isOpen: false }))} className="text-txt-muted hover:text-txt-base cursor-pointer text-sm">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-txt-subtle uppercase block font-bold tracking-wider">Asignatura</span>
                <span className="text-base font-extrabold text-txt-base block mt-0.5">{selectedClassDetailModal.classData.name}</span>
                <span className="inline-block text-[10px] font-bold bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded border border-brand-primary/20 mt-1">{selectedClassDetailModal.classData.key}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-surface border border-bdr-base/40 p-3 rounded-xl">
                  <span className="text-[9px] text-txt-subtle uppercase block font-bold tracking-wider">Horario de Agenda</span>
                  <span className="text-xs font-bold text-txt-base block mt-0.5">{selectedClassDetailModal.classData.schedule || selectedClassDetailModal.classData.time}</span>
                </div>
                
                <div className="bg-bg-surface border border-bdr-base/40 p-3 rounded-xl">
                  <span className="text-[9px] text-txt-subtle uppercase block font-bold tracking-wider">Alumnos En Rol</span>
                  <span className="text-xs font-bold text-txt-base block mt-0.5">{selectedClassDetailModal.classData.totalStudents || 0} inscritos</span>
                </div>
              </div>
              
              <div className="bg-bg-surface border border-bdr-base/40 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-txt-subtle uppercase block font-bold tracking-wider">Rendimiento Promedio</span>
                  <span className="text-xs font-bold text-txt-muted block mt-0.5">Asistencias acumuladas</span>
                </div>
                <div className="text-right">
                  <span className={`text-xl font-extrabold ${selectedClassDetailModal.classData.asistencia_promedio < 80 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {selectedClassDetailModal.classData.asistencia_promedio || 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-bdr-base/60">
              <button 
                type="button" 
                onClick={() => setSelectedClassDetailModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-[0.98]"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. TOAST NOTIFICATION */}
      {reminderToast.show && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-450 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-scale-in max-w-sm">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500 animate-pulse" />
          <div className="space-y-0.5 text-left">
            <h5 className="font-extrabold text-sm text-txt-base">Acción Completada</h5>
            <p className="text-xs text-txt-muted font-semibold">Operación exitosa en base de datos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
