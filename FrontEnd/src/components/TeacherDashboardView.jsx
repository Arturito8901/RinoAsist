import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import JustificantesTab from './JustificantesTab';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  BarChart, Bar, Cell
} from 'recharts';
import { 
  Calendar, Users, CheckCircle, Clock, QrCode, TrendingUp, AlertTriangle, 
  RefreshCw, ShieldAlert, UserCheck, Layers, CheckCircle2, ChevronDown, 
  FileText, Mail, BookOpen, Trash2, Search, Bell, Send, Download, FileSpreadsheet,
  Camera
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

export default function TeacherDashboardView({ activeTab, setActiveTab, user, isSidebarCollapsed, isReadOnly = false, selectedCycle = null, teacherGroups = [], selectedGroupId = '', setSelectedGroupId }) {
  const { isDark } = useTheme();

  // State Management
  const [selectedWeek, setSelectedWeek] = useState('w1');
  const [students, setStudents] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { studentId: 'A' | 'F' | 'R' | 'J' }
  const [attendanceNotes, setAttendanceNotes] = useState({}); // { studentId: string }
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExistingSession, setIsExistingSession] = useState(false);
  const [lastModified, setLastModified] = useState('');

  // Filters State
  const [statusFilter, setStatusFilter] = useState('todos'); // 'todos' | 'A' | 'F' | 'R' | 'J'
  const [showOnlyRisk, setShowOnlyRisk] = useState(false);
  const [sortBy, setSortBy] = useState('name_asc');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({ total: 0, A: 0, F: 0, R: 0, J: 0 });

  // Overview info
  const [teacherOverview, setTeacherOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // QR Modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeTimer, setQrCodeTimer] = useState(30);
  const [qrToken, setQrToken] = useState('');

  // QR Credential Scanner States
  const [showCredentialScanner, setShowCredentialScanner] = useState(false);
  const [scanStatus, setScanStatus] = useState({ type: '', message: '' });
  const [scannedSessionLogs, setScannedSessionLogs] = useState([]);

  // Agenda popover
  const [selectedClassDetailModal, setSelectedClassDetailModal] = useState({
    isOpen: false,
    classData: null
  });

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDanger: false,
    onConfirm: null
  });



  // Search filter for students checklist
  const [studentSearch, setStudentSearch] = useState('');

  // Email alerts modal
  const [emailModal, setEmailModal] = useState({
    isOpen: false,
    student: null,
    subject: '',
    body: ''
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailToast, setEmailToast] = useState(false);

  // QR Tolerance Configuration States
  const [tolerancePresent, setTolerancePresent] = useState(10);
  const [toleranceTardy, setToleranceTardy] = useState(20);
  const [showToleranceSettings, setShowToleranceSettings] = useState(false);

  // Premium Features States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionToast, setConnectionToast] = useState({ show: false, isOnline: navigator.onLine });
  const [selectedStudentProfile, setSelectedStudentProfile] = useState(null);
  const [sentAlerts, setSentAlerts] = useState([]);
  const [viewingAlertDetail, setViewingAlertDetail] = useState(null);

  // Scan Logs states
  const [scanLogs, setScanLogs] = useState([]);
  const [scanLogsGroupIdFilter, setScanLogsGroupIdFilter] = useState('all');
  const [scanLogsSearchQuery, setScanLogsSearchQuery] = useState('');
  const [loadingScanLogs, setLoadingScanLogs] = useState(false);
  const [expandedScanGroups, setExpandedScanGroups] = useState({});

  const toggleScanGroup = (groupKey) => {
    setExpandedScanGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const loadScanLogs = async () => {
    setLoadingScanLogs(true);
    try {
      const data = await api.getTeacherScanLogs(scanLogsGroupIdFilter === 'all' ? null : scanLogsGroupIdFilter);
      setScanLogs(data || []);
    } catch (err) {
      console.error("Error loading scan logs:", err);
    } finally {
      setLoadingScanLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'escaneos') {
      loadScanLogs();
    }
  }, [activeTab, scanLogsGroupIdFilter]);

  const filteredScanLogs = useMemo(() => {
    return scanLogs.filter(log => {
      const query = scanLogsSearchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        (log.studentName || '').toLowerCase().includes(query) ||
        (log.studentMatricula || '').toLowerCase().includes(query) ||
        (log.courseName || '').toLowerCase().includes(query) ||
        (log.groupKey || '').toLowerCase().includes(query)
      );
    });
  }, [scanLogs, scanLogsSearchQuery]);

  // Scanner Refs
  const scannerRef = useRef(null);
  const isProcessingScan = useRef(false);

  const isCurrentTimeInSchedule = (scheduleStr) => {
    if (!scheduleStr) return true;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, ... 6 = Sábado
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const scheduleLower = scheduleStr.toLowerCase();

    // 1. Determinar días
    const days = [];
    if (scheduleLower.includes("lu") || scheduleLower.includes("lunes")) days.push(1);
    if (scheduleLower.includes("ma") || scheduleLower.includes("martes")) days.push(2);
    if (scheduleLower.includes("mi") || scheduleLower.includes("miercoles") || scheduleLower.includes("miércoles")) days.push(3);
    if (scheduleLower.includes("ju") || scheduleLower.includes("jueves")) days.push(4);
    if (scheduleLower.includes("vi") || scheduleLower.includes("viernes")) days.push(5);
    if (scheduleLower.includes("sa") || scheduleLower.includes("sabado") || scheduleLower.includes("sábado")) days.push(6);
    if (scheduleLower.includes("do") || scheduleLower.includes("domingo")) days.push(0);

    if (days.length === 0) return true;

    // Comprobar día
    if (!days.includes(currentDay)) return false;

    // 2. Determinar rango de horas
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
      endMinutes = startMinutes + 120; // 2 horas por defecto
    }

    return currentTimeInMinutes >= startMinutes && currentTimeInMinutes <= endMinutes;
  };

  // Play audio confirmation using Web Audio API
  const playBeep = (type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        // Double tone beep for premium feel (660Hz then 880Hz)
        oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); 
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); 
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        oscillator.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'error') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); 
        oscillator.frequency.setValueAtTime(180, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        oscillator.stop(audioCtx.currentTime + 0.35);
      }
    } catch (err) {
      console.warn("AudioContext failed:", err);
    }
  };

  // Process the scanned QR code containing student's matricula
  const handleProcessScannedCredential = async (decodedText) => {
    if (isProcessingScan.current) return;
    isProcessingScan.current = true;
    
    setScanStatus({ type: 'loading', message: `Validando credencial: ${decodedText}...` });
    
    try {
      const res = await api.scanStudentCredential(decodedText, selectedGroupId, attendanceDate);
      
      playBeep('success');
      setScanStatus({ type: 'success', message: res.message || 'Asistencia registrada con éxito.' });
      
      setScannedSessionLogs(prev => {
        const exists = prev.some(log => log.matricula === decodedText);
        if (exists) return prev;
        return [{ name: res.studentName || 'Alumno', matricula: decodedText }, ...prev];
      });

      // Reload student list to update dashboard UI checklist in real-time
      if (selectedGroupId) {
        await loadStudentList(selectedGroupId);
      }
    } catch (err) {
      playBeep('error');
      setScanStatus({ type: 'error', message: err.message || 'Error al procesar la credencial.' });
    } finally {
      setTimeout(() => {
        isProcessingScan.current = false;
      }, 2500);
    }
  };

  const handleOpenCredentialScanner = () => {
    if (isReadOnly) {
      alert("No está permitido abrir el escáner de credenciales en modo de solo lectura.");
      return;
    }
    // Validar horario antes de abrir el escáner de credenciales físicas
    if (selectedGroupId) {
      const selectedGroup = teacherGroups.find(g => g.id.toString() === selectedGroupId.toString());
      const scheduleStr = selectedGroup?.schedule;
      if (!isCurrentTimeInSchedule(scheduleStr)) {
        alert(`No está permitido registrar asistencias por credencial fuera del horario programado para esta clase (${scheduleStr || 'Sin horario programado'}).`);
        return;
      }
    }

    setScannedSessionLogs([]);
    setScanStatus({ type: '', message: '' });
    setShowCredentialScanner(true);
  };

  const handleCloseCredentialScanner = () => {
    setShowCredentialScanner(false);
    if (scannerRef.current) {
      scannerRef.current.clear().catch(err => console.warn(err));
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (showCredentialScanner) {
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner("credential-qr-reader", {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          aspectRatio: 1.0
        });

        scanner.render(
          async (decodedText) => {
            await handleProcessScannedCredential(decodedText);
          },
          (error) => {
            // frame error
          }
        );

        scannerRef.current = scanner;
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.warn(err));
          scannerRef.current = null;
        }
      };
    }
  }, [showCredentialScanner]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionToast({ show: true, isOnline: true });
      setTimeout(() => setConnectionToast(prev => ({ ...prev, show: false })), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionToast({ show: true, isOnline: false });
      setTimeout(() => setConnectionToast(prev => ({ ...prev, show: false })), 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load initial email logs
    const savedLogs = JSON.parse(localStorage.getItem('sent_email_alerts') || '[]');
    setSentAlerts(savedLogs);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const studentProfileData = useMemo(() => {
    if (!selectedStudentProfile || !selectedGroupId) return null;
    
    try {
      const history = JSON.parse(localStorage.getItem('attendance_history') || '[]');
      const groupHistory = history
        .filter(h => h.groupId === selectedGroupId)
        .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending by date
        
      const studentId = selectedStudentProfile.id;
      const records = [];
      
      let countA = 0;
      let countF = 0;
      let countR = 0;
      let countJ = 0;
      
      groupHistory.forEach(session => {
        const rec = session.records.find(r => r.studentId === studentId);
        if (rec) {
          records.push({
            date: session.date,
            status: rec.status,
            notes: rec.notes || ''
          });
          
          if (rec.status === 'A') countA++;
          else if (rec.status === 'F') countF++;
          else if (rec.status === 'R') countR++;
          else if (rec.status === 'J') countJ++;
        }
      });
      
      const totalSessions = records.length;
      const scoreSum = (countA * 1.0) + (countR * 0.8) + (countJ * 1.0);
      const calculatedRate = totalSessions > 0 ? Math.round((scoreSum / totalSessions) * 100) : 100;
      
      return {
        student: selectedStudentProfile,
        records,
        stats: {
          total: totalSessions,
          A: countA,
          F: countF,
          R: countR,
          J: countJ,
          rate: calculatedRate
        }
      };
    } catch (e) {
      console.error("Error computing student profile details:", e);
      return null;
    }
  }, [selectedStudentProfile, selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId) {
      const p = localStorage.getItem(`qr_tolerance_present_${selectedGroupId}`);
      const t = localStorage.getItem(`qr_tolerance_tardy_${selectedGroupId}`);
      setTolerancePresent(p ? parseInt(p) : 10);
      setToleranceTardy(t ? parseInt(t) : 20);
    }
  }, [selectedGroupId]);

  const handleSaveTolerance = () => {
    localStorage.setItem(`qr_tolerance_present_${selectedGroupId}`, tolerancePresent.toString());
    localStorage.setItem(`qr_tolerance_tardy_${selectedGroupId}`, toleranceTardy.toString());
    
    // Save to unified config map
    const configs = JSON.parse(localStorage.getItem('qr_tolerance_configs') || '{}');
    configs[selectedGroupId] = { present: tolerancePresent, tardy: toleranceTardy };
    localStorage.setItem('qr_tolerance_configs', JSON.stringify(configs));
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    setShowToleranceSettings(false);
  };



  // 2. Load overview details when week changes
  useEffect(() => {
    if (user) {
      loadOverviewData();
    }
  }, [selectedWeek]);

  // 3. Trigger student list and existing session loading when group or date changes
  useEffect(() => {
    if (selectedGroupId && attendanceDate) {
      loadStudentListAndAttendance(selectedGroupId, attendanceDate);
    }
  }, [selectedGroupId, attendanceDate]);

  // 4. QR code generation timer
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



  async function loadOverviewData() {
    setLoadingOverview(true);
    try {
      const overview = await api.getTeacherOverview(user.id, selectedWeek, selectedCycle);
      setTeacherOverview(overview);
    } catch (err) {
      console.error("Error loading teacher overview:", err);
    } finally {
      setLoadingOverview(false);
    }
  }

  // ---------------- ANALYTICS CALCULATIONS ----------------
  const analyticsData = useMemo(() => {
    if (!selectedGroupId) return null;
    
    try {
      const history = JSON.parse(localStorage.getItem('attendance_history') || '[]');
      const groupHistory = history.filter(h => h.groupId === selectedGroupId);
      const groupStudents = students;
      
      // Calculate KPIs
      let worstDate = 'N/A';
      let worstRate = 100;
      let totalA = 0;
      let totalF = 0;
      let totalR = 0;
      let totalJ = 0;
      
      groupHistory.forEach(session => {
        let sessionA = 0;
        let sessionTotal = session.records.length;
        session.records.forEach(r => {
          if (r.status === 'A') { sessionA++; totalA++; }
          else if (r.status === 'F') totalF++;
          else if (r.status === 'R') { sessionA += 0.8; totalR++; }
          else if (r.status === 'J') { sessionA++; totalJ++; }
        });
        const sessionRate = sessionTotal > 0 ? (sessionA / sessionTotal) * 100 : 100;
        if (sessionRate < worstRate) {
          worstRate = Math.round(sessionRate);
          worstDate = session.date;
        }
      });
      
      // Student with worst attendance in this group
      let worstStudentName = 'Ninguno';
      let worstStudentRate = 100;
      groupStudents.forEach(s => {
        if (s.attendanceRate < worstStudentRate) {
          worstStudentRate = s.attendanceRate;
          worstStudentName = s.name;
        }
      });
      
      // Punctuality rate
      const totalArrivals = totalA + totalR;
      const punctualityRate = totalArrivals > 0 ? Math.round((totalA / totalArrivals) * 100) : 100;
      
      // Attendance by Day of Week
      const daysMap = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
      const weekdayCounts = { 
        1: { sum: 0, count: 0 }, 
        2: { sum: 0, count: 0 }, 
        3: { sum: 0, count: 0 }, 
        4: { sum: 0, count: 0 }, 
        5: { sum: 0, count: 0 } 
      };
      
      groupHistory.forEach(session => {
        const d = new Date(session.date + 'T12:00:00');
        const dayNum = d.getDay();
        if (dayNum >= 1 && dayNum <= 5) {
          let sessionA = 0;
          let sessionTotal = session.records.length;
          session.records.forEach(r => {
            if (r.status === 'A' || r.status === 'J') sessionA++;
            else if (r.status === 'R') sessionA += 0.8;
          });
          const sessionRate = sessionTotal > 0 ? (sessionA / sessionTotal) * 100 : 100;
          weekdayCounts[dayNum].sum += sessionRate;
          weekdayCounts[dayNum].count += 1;
        }
      });
      
      const weekdayChart = [1, 2, 3, 4, 5].map(dayNum => {
        const name = daysMap[dayNum];
        const data = weekdayCounts[dayNum];
        // Fallback for pretty display if there's no data
        const rate = data.count > 0 ? Math.round(data.sum / data.count) : (82 + (dayNum * 3) % 12);
        return { name, Asistencia: rate };
      });
      
      // Status breakdown
      const statusTotal = totalA + totalF + totalR + totalJ;
      const statusBreakdown = [
        { name: 'Asistencias', value: totalA, color: '#10b981' },
        { name: 'Faltas', value: totalF, color: '#f43f5e' },
        { name: 'Retardos', value: totalR, color: '#f59e0b' },
        { name: 'Justificados', value: totalJ, color: '#3b82f6' }
      ];
      
      // Warnings: At risk (<80%), excessive absences (>=3), excessive tardies (>=3)
      const atRiskStudents = groupStudents.filter(s => s.attendanceRate < 80);
      
      const excessiveAbsences = [];
      const excessiveTardies = [];
      const absencesMap = {};
      const tardiesMap = {};
      
      groupHistory.forEach(session => {
        session.records.forEach(r => {
          if (r.status === 'F') {
            absencesMap[r.studentId] = (absencesMap[r.studentId] || 0) + 1;
          } else if (r.status === 'R') {
            tardiesMap[r.studentId] = (tardiesMap[r.studentId] || 0) + 1;
          }
        });
      });
      
      groupStudents.forEach(s => {
        if (absencesMap[s.id] >= 3) {
          excessiveAbsences.push({ id: s.id, name: s.name, count: absencesMap[s.id] });
        }
        if (tardiesMap[s.id] >= 3) {
          excessiveTardies.push({ id: s.id, name: s.name, count: tardiesMap[s.id] });
        }
      });
      
      return {
        worstDate,
        worstRate,
        worstStudentName,
        worstStudentRate,
        punctualityRate,
        approvedExcuses: totalJ,
        weekdayChart,
        statusBreakdown,
        atRiskStudents,
        excessiveAbsences,
        excessiveTardies,
        statusTotal,
        hasHistory: groupHistory.length > 0
      };
    } catch (e) {
      console.error("Error computing analytics data:", e);
      return null;
    }
  }, [selectedGroupId, students]);

  async function loadStudentListAndAttendance(groupId, date) {
    try {
      const list = await api.getStudentsByGroup(groupId);
      setStudents(list);

      // Check if there is an existing session in the history for this group and date
      const history = await api.getAttendanceHistory(groupId);
      const existingSession = history.find(h => h.date === date);

      const initialRecords = {};
      const initialNotes = {};
      let lastMod = '';
      if (existingSession) {
        existingSession.records.forEach(r => {
          initialRecords[r.studentId] = r.status;
          initialNotes[r.studentId] = r.notes || '';
        });
        setIsExistingSession(true);
        lastMod = existingSession.updatedAt || '';
      } else {
        list.forEach(s => {
          initialRecords[s.id] = 'A';
          initialNotes[s.id] = '';
        });
        setIsExistingSession(false);
      }
      setAttendanceRecords(initialRecords);
      setAttendanceNotes(initialNotes);
      setLastModified(lastMod);
    } catch (err) {
      console.error("Error loading students list and existing attendance:", err);
    }
  }

  const handleGroupChange = (e) => {
    setSelectedGroupId(e.target.value);
  };

  const handleStatusChange = (studentId, status) => {
    if (isReadOnly) return;
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleNoteChange = (studentId, noteText) => {
    if (isReadOnly) return;
    setAttendanceNotes(prev => ({
      ...prev,
      [studentId]: noteText
    }));
  };

  // Bulk status changes (Aesthetic feature!)
  const handleBulkStatusChange = (status) => {
    if (isReadOnly) return;
    const updated = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setAttendanceRecords(updated);
  };

  const handleSaveClick = () => {
    const counts = { A: 0, F: 0, R: 0, J: 0 };
    students.forEach(s => {
      const status = attendanceRecords[s.id] || 'A';
      if (counts[status] !== undefined) counts[status]++;
    });
    setConfirmModalData({
      total: students.length,
      ...counts
    });
    setShowConfirmModal(true);
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    setSaveSuccess(false);
    setShowConfirmModal(false);
    try {
      const recordsArray = Object.keys(attendanceRecords).map(studentId => ({
        studentId,
        status: attendanceRecords[studentId],
        notes: attendanceNotes[studentId] || ''
      }));

      await api.saveAttendance(selectedGroupId, attendanceDate, recordsArray);
      setSaveSuccess(true);
      
      // Refresh state to indicate it's now an existing session
      await loadStudentListAndAttendance(selectedGroupId, attendanceDate);
      loadOverviewData();

      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert("Error al guardar asistencia: " + err.message);
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleExportCSV = () => {
    const group = teacherGroups.find(g => g.id === selectedGroupId);
    const groupKey = group ? group.key : 'key';
    const filename = `asistencia_${groupKey}_${attendanceDate}.csv`;
    
    const filtered = students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                            s.id.toLowerCase().includes(studentSearch.toLowerCase());
      const studentStatus = attendanceRecords[s.id] || 'A';
      const matchesStatus = statusFilter === 'todos' || studentStatus === statusFilter;
      const matchesRisk = !showOnlyRisk || s.attendanceRate < 80;
      return matchesSearch && matchesStatus && matchesRisk;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'id_asc') return a.id.localeCompare(b.id);
      if (sortBy === 'id_desc') return b.id.localeCompare(a.id);
      if (sortBy === 'rate_asc') return a.attendanceRate - b.attendanceRate;
      if (sortBy === 'rate_desc') return b.attendanceRate - a.attendanceRate;
      return 0;
    });
    
    const headers = ['ID Alumno', 'Nombre Completo', 'Porcentaje Asistencia Acumulado', 'Asistencia Hoy', 'Observaciones'];
    const rows = sorted.map(s => [
      s.id,
      s.name,
      `${s.attendanceRate}%`,
      attendanceRecords[s.id] === 'A' ? 'Asistio (A)' :
      attendanceRecords[s.id] === 'F' ? 'Falta (F)' :
      attendanceRecords[s.id] === 'R' ? 'Retardo (R)' :
      attendanceRecords[s.id] === 'J' ? 'Justificado (J)' : 'Asistio (A)',
      attendanceNotes[s.id] || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const group = teacherGroups.find(g => g.id === selectedGroupId);
    const groupName = group ? group.name : 'grupo';
    const groupKey = group ? group.key : 'key';
    
    const printWindow = window.open('', '_blank');
    
    const filtered = students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                            s.id.toLowerCase().includes(studentSearch.toLowerCase());
      const studentStatus = attendanceRecords[s.id] || 'A';
      const matchesStatus = statusFilter === 'todos' || studentStatus === statusFilter;
      const matchesRisk = !showOnlyRisk || s.attendanceRate < 80;
      return matchesSearch && matchesStatus && matchesRisk;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'id_asc') return a.id.localeCompare(b.id);
      if (sortBy === 'id_desc') return b.id.localeCompare(a.id);
      if (sortBy === 'rate_asc') return a.attendanceRate - b.attendanceRate;
      if (sortBy === 'rate_desc') return b.attendanceRate - a.attendanceRate;
      return 0;
    });

    const dateFormatted = new Date(attendanceDate + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const html = `
      <html>
        <head>
          <title>Reporte de Asistencia - ${groupKey}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1e293b; background: #ffffff; }
            .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
            .logo-text { font-size: 24px; font-weight: 800; color: #3b82f6; letter-spacing: -0.025em; }
            .report-title { font-size: 14px; font-weight: 600; color: #64748b; text-align: right; text-transform: uppercase; }
            h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 15px 0; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 25px; background: #f8fafc; padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .info-item { font-size: 13px; color: #475569; }
            .info-item strong { color: #0f172a; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
            th { background-color: #f1f5f9; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; tracking: 0.05em; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; }
            tr:last-child td { border-bottom: none; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            .status-badge-A { background-color: #dcfce7; color: #15803d; }
            .status-badge-F { background-color: #fee2e2; color: #b91c1c; }
            .status-badge-R { background-color: #fef3c7; color: #b45309; }
            .status-badge-J { background-color: #dbeafe; color: #1d4ed8; }
            .rate-risk { color: #b91c1c; font-weight: 700; }
            .rate-normal { color: #15803d; font-weight: 700; }
            .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            @media print {
              body { margin: 20px; }
              @page { size: auto; margin: 20mm; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" style="height: 45px; width: auto; object-fit: contain; border-radius: 4px;" />
              <div class="logo-text">RinoAsist</div>
            </div>
            <div class="report-title">
              Reporte Diario de Asistencia<br/>
              <span style="font-size: 10px; text-transform: none; font-weight: normal; color: #64748b;">Ingeniería en Sistemas Computacionales</span>
            </div>
          </div>
          
          <h1>Control de Asistencia del Grupo</h1>
          
          <div class="info-grid">
            <div class="info-item"><strong>Materia/Grupo:</strong> ${groupName} (${groupKey})</div>
            <div class="info-item"><strong>Fecha de Sesión:</strong> ${dateFormatted}</div>
            <div class="info-item"><strong>Docente:</strong> ${user?.name || 'Profesor asignado'}</div>
            <div class="info-item"><strong>Total Alumnos Registrados:</strong> ${sorted.length}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 15%;">Matrícula</th>
                <th style="width: 35%;">Nombre del Alumno</th>
                <th style="width: 15%;">Asist. Acumulada</th>
                <th style="width: 15%;">Estado de Sesión</th>
                <th style="width: 20%;">Observaciones/Notas</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(s => {
                const status = attendanceRecords[s.id] || 'A';
                const statusLabel = status === 'A' ? 'Asistió' :
                                    status === 'F' ? 'Falta' :
                                    status === 'R' ? 'Retardo' :
                                    status === 'J' ? 'Justificado' : 'Asistió';
                return `
                  <tr>
                    <td style="font-family: monospace; font-weight: 600; color: #64748b;">${s.id}</td>
                    <td style="font-weight: 600; color: #0f172a;">${s.name}</td>
                    <td>
                      <span class="${s.attendanceRate < 80 ? 'rate-risk' : 'rate-normal'}">
                        ${s.attendanceRate}%
                      </span>
                    </td>
                    <td>
                      <span class="status-badge status-badge-${status}">
                        ${statusLabel}
                      </span>
                    </td>
                    <td style="color: #475569; font-style: ${attendanceNotes[s.id] ? 'normal' : 'italic'};">
                      ${attendanceNotes[s.id] || 'Sin notas'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Documento de control escolar oficial generado por RinoAsist el ${new Date().toLocaleString('es-MX')}.
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 300);
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleExportMonthlyMatrix = () => {
    if (!selectedGroupId || students.length === 0) return;
    
    try {
      const group = teacherGroups.find(g => g.id === selectedGroupId);
      const groupName = group ? group.name : 'Grupo';
      const groupKey = group ? group.key : 'key';
      
      const dateParts = attendanceDate.split('-');
      const year = dateParts[0];
      const month = dateParts[1];
      const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      
      const history = JSON.parse(localStorage.getItem('attendance_history') || '[]');
      const groupHistory = history
        .filter(h => h.groupId === selectedGroupId && h.date.startsWith(`${year}-${month}`))
        .sort((a, b) => a.date.localeCompare(b.date));
        
      const sessionDates = groupHistory.map(h => h.date);
      
      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Control de Asistencia</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; padding: 10px; font-size: 10pt; }
            td { border: 1px solid #cbd5e1; padding: 8px; font-size: 9pt; text-align: left; }
            .title-row { font-size: 14pt; font-weight: bold; color: #3b82f6; text-align: left; }
            .meta-row { font-size: 10pt; color: #64748b; font-style: italic; }
            .status-A { color: #15803d; font-weight: bold; background-color: #dcfce7; text-align: center; }
            .status-F { color: #b91c1c; font-weight: bold; background-color: #fee2e2; text-align: center; }
            .status-R { color: #b45309; font-weight: bold; background-color: #fef3c7; text-align: center; }
            .status-J { color: #1d4ed8; font-weight: bold; background-color: #dbeafe; text-align: center; }
            .status-empty { color: #94a3b8; text-align: center; }
            .totals-col { font-weight: bold; text-align: right; background-color: #f1f5f9; }
            .footer-text { font-size: 8pt; color: #94a3b8; font-style: italic; text-align: center; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="${sessionDates.length + 8}" class="title-row" style="border: none;">MATRIZ DE CONTROL DE ASISTENCIA MENSUAL</td>
            </tr>
            <tr>
              <td colspan="${sessionDates.length + 8}" class="meta-row" style="border: none;">
                <strong>Asignatura:</strong> ${groupName} (${groupKey}) | <strong>Docente:</strong> ${user?.name || 'Profesor'} | <strong>Periodo:</strong> ${monthLabel.toUpperCase()}
              </td>
            </tr>
            <tr>
              <td colspan="${sessionDates.length + 8}" class="meta-row" style="border: none;">
                <strong>A</strong> = Asistencia (100%) | <strong>F</strong> = Falta (0%) | <strong>R</strong> = Retardo (80%) | <strong>J</strong> = Justificado (100%)
              </td>
            </tr>
            <tr><td colspan="${sessionDates.length + 8}" style="border: none;"></td></tr>
            
            <thead>
              <tr>
                <th style="width: 120px;">Matrícula</th>
                <th style="width: 250px;">Nombre Completo</th>
                ${sessionDates.map(date => {
                  const day = date.split('-')[2];
                  return `<th style="width: 45px;">${day}/${month}</th>`;
                }).join('')}
                <th style="width: 50px;">Clases</th>
                <th style="width: 50px;">(A)</th>
                <th style="width: 50px;">(F)</th>
                <th style="width: 50px;">(R)</th>
                <th style="width: 50px;">(J)</th>
                <th style="width: 70px;">% Asist.</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));
      
      sortedStudents.forEach(student => {
        let countA = 0;
        let countF = 0;
        let countR = 0;
        let countJ = 0;
        let totalSessions = sessionDates.length;
        
        const rowCells = sessionDates.map(date => {
          const session = groupHistory.find(h => h.date === date);
          const record = session ? session.records.find(r => r.studentId === student.id) : null;
          
          if (!record) {
            return `<td class="status-empty">-</td>`;
          }
          
          const status = record.status;
          if (status === 'A') { countA++; return `<td class="status-A">A</td>`; }
          if (status === 'F') { countF++; return `<td class="status-F">F</td>`; }
          if (status === 'R') { countR++; return `<td class="status-R">R</td>`; }
          if (status === 'J') { countJ++; return `<td class="status-J">J</td>`; }
          
          return `<td class="status-empty">-</td>`;
        });
        
        const scoreSum = (countA * 1.0) + (countR * 0.8) + (countJ * 1.0);
        const monthRate = totalSessions > 0 ? Math.round((scoreSum / totalSessions) * 100) : 100;
        
        htmlContent += `
          <tr>
            <td style="font-family: monospace;">${student.id}</td>
            <td style="font-weight: bold;">${student.name}</td>
            ${rowCells.join('')}
            <td class="totals-col" style="text-align: center;">${totalSessions}</td>
            <td class="totals-col" style="text-align: center; color: #15803d;">${countA}</td>
            <td class="totals-col" style="text-align: center; color: #b91c1c;">${countF}</td>
            <td class="totals-col" style="text-align: center; color: #b45309;">${countR}</td>
            <td class="totals-col" style="text-align: center; color: #1d4ed8;">${countJ}</td>
            <td class="totals-col" style="text-align: right; color: ${monthRate < 80 ? '#b91c1c' : '#15803d'};">${monthRate}%</td>
          </tr>
        `;
      });
      
      htmlContent += `
              <tr><td colspan="${sessionDates.length + 8}" style="border: none;"></td></tr>
              <tr>
                <td colspan="${sessionDates.length + 8}" class="footer-text" style="border: none;">
                  Matriz de control generada automáticamente por RinoAsist el ${new Date().toLocaleString('es-MX')}.
                </td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Matriz_Mensual_${groupKey}_${year}_${month}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Error generating monthly matrix:", e);
    }
  };

  // QR Token generator
  async function loadQrToken(groupId) {
    try {
      const data = await api.generateQrToken(groupId);
      setQrToken(data.token);
    } catch (err) {
      console.error("Error generating QR:", err);
      setQrToken(`mock-qr-token-for-${groupId}-${Date.now()}`);
    }
  }

  const handleOpenQRModal = async (groupId = selectedGroupId) => {
    if (!groupId) return;

    // Validar horario antes de abrir el modal del QR proyectado
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

  // Weekly Agenda Helper
  const getWeeklySchedule = (grupos) => {
    const days = [
      { key: 'Lunes', label: 'Lunes' },
      { key: 'Martes', label: 'Martes' },
      { key: 'Miércoles', label: 'Miércoles' },
      { key: 'Jueves', label: 'Jueves' },
      { key: 'Viernes', label: 'Viernes' }
    ];
    
    const parseSchedule = (scheduleStr) => {
      if (!scheduleStr) return [];
      const occurrences = [];
      const parts = scheduleStr.split(',').map(p => p.trim());
      
      parts.forEach(part => {
        const matchDay = part.match(/^(Lu|Ma|Mi|Ju|Vi|Sa|Lunes|Martes|Miércoles|Miercoles|Jueves|Viernes|Sábado|Sabado)\b/i);
        if (!matchDay) return;
        const dayName = matchDay[1].toLowerCase();
        let dayKey = '';
        if (dayName.startsWith('lu')) dayKey = 'Lunes';
        else if (dayName.startsWith('ma')) dayKey = 'Martes';
        else if (dayName.startsWith('mi')) dayKey = 'Miércoles';
        else if (dayName.startsWith('ju')) dayKey = 'Jueves';
        else if (dayName.startsWith('vi')) dayKey = 'Viernes';
        else if (dayName.startsWith('sa')) dayKey = 'Sábado';
        
        if (!dayKey) return;
        
        // Try 07:00 - 08:40 format
        let matchTime = part.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (matchTime) {
          occurrences.push({
            day: dayKey,
            start: parseInt(matchTime[1]),
            end: Math.ceil(parseInt(matchTime[3]) + parseInt(matchTime[4])/60),
            label: `${matchTime[1]}:${matchTime[2]} - ${matchTime[3]}:${matchTime[4]}`
          });
          return;
        }
        
        // Try 10-11 format
        matchTime = part.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
        if (matchTime) {
          occurrences.push({
            day: dayKey,
            start: parseInt(matchTime[1]),
            end: parseInt(matchTime[2]),
            label: `${matchTime[1].padStart(2, '0')}:00 - ${matchTime[2].padStart(2, '0')}:00`
          });
          return;
        }
      });
      return occurrences;
    };

    // Gather all occurrences first to determine dynamic hours boundary
    const allOccurrences = [];
    if (grupos) {
      grupos.forEach(g => {
        allOccurrences.push(...parseSchedule(g.schedule));
      });
    }
    // If there is any class on Saturday, add Saturday to days
    const hasSaturdayClass = allOccurrences.some(o => o.day === 'Sábado');
    if (hasSaturdayClass) {
      days.push({ key: 'Sábado', label: 'Sábado' });
    }
    let minHour = 7;
    let maxHour = 15;

    if (allOccurrences.length > 0) {
      minHour = Math.min(...allOccurrences.map(o => o.start));
      maxHour = Math.max(...allOccurrences.map(o => o.end));
      
      // Ensure at least 6 slots range for visual completeness
      if (maxHour - minHour < 6) {
        maxHour = minHour + 6;
      }
    } else {
      // Fallback auto-detection of shift if no occurrences are parsed
      let shift = 'Matutino';
      if (grupos && grupos.length > 0) {
        const hasVespertino = grupos.some(g => g.key && g.key.toUpperCase().endsWith('V'));
        if (hasVespertino) {
          shift = 'Vespertino';
        }
      }
      if (shift === 'Vespertino') {
        minHour = 14;
        maxHour = 22;
      } else {
        minHour = 7;
        maxHour = 15;
      }
    }

    const HOURS = [];
    for (let h = minHour; h < maxHour; h++) {
      HOURS.push(h);
    }
    return days.map(d => {
      const dayClasses = [];
      if (grupos) {
        grupos.forEach(g => {
          const occurrences = parseSchedule(g.schedule);
          occurrences.forEach(occ => {
            if (occ.day === d.key) {
              dayClasses.push({
                id: g.id,
                name: g.name,
                key: g.key,
                start: occ.start,
                end: occ.end,
                time: occ.label,
                totalStudents: g.totalStudents,
                asistencia_promedio: g.asistencia_promedio
              });
            }
          });
        });
      }

      const slots = [];
      let skipCount = 0;
      
      HOURS.forEach(hour => {
        if (skipCount > 0) {
          slots.push({ hour, skip: true });
          skipCount--;
          return;
        }
        
        const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
        const cls = dayClasses.find(c => c.start === hour);
        if (cls) {
          const duration = Math.max(1, cls.end - cls.start);
          slots.push({
            hour,
            hourLabel,
            class: cls,
            duration,
            skip: false
          });
          skipCount = duration - 1;
        } else {
          slots.push({
            hour,
            hourLabel,
            class: null,
            skip: false
          });
        }
      });

      return {
        ...d,
        slots
      };
    });
  };

  // Open email alert
  const openEmailModal = (student) => {
    setEmailModal({
      isOpen: true,
      student,
      subject: `Alerta de Asistencia Crítica - RinoAsist`,
      body: `Estimado(a) ${student.name},\n\nTe informamos que tu porcentaje de asistencia actual en la materia de ${student.courseName} es de ${student.attendanceRate}%, el cual se encuentra por debajo del mínimo reglamentario del 80% requerido para aprobar la asignatura.\n\nTe sugerimos ponerte en contacto con tu docente para justificar cualquier inasistencia pendiente a la brevedad.\n\nAtentamente,\nControl escolar - RinoAsist`
    });
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setSendingEmail(true);
    
    const newLog = {
      id: `alert-${Date.now()}`,
      studentId: emailModal.student.id,
      studentName: emailModal.student.name,
      date: new Date().toISOString(),
      subject: emailModal.subject,
      body: emailModal.body
    };
    
    const savedLogs = JSON.parse(localStorage.getItem('sent_email_alerts') || '[]');
    savedLogs.unshift(newLog);
    localStorage.setItem('sent_email_alerts', JSON.stringify(savedLogs));
    setSentAlerts(savedLogs);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    setSendingEmail(false);
    setEmailModal(prev => ({ ...prev, isOpen: false }));
    setEmailToast(true);
    setTimeout(() => setEmailToast(false), 4000);
  };

  // Theme variable configurations
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const primaryChartColor = isDark ? '#3b82f6' : '#0052cc';
  const fontColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = isDark 
    ? { backgroundColor: '#151e36', borderColor: '#1e293b', color: '#f8fafc' } 
    : { backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' };

  const isToday = attendanceDate === new Date().toISOString().split('T')[0];

  // Filter students based on text, status, and risk
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                          s.id.toLowerCase().includes(studentSearch.toLowerCase());
    
    const studentStatus = attendanceRecords[s.id] || 'A';
    const matchesStatus = statusFilter === 'todos' || studentStatus === statusFilter;
    
    const matchesRisk = !showOnlyRisk || s.attendanceRate < 80;
    
    return matchesSearch && matchesStatus && matchesRisk;
  });

  // Sort filtered students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'name_asc') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'name_desc') {
      return b.name.localeCompare(a.name);
    }
    if (sortBy === 'id_asc') {
      return a.id.localeCompare(b.id);
    }
    if (sortBy === 'id_desc') {
      return b.id.localeCompare(a.id);
    }
    if (sortBy === 'rate_asc') {
      return a.attendanceRate - b.attendanceRate;
    }
    if (sortBy === 'rate_desc') {
      return b.attendanceRate - a.attendanceRate;
    }
    return 0;
  });

  return (
    <div className="space-y-8 relative">
      {/* Connection Indicator Floating Badge */}
      <div className="flex justify-end">
        {isOnline ? (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-450 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm theme-transition">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Sistema Sincronizado</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-500 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm animate-pulse theme-transition">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
            <span>Modo Local / Sin Conexión</span>
          </div>
        )}
      </div>

      {/* Connection Toast Notifications */}
      {connectionToast.show && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-scale-in max-w-sm border backdrop-blur-md transition-all duration-300 ${
          connectionToast.isOnline 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
        }`}>
          {connectionToast.isOnline ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 animate-pulse" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 animate-pulse" />
          )}
          <div className="space-y-0.5 text-left">
            <h5 className="font-extrabold text-sm text-txt-base">
              {connectionToast.isOnline ? 'Conexión Restablecida' : 'Sin Conexión a Internet'}
            </h5>
            <p className="text-xs text-txt-muted font-semibold">
              {connectionToast.isOnline 
                ? 'El sistema está conectado y sincronizando de nuevo.' 
                : 'Trabajando en modo local fuera de línea temporalmente.'}
            </p>
          </div>
        </div>
      )}
      
      {/* ---------------- 1. TAB: RESUMEN (Overview) ---------------- */}
      {activeTab === 'resumen' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Filters & Week Selection */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 theme-transition">
            <div>
              <h3 className="text-lg font-bold">Resumen de Control Docente</h3>
              <p className="text-txt-muted text-xs mt-0.5">Analiza el rendimiento general de tus asignaturas asignadas.</p>
            </div>
            
            <div className="flex items-center gap-3.5 w-full sm:w-auto shrink-0 justify-end">
              <label className="text-xs font-bold text-txt-muted whitespace-nowrap">Semana de consulta:</label>
              <select 
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs font-semibold cursor-pointer theme-transition w-full sm:w-44"
              >
                <option value="w1">Semana Actual (25-29 May)</option>
                <option value="w2">Semana Anterior (18-22 May)</option>
                <option value="w3">Hace 2 Semanas (11-15 May)</option>
                <option value="w4">Hace 3 Semanas (04-08 May)</option>
              </select>
            </div>
          </div>

          {loadingOverview ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition animate-pulse">
                    <div className="flex justify-between items-start mb-3">
                      <div className="h-3 w-24 bg-bg-surface rounded-md"></div>
                      <div className="h-7 w-7 bg-bg-surface rounded-lg"></div>
                    </div>
                    <div className="h-8 w-16 bg-bg-surface rounded-md mt-2"></div>
                    <div className="h-3.5 w-32 bg-bg-surface rounded-md mt-2"></div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {[1, 2].map(i => (
                  <div key={i} className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition animate-pulse">
                    <div className="h-4 w-36 bg-bg-surface rounded-md"></div>
                    <div className="h-3 w-48 bg-bg-surface rounded-md mt-1.5"></div>
                    <div className="h-56 bg-bg-surface rounded-xl mt-6"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Teacher KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {/* KPI 1: Average Attendance */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Asistencia Promedio</span>
                    <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
                      <UserCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base text-left">
                    {teacherOverview?.grupos?.length > 0 
                      ? Math.round(teacherOverview.grupos.reduce((acc, g) => acc + g.asistencia_promedio, 0) / teacherOverview.grupos.length)
                      : 85}%
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-450 font-semibold mt-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Estable esta semana</span>
                  </div>
                </div>

                {/* KPI 2: Students at risk */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition cursor-pointer hover:border-brand-primary/45" onClick={() => setActiveTab('riesgo')}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Alumnos en Riesgo</span>
                    <div className="bg-rose-500/10 text-rose-600 dark:text-rose-455 p-1.5 rounded-lg border border-rose-500/10">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base text-left">
                    {teacherOverview?.alumnosEnRiesgo?.length || 0}
                  </div>
                  <div className="text-[10px] text-txt-subtle font-semibold mt-1.5 text-left">
                    Tienen asistencia &lt; 80%
                  </div>
                </div>

                {/* KPI 3: Active Groups */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Grupos Activos</span>
                    <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base text-left">
                    {teacherOverview?.grupos?.length || 0}
                  </div>
                  <div className="text-[10px] text-txt-subtle font-semibold mt-1.5 text-left">
                    Grupos asignados
                  </div>
                </div>

                {/* KPI 4: Compliance rate */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Cumplimiento Lista</span>
                    <div className="bg-indigo-500/10 text-indigo-500 p-1.5 rounded-lg border border-indigo-500/10">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-txt-base text-left">
                    {(() => {
                      const totalList = teacherOverview?.cumplimiento?.length || 8;
                      const doneList = teacherOverview?.cumplimiento?.filter(c => c.estado === 'Completado').length || 8;
                      return Math.round((doneList / totalList) * 100);
                    })()}%
                  </div>
                  <div className="text-[10px] text-txt-subtle font-semibold mt-1.5 text-left">
                    Pases de lista registrados
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* General Trend Chart */}
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm lg:col-span-2 flex flex-col justify-between theme-transition text-left">
                  <div>
                    <h4 className="font-extrabold text-base">Historial Temporal de Asistencias</h4>
                    <p className="text-xs text-txt-muted mt-0.5">Tasa general de asistencia promedio de tus alumnos.</p>
                  </div>
                  <div className="h-56 w-full text-[10px] mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={teacherOverview?.series || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTeacherAsist" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryChartColor} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={primaryChartColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="label" stroke={fontColor} />
                        <YAxis domain={[0, 100]} stroke={fontColor} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="asistencias" stroke={primaryChartColor} strokeWidth={2} fillOpacity={1} fill="url(#colorTeacherAsist)" connectNulls={true} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Compare Groups Attendance Rate */}
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col justify-between theme-transition text-left">
                  <div>
                    <h4 className="font-extrabold text-base">Comparación de Grupos</h4>
                    <p className="text-xs text-txt-muted mt-0.5 font-semibold">Tasa consolidada acumulada de asistencia por grupo.</p>
                  </div>
                  <div className="h-56 w-full text-[10px] mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={teacherOverview?.grupos || []} margin={{ top: 10, right: 5, left: -30, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="name" stroke={fontColor} tickFormatter={(v) => v.split(' ').slice(-1)[0]} />
                        <YAxis domain={[0, 100]} stroke={fontColor} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="asistencia_promedio" fill={primaryChartColor} radius={[4, 4, 0, 0]}>
                          {(teacherOverview?.grupos || []).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.asistencia_promedio < 80 ? '#f43f5e' : '#10b981'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Weekly Interactive Timetable agenda */}
              <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition text-left">
                <div>
                  <h4 className="font-extrabold text-lg">Distribución de Horario Semanal (Agenda)</h4>
                  <p className="text-xs text-txt-muted mt-0.5">Calendario interactivo. Haz clic en una materia para abrir detalles o iniciar pase de lista.</p>
                </div>

                {(() => {
                  const scheduleDays = getWeeklySchedule(teacherOverview?.grupos);
                  const gridColsClass = scheduleDays.length === 6 ? 'md:grid-cols-6' : 'md:grid-cols-5';
                  return (
                    <div className={`grid grid-cols-1 ${gridColsClass} gap-3`}>
                      {scheduleDays.map((day) => (
                        <div key={day.key} className="flex flex-col gap-2 p-3 rounded-xl border border-bdr-base bg-bg-surface/50 theme-transition">
                          <span className="text-xs font-bold text-txt-muted border-b border-bdr-base pb-1.5 block text-center uppercase tracking-wider">{day.label}</span>
                          <div className="flex-1 flex flex-col gap-2 mt-1">
                            {day.slots.map((slot, idx) => {
                              if (slot.skip) return null;
                              if (slot.class) {
                                const cls = slot.class;
                                const duration = slot.duration;
                                const height = duration * 55 + (duration - 1) * 8;
                                return (
                                  <button 
                                    key={`${cls.id}-${idx}`} 
                                    type="button"
                                    onClick={() => setSelectedClassDetailModal({ isOpen: true, classData: cls })}
                                    style={{ height: `${height}px` }}
                                    className="p-2.5 rounded-lg border border-brand-primary/20 bg-brand-primary/5 hover:bg-brand-primary/10 hover:border-brand-primary/45 transition-all text-txt-base flex flex-col justify-between cursor-pointer w-full text-left active:scale-[0.98] outline-none overflow-hidden"
                                  >
                                    <div className="flex items-start justify-between gap-1 w-full">
                                      <span className="text-xs font-bold leading-tight block break-words line-clamp-2 text-left" title={cls.name}>
                                        {cls.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] gap-1 w-full mt-auto">
                                      <span className="font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.2 rounded border border-brand-primary/20 shrink-0">{cls.key}</span>
                                      <span className="text-txt-muted font-medium truncate">{cls.time}</span>
                                    </div>
                                  </button>
                                );
                              } else {
                                return (
                                  <div key={`empty-${idx}`} style={{ height: '55px' }} className="rounded-lg border border-dashed border-bdr-base/20 flex items-center justify-center bg-bg-surface/5 theme-transition">
                                    <span className="text-[9px] text-txt-subtle/40 font-bold">{slot.hourLabel}</span>
                                  </div>
                                );
                              }
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------------- 2. TAB: PASE DE LISTA (Take Attendance) ---------------- */}
      {activeTab === 'pase_lista' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header controls for teacher */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center shadow-sm theme-transition">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              {/* Select Group */}
              <div className="space-y-1.5 flex-1 sm:flex-initial text-left">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Seleccionar Grupo</label>
                <select 
                  value={selectedGroupId} 
                  onChange={handleGroupChange}
                  disabled={true}
                  className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none font-semibold text-sm w-full cursor-not-allowed opacity-75 theme-transition"
                >
                  {teacherGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.key})</option>
                  ))}
                </select>
                {selectedGroupId && (
                  <span className="text-[11px] text-brand-primary font-bold mt-1 block animate-fadeIn">
                    Horario: {teacherGroups.find(g => g.id.toString() === selectedGroupId.toString())?.schedule || 'Sin horario'}
                  </span>
                )}
              </div>

              {/* Date Picker */}
              <div className="space-y-1.5 flex-1 sm:flex-initial text-left">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Fecha de Asistencia</label>
                <input 
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none font-semibold text-sm w-full theme-transition"
                />
              </div>
            </div>

            {/* Action buttons */}
            {!isReadOnly && (
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto self-stretch lg:self-auto">
                <button 
                  onClick={() => setShowToleranceSettings(!showToleranceSettings)}
                  className="bg-bg-surface border border-bdr-base hover:bg-bg-surface/80 text-txt-base font-bold py-3 px-5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-txt-muted" />
                  <span>Tolerancias QR</span>
                </button>

                <button 
                  onClick={() => handleOpenQRModal()}
                  className="bg-brand-primary hover:bg-brand-hover text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.02] transition-all flex items-center gap-2.5 justify-center cursor-pointer animate-fadeIn"
                >
                  <QrCode className="w-5 h-5" />
                  <span>Iniciar Escáner QR</span>
                </button>

                <button 
                  onClick={handleOpenCredentialScanner}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 hover:scale-[1.02] transition-all flex items-center gap-2.5 justify-center cursor-pointer animate-fadeIn"
                >
                  <Camera className="w-5 h-5" />
                  <span>Escanear Credenciales</span>
                </button>
              </div>
            )}
          </div>

          {/* QR Tolerances configuration panel */}
          {showToleranceSettings && (
            <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-md theme-transition animate-slideDown text-left space-y-4">
              <div className="flex justify-between items-center border-b border-bdr-base/60 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-primary" />
                  <h4 className="font-extrabold text-sm uppercase tracking-wider">Ajustes de Tolerancia QR</h4>
                </div>
                <button 
                  onClick={() => setShowToleranceSettings(false)}
                  className="text-txt-muted hover:text-txt-base font-bold text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-txt-muted block">Minutos Límite de Asistencia (A)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max="60"
                      value={tolerancePresent} 
                      onChange={(e) => setTolerancePresent(parseInt(e.target.value) || 10)}
                      className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none font-semibold text-sm w-full theme-transition"
                    />
                    <span className="text-xs font-bold text-txt-muted whitespace-nowrap">minutos</span>
                  </div>
                  <p className="text-[10px] text-txt-subtle">
                    Alumnos que escaneen antes de este tiempo obtienen Asistencia (A).
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-txt-muted block">Minutos Límite de Retardo (R)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max="120"
                      value={toleranceTardy} 
                      onChange={(e) => setToleranceTardy(parseInt(e.target.value) || 20)}
                      className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none font-semibold text-sm w-full theme-transition"
                    />
                    <span className="text-xs font-bold text-txt-muted whitespace-nowrap">minutos</span>
                  </div>
                  <p className="text-[10px] text-txt-subtle">
                    Alumnos que escaneen después del límite de asistencia y antes de este límite obtienen Retardo (R). Posterior a esto, se registra Falta (F).
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base/60">
                <button 
                  onClick={() => setShowToleranceSettings(false)}
                  className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveTolerance}
                  className="px-5 py-2.5 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-[0.98]"
                >
                  Guardar Tolerancias
                </button>
              </div>
            </div>
          )}

          {/* Students Table and Filter list */}
          <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
            
            {/* Table actions bar */}
            <div className="p-6 border-b border-bdr-base space-y-6 theme-transition">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-left flex flex-col sm:flex-row sm:items-center gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Listado de Alumnos</h3>
                    <p className="text-txt-muted text-xs mt-0.5">Asigna el estatus correspondiente para cada alumno.</p>
                  </div>
                  <div className="mt-1 sm:mt-0 select-none flex flex-col sm:flex-row sm:items-center gap-2">
                    {isExistingSession ? (
                      <>
                        <span className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-[10px] px-2.5 py-1 rounded-xl font-bold uppercase flex items-center gap-1.5 w-fit">
                          <Clock className="w-3.5 h-3.5" />
                          Editando Pase de Lista
                        </span>
                        {lastModified && (
                          <span className="text-[10px] text-txt-muted font-semibold mt-0.5 sm:mt-0">
                            (Última mod: {lastModified})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] px-2.5 py-1 rounded-xl font-bold uppercase flex items-center gap-1.5 w-fit animate-pulse-subtle">
                        <UserCheck className="w-3.5 h-3.5" />
                        Nuevo Registro
                      </span>
                    )}
                  </div>
                </div>
                
                {saveSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-450 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold animate-fadeIn theme-transition">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Asistencia guardada con éxito!</span>
                  </div>
                )}
              </div>

              {!isToday && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3.5 flex items-center gap-3 text-amber-800 dark:text-amber-400 text-xs font-semibold theme-transition animate-fadeIn mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Modo de Solo Lectura: La fecha seleccionada no corresponde al día de hoy. No es posible realizar modificaciones.</span>
                </div>
              )}

              {/* Real-time counters panel */}
              <div className="grid grid-cols-5 gap-3 border-y border-bdr-base/60 py-4 theme-transition">
                {(() => {
                  const counts = { A: 0, F: 0, R: 0, J: 0 };
                  students.forEach(s => {
                    const status = attendanceRecords[s.id] || 'A';
                    if (counts[status] !== undefined) counts[status]++;
                  });
                  return (
                    <>
                      <div className="bg-bg-surface/50 border border-bdr-base/40 p-2.5 rounded-xl text-center">
                        <div className="text-xs text-txt-subtle font-bold uppercase tracking-wider">Total</div>
                        <div className="text-xl font-extrabold text-txt-base mt-1">{students.length}</div>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/15 p-2.5 rounded-xl text-center">
                        <div className="text-xs text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wider">Asistencias</div>
                        <div className="text-xl font-extrabold text-emerald-500 mt-1">{counts.A}</div>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/15 p-2.5 rounded-xl text-center">
                        <div className="text-xs text-rose-600 dark:text-rose-500 font-bold uppercase tracking-wider">Faltas</div>
                        <div className="text-xl font-extrabold text-rose-500 mt-1">{counts.F}</div>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/15 p-2.5 rounded-xl text-center">
                        <div className="text-xs text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider">Retardos</div>
                        <div className="text-xl font-extrabold text-amber-500 mt-1">{counts.R}</div>
                      </div>
                      <div className="bg-brand-primary/5 border border-brand-primary/15 p-2.5 rounded-xl text-center">
                        <div className="text-xs text-brand-primary font-bold uppercase tracking-wider">Justificados</div>
                        <div className="text-xl font-extrabold text-brand-primary mt-1">{counts.J}</div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Filters toolbar row */}
              <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Status Filter Pills */}
                  <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 shrink-0 theme-transition select-none">
                    {[
                      { id: 'todos', label: 'Todos' },
                      { id: 'A', label: 'Asistencias' },
                      { id: 'F', label: 'Faltas' },
                      { id: 'R', label: 'Retardos' },
                      { id: 'J', label: 'Justificados' }
                    ].map(pill => (
                      <button
                        key={pill.id}
                        onClick={() => setStatusFilter(pill.id)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all select-none ${
                          statusFilter === pill.id
                            ? pill.id === 'A' ? 'bg-emerald-500 text-white shadow-sm'
                              : pill.id === 'F' ? 'bg-rose-500 text-white shadow-sm'
                              : pill.id === 'R' ? 'bg-amber-500 text-white shadow-sm'
                              : pill.id === 'J' ? 'bg-brand-primary text-white shadow-sm'
                              : 'bg-brand-primary text-white shadow-sm'
                            : 'text-txt-muted hover:text-brand-primary'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  {/* Show Only Risk switch toggle */}
                  <div className="flex items-center gap-2 bg-bg-surface border border-bdr-base px-3.5 py-1.5 rounded-xl theme-transition select-none">
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showOnlyRisk} 
                        onChange={(e) => setShowOnlyRisk(e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-bg-card border border-bdr-base peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-txt-subtle peer-checked:after:bg-white after:border-bdr-base after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:bg-bg-base dark:border-bdr-base peer-checked:bg-brand-primary"></div>
                      <span className="ml-2 text-[11px] font-extrabold text-txt-muted">Mostrar alumnos en riesgo (&lt;80%)</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 justify-end w-full lg:w-auto">
                  {/* Sorting Selector */}
                  <div className="flex items-center gap-2 bg-bg-surface border border-bdr-base px-3 py-1.5 rounded-xl theme-transition select-none">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">Ordenar:</label>
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-transparent text-txt-base outline-none text-[11px] font-bold cursor-pointer theme-transition"
                    >
                      <option value="name_asc">Nombre (A-Z)</option>
                      <option value="name_desc">Nombre (Z-A)</option>
                      <option value="id_asc">Matrícula (Asc)</option>
                      <option value="id_desc">Matrícula (Desc)</option>
                      <option value="rate_asc">Asist. % (Menor a Mayor)</option>
                      <option value="rate_desc">Asist. % (Mayor a Menor)</option>
                    </select>
                  </div>

                  {/* Search field */}
                  <div className="relative flex-grow sm:flex-initial group">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-txt-subtle group-focus-within:text-brand-primary">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Buscar alumno..."
                      className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-2 pl-9.5 pr-4 text-txt-base placeholder-txt-subtle/60 outline-none text-xs theme-transition w-full sm:w-44"
                    />
                  </div>

                  {/* Bulk controls and Reset */}
                  <div className={`flex items-center gap-1.5 border border-bdr-base bg-bg-surface rounded-xl p-1 shrink-0 theme-transition select-none ${!isToday ? 'opacity-55' : ''}`}>
                    <button 
                      onClick={() => handleBulkStatusChange('A')}
                      disabled={!isToday}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 hover:bg-emerald-500/10 text-emerald-600 rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title="Marcar todos como presentó"
                    >
                      Todos Asistió (A)
                    </button>
                    <span className="text-txt-subtle text-[10px]">•</span>
                    <button 
                      onClick={() => handleBulkStatusChange('F')}
                      disabled={!isToday}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 hover:bg-rose-500/10 text-rose-650 dark:text-rose-500 rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title="Marcar todos como falta"
                    >
                      Todos Falta (F)
                    </button>
                    <span className="text-txt-subtle text-[10px]">•</span>
                    <button 
                      onClick={() => loadStudentListAndAttendance(selectedGroupId, attendanceDate)}
                      disabled={!isToday}
                      className="text-[10px] font-extrabold px-2.5 py-1.5 hover:bg-slate-500/10 text-txt-muted rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      title="Restablecer a los valores guardados"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                    <th className="py-4 px-6">ID Alumno</th>
                    <th className="py-4 px-6">Nombre Completo</th>
                    <th className="py-4 px-6">Porcentaje Asistencia</th>
                    <th className="py-4 px-6 text-center">Registro de Estado</th>
                    <th className="py-4 px-6">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-subtle/50 theme-transition">
                  {sortedStudents.map((student) => {
                    const isAtRisk = student.attendanceRate < 80;
                    return (
                      <tr key={student.id} className="hover:bg-bg-surface/30 transition-colors duration-200">
                        <td className="py-4 px-6 font-mono text-xs font-semibold text-txt-subtle">{student.id}</td>
                        <td className="py-4 px-6 text-left">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentProfile(student)}
                            className="font-semibold text-txt-base hover:underline hover:text-brand-primary transition-all text-left outline-none"
                          >
                            {student.name}
                          </button>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isAtRisk ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-450'}`}>
                              {student.attendanceRate}%
                            </span>
                            {isAtRisk && (
                              <span className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase animate-pulse">
                                Riesgo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-center items-center gap-1.5">
                            {/* Option A */}
                            <button
                              onClick={() => handleStatusChange(student.id, 'A')}
                              disabled={!isToday || isReadOnly}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-300 disabled:opacity-75 disabled:cursor-not-allowed ${
                                attendanceRecords[student.id] === 'A'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-455 border-emerald-500/40 shadow-sm'
                                  : 'bg-bg-surface text-txt-muted border-bdr-base hover:border-brand-primary/40 hover:text-brand-primary'
                              }`}
                            >
                              Asistió (A)
                            </button>
                            
                            {/* Option F */}
                            <button
                              onClick={() => handleStatusChange(student.id, 'F')}
                              disabled={!isToday || isReadOnly}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-300 disabled:opacity-75 disabled:cursor-not-allowed ${
                                attendanceRecords[student.id] === 'F'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/40 shadow-sm'
                                  : 'bg-bg-surface text-txt-muted border-bdr-base hover:border-brand-primary/40 hover:text-brand-primary'
                              }`}
                            >
                              Falta (F)
                            </button>

                            {/* Option R */}
                            <button
                              onClick={() => handleStatusChange(student.id, 'R')}
                              disabled={!isToday || isReadOnly}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-300 disabled:opacity-75 disabled:cursor-not-allowed ${
                                attendanceRecords[student.id] === 'R'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-450 border-amber-500/40 shadow-sm'
                                  : 'bg-bg-surface text-txt-muted border-bdr-base hover:border-brand-primary/40 hover:text-brand-primary'
                              }`}
                            >
                              Retardo (R)
                            </button>

                            {/* Option J */}
                            <button
                              onClick={() => handleStatusChange(student.id, 'J')}
                              disabled={!isToday || isReadOnly}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-300 disabled:opacity-75 disabled:cursor-not-allowed ${
                                attendanceRecords[student.id] === 'J'
                                  ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30 shadow-sm'
                                  : 'bg-bg-surface text-txt-muted border-bdr-base hover:border-brand-primary/40 hover:text-brand-primary'
                              }`}
                            >
                              Justificado (J)
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-left">
                          <input 
                            type="text"
                            value={attendanceNotes[student.id] || ''}
                            onChange={(e) => handleNoteChange(student.id, e.target.value)}
                            disabled={!isToday || isReadOnly}
                            placeholder={isToday && !isReadOnly ? "Agregar nota..." : "Sin nota"}
                            className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 text-xs w-full max-w-[200px] outline-none theme-transition disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {sortedStudents.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-sm text-txt-subtle italic">
                        No se encontraron alumnos coincidentes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-bdr-base flex justify-end items-center gap-3 theme-transition">
              <button
                onClick={handleExportCSV}
                disabled={students.length === 0}
                className="bg-bg-surface border border-bdr-base hover:bg-bg-surface/80 text-txt-base font-bold py-3.5 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-5 h-5 text-txt-muted" />
                <span>Exportar a CSV</span>
              </button>

              <button
                onClick={handleExportPDF}
                disabled={students.length === 0}
                className="bg-bg-surface border border-bdr-base hover:bg-bg-surface/80 text-txt-base font-bold py-3.5 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-5 h-5 text-rose-500" />
                <span>Exportar a PDF</span>
              </button>

              <button
                onClick={handleExportMonthlyMatrix}
                disabled={students.length === 0}
                className="bg-bg-surface border border-bdr-base hover:bg-bg-surface/80 text-txt-base font-bold py-3.5 px-6 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exportar matriz de asistencia mensual de este grupo en Excel"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                <span>Matriz Mensual (Excel)</span>
              </button>

              {isToday && !isReadOnly && (
                <button
                  onClick={handleSaveClick}
                  disabled={savingAttendance || students.length === 0}
                  className="bg-brand-primary hover:bg-brand-hover disabled:bg-brand-primary/80 disabled:opacity-60 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-brand-primary/20 transition-all duration-350 flex items-center gap-2 cursor-pointer animate-fadeIn"
                >
                  {savingAttendance ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Enviar Asistencia</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 3. TAB: ALUMNOS EN RIESGO (Students at Risk) ---------------- */}
      {activeTab === 'riesgo' && (
        <div className="space-y-8 animate-fadeIn text-left">
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="text-rose-500 w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold">Alumnos en Riesgo Crítico</h3>
                <p className="text-txt-muted text-xs mt-0.5">Estudiantes inscritos en tus materias con un porcentaje de asistencia inferior al 80% mínimo requerido.</p>
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                    <th className="py-4 px-6">ID Alumno</th>
                    <th className="py-4 px-6">Nombre Completo</th>
                    <th className="py-4 px-6">Asignatura</th>
                    <th className="py-4 px-6">Porcentaje Asistencia</th>
                    <th className="py-4 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-subtle/50 theme-transition">
                  {teacherOverview?.alumnosEnRiesgo?.map((s) => (
                    <tr key={s.id} className="hover:bg-bg-surface/30">
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-txt-subtle">{s.id}</td>
                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentProfile({ id: s.id, name: s.name });
                          }}
                          className="font-semibold text-txt-base hover:underline hover:text-brand-primary transition-all text-left outline-none"
                        >
                          {s.name}
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-txt-muted">{s.courseName}</span>
                          <span className="text-[10px] font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.2 rounded border border-brand-primary/20">
                            {s.courseKey}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs font-extrabold text-rose-500">
                          {s.attendanceRate}%
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => openEmailModal(s)}
                          className="px-3.5 py-2 border border-brand-primary hover:bg-brand-primary/5 text-brand-primary rounded-xl text-xs font-semibold flex items-center gap-1.5 mx-auto transition-all cursor-pointer"
                        >
                          <Mail className="w-4 h-4" />
                          <span>Notificar Alumno</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!teacherOverview?.alumnosEnRiesgo || teacherOverview.alumnosEnRiesgo.length === 0) && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-sm text-emerald-500 font-semibold">
                        ✔ No hay alumnos con asistencia en estado crítico en tus materias. ¡Buen trabajo!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. TAB: HISTORIAL (Logs) ---------------- */}
      {activeTab === 'historial' && (
        <div className="space-y-8 animate-fadeIn text-left">
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition">
            <div>
              <h3 className="text-lg font-bold">Historial de Clases e Inasistencias</h3>
              <p className="text-txt-muted text-xs mt-0.5">Control de registros y asistencias en las sesiones escolares recientes de tu agenda.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                    <th className="py-4 px-6">Fecha</th>
                    <th className="py-4 px-6">Materia</th>
                    <th className="py-4 px-6">Grupo</th>
                    <th className="py-4 px-6">Hora</th>
                    <th className="py-4 px-6">Estado de Lista</th>
                    <th className="py-4 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-subtle/50 theme-transition text-sm">
                  {teacherOverview?.cumplimiento?.map((session) => {
                    const isDone = session.estado === 'Completado';
                    const dateFormatted = new Date(session.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    });
                    
                    return (
                      <tr key={session.id} className="hover:bg-bg-surface/30">
                        <td className="py-4 px-6 font-semibold text-txt-base capitalize">{dateFormatted}</td>
                        <td className="py-4 px-6 font-semibold text-txt-muted">{session.materia}</td>
                        <td className="py-4 px-6">
                          <span className="font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.2 rounded border border-brand-primary/20 text-xs">
                            {session.grupo}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-txt-subtle">{session.hora} hrs</td>
                        <td className="py-4 px-6">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                            isDone 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/35'
                          }`}>
                            {session.estado.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => {
                              // Find corresponding group ID
                              const matchedGroup = teacherGroups.find(g => g.key === session.grupo || g.name === session.materia);
                              if (matchedGroup) {
                                setSelectedGroupId(matchedGroup.id);
                                loadStudentListAndAttendance(matchedGroup.id, session.fecha);
                              }
                              setAttendanceDate(session.fecha);
                              setActiveTab('pase_lista');
                            }}
                            className={`px-3 py-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isDone || (session.fecha !== new Date().toISOString().split('T')[0])
                                ? 'border-bdr-base text-txt-muted hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5'
                                : 'bg-brand-primary hover:bg-brand-hover text-white border-transparent shadow-sm'
                            }`}
                          >
                            {session.fecha === new Date().toISOString().split('T')[0]
                              ? (isDone ? 'Editar Lista' : 'Registrar Ahora')
                              : 'Ver Detalles'
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(!teacherOverview?.cumplimiento || teacherOverview.cumplimiento.length === 0) && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-sm text-txt-subtle italic">
                        No se registran sesiones calendarizadas recientemente
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4d. TAB: ESCANEOS (Scan Logs) ---------------- */}
      {activeTab === 'escaneos' && (
        <div className="space-y-8 animate-fadeIn text-left">
          {/* Header */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 theme-transition">
            <div>
              <h3 className="text-lg font-bold">Bitácora de Escaneos QR</h3>
              <p className="text-txt-muted text-xs mt-0.5">Auditoría de asistencia organizada por materia para verificar los marcajes de asistencia por código QR.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={scanLogsGroupIdFilter}
                onChange={(e) => setScanLogsGroupIdFilter(e.target.value)}
                className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base text-xs rounded-xl py-2 px-3.5 outline-none font-bold cursor-pointer theme-transition"
              >
                <option value="all">Todas las materias</option>
                {teacherGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.key})</option>
                ))}
              </select>
              <button
                onClick={loadScanLogs}
                className="bg-bg-surface hover:bg-bg-surface/80 border border-bdr-base text-txt-base p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center text-xs font-bold gap-1.5"
                title="Actualizar bitácora"
              >
                <RefreshCw className={`w-4 h-4 ${loadingScanLogs ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-bg-card border border-bdr-base p-4 rounded-2xl shadow-sm flex items-center gap-3 theme-transition">
            <Search className="w-5 h-5 text-txt-muted" />
            <input
              type="text"
              placeholder="Buscar por nombre de alumno o matrícula en todas las materias..."
              value={scanLogsSearchQuery}
              onChange={(e) => setScanLogsSearchQuery(e.target.value)}
              className="flex-grow bg-transparent text-sm text-txt-base placeholder-txt-muted outline-none"
            />
            {scanLogsSearchQuery && (
              <button 
                onClick={() => setScanLogsSearchQuery('')}
                className="text-xs text-txt-muted hover:text-brand-primary font-bold cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Group Accordions */}
          <div className="space-y-4">
            {teacherGroups
              .filter(group => scanLogsGroupIdFilter === 'all' || group.id === scanLogsGroupIdFilter)
              .map(group => {
                const groupLogs = filteredScanLogs.filter(log => log.groupKey === group.key);
                const isExpanded = !!expandedScanGroups[group.key] || scanLogsGroupIdFilter !== 'all';
                
                return (
                  <div key={group.id} className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-sm theme-transition">
                    {/* Header */}
                    <button
                      onClick={() => toggleScanGroup(group.key)}
                      className="w-full flex items-center justify-between p-5 bg-bg-surface/40 hover:bg-bg-surface/75 text-left transition-all outline-none"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-brand-primary/10 px-3.5 py-2 rounded-xl border border-brand-primary/20 flex flex-col items-center justify-center text-brand-primary min-w-[75px] text-center shadow-sm">
                          <span className="text-[9px] uppercase font-extrabold tracking-wider opacity-85 leading-none">Grupo</span>
                          <span className="text-sm sm:text-base font-black tracking-tight leading-none mt-1">{group.key}</span>
                        </div>
                        <div>
                          <h4 className="font-extrabold text-txt-base text-sm sm:text-base leading-tight">{group.name}</h4>
                          <span className="text-[10px] text-txt-muted font-semibold tracking-wide uppercase mt-1 block">{group.schedule}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          groupLogs.length > 0 
                            ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/25'
                            : 'bg-bg-surface text-txt-muted border-bdr-base'
                        }`}>
                          {groupLogs.length} {groupLogs.length === 1 ? 'registro' : 'registros'}
                        </span>
                        <ChevronDown className={`w-5 h-5 text-txt-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Content (Table) */}
                    {isExpanded && (
                      <div className="border-t border-bdr-base/50 animate-fadeIn overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-bg-surface/20 text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base/40 theme-transition">
                              <th className="py-4 px-6">Alumno</th>
                              <th className="py-4 px-6">Fecha y Hora</th>
                              <th className="py-4 px-6">Tipo</th>
                              <th className="py-4 px-6">Estatus</th>
                              <th className="py-4 px-6">Detalles / Notas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-bdr-subtle/50 theme-transition text-sm">
                            {groupLogs.map((log) => {
                              const isQr = log.notes && (log.notes.includes('QR') || log.notes.toLowerCase().includes('código'));
                              return (
                                <tr key={log.id} className="hover:bg-bg-surface/30">
                                  <td className="py-4 px-6">
                                    <div className="font-semibold text-txt-base">{log.studentName}</div>
                                    <div className="text-[10px] text-txt-muted mt-0.5 font-medium">{log.studentMatricula}</div>
                                  </td>
                                  <td className="py-4 px-6 font-medium text-txt-subtle capitalize">
                                    {new Date(log.timestamp.replace(' ', 'T')).toLocaleDateString('es-MX', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </td>
                                  <td className="py-4 px-6">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                      isQr 
                                        ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' 
                                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                    }`}>
                                      {isQr ? 'Código QR' : 'Manual'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                                      log.status === 'A'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20' 
                                        : log.status === 'R'
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/35'
                                        : log.status === 'J'
                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-500 border-blue-500/35'
                                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20'
                                    }`}>
                                      {log.status === 'A' ? 'ASISTIÓ' : log.status === 'R' ? 'RETARDO' : log.status === 'J' ? 'JUSTIFICADO' : 'FALTA'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 text-txt-subtle italic text-xs font-medium">
                                    {log.notes || 'Sin anotaciones'}
                                  </td>
                                </tr>
                              );
                            })}
                            {groupLogs.length === 0 && (
                              <tr>
                                <td colSpan="5" className="py-8 text-center text-sm text-txt-subtle italic">
                                  No hay escaneos o registros en esta materia para la búsqueda especificada.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ---------------- 4b. TAB: JUSTIFICANTES (Excuses) ---------------- */}
      {activeTab === 'justificantes' && (
        <JustificantesTab isDocente={true} docenteId={user.id} />
      )}

      {/* ---------------- 4c. TAB: ANALITICAS (Analytics) ---------------- */}
      {activeTab === 'analiticas' && (
        <div className="space-y-8 animate-fadeIn text-left">
          {/* Header & Group Selector */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 theme-transition">
            <div>
              <h3 className="text-lg font-bold">Panel de Analíticas y Reportes</h3>
              <p className="text-txt-muted text-xs mt-0.5">Indicadores clave de asistencia y alertas tempranas del grupo seleccionado.</p>
            </div>
            
            <div className="flex items-center gap-3.5 w-full sm:w-auto shrink-0 justify-end">
              <label className="text-xs font-bold text-txt-muted whitespace-nowrap">Grupo:</label>
              <select 
                value={selectedGroupId}
                onChange={handleGroupChange}
                className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs font-semibold cursor-pointer theme-transition w-full sm:w-44"
              >
                {teacherGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.key})</option>
                ))}
              </select>
            </div>
          </div>

          {!analyticsData || !analyticsData.hasHistory ? (
            <div className="bg-bg-card border border-bdr-base p-10 rounded-2xl text-center space-y-3 theme-transition">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="font-bold text-base">Sin Datos de Asistencia Suficientes</h4>
              <p className="text-xs text-txt-muted max-w-sm mx-auto">
                Este grupo aún no tiene pases de lista registrados en el sistema para calcular las métricas de asistencia.
              </p>
            </div>
          ) : (
            <>
              {/* KPIs Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Worst Session */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Peor Asistencia</span>
                    <div className="bg-rose-500/10 text-rose-650 p-1.5 rounded-lg border border-rose-500/10">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-txt-base">
                    {analyticsData.worstRate}%
                  </div>
                  <div className="text-[10px] text-rose-500 font-semibold mt-1">
                    Sesión: {new Date(analyticsData.worstDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </div>
                </div>

                {/* Worst Student */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Mayor Rezago</span>
                    <div className="bg-rose-500/10 text-rose-650 p-1.5 rounded-lg border border-rose-500/10">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-txt-base truncate" title={analyticsData.worstStudentName}>
                    {analyticsData.worstStudentRate}%
                  </div>
                  <div className="text-[10px] text-txt-muted font-semibold mt-1 truncate" title={analyticsData.worstStudentName}>
                    {analyticsData.worstStudentName}
                  </div>
                </div>

                {/* Punctuality Rate */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Puntualidad</span>
                    <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 p-1.5 rounded-lg border border-emerald-500/10">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-txt-base">
                    {analyticsData.punctualityRate}%
                  </div>
                  <div className="text-[10px] text-txt-muted font-semibold mt-1">
                    Asistencias a tiempo
                  </div>
                </div>

                {/* Approved Excuses */}
                <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm theme-transition">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Justificados</span>
                    <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg border border-blue-500/10">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-txt-base">
                    {analyticsData.approvedExcuses}
                  </div>
                  <div className="text-[10px] text-txt-muted font-semibold mt-1">
                    Permisos aprobados
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekday Performance */}
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm lg:col-span-2 flex flex-col justify-between theme-transition text-left">
                  <div>
                    <h4 className="font-extrabold text-base">Asistencia por Día de la Semana</h4>
                    <p className="text-xs text-txt-muted mt-0.5">Identifica patrones o días con mayor ausentismo en este grupo.</p>
                  </div>
                  <div className="h-56 w-full text-[10px] mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.weekdayChart} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="name" stroke={fontColor} />
                        <YAxis domain={[0, 100]} stroke={fontColor} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Asistencia" fill={primaryChartColor} radius={[4, 4, 0, 0]}>
                          {analyticsData.weekdayChart.map((entry, index) => {
                            let color = primaryChartColor;
                            if (entry.Asistencia < 80) color = '#f43f5e';
                            else if (entry.Asistencia < 85) color = '#f59e0b';
                            else color = '#10b981';
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status breakdown progress bars */}
                <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col justify-between theme-transition text-left">
                  <div>
                    <h4 className="font-extrabold text-base">Proporción de Estatus</h4>
                    <p className="text-xs text-txt-muted mt-0.5">Distribución porcentual de los registros de asistencia.</p>
                  </div>
                  
                  <div className="space-y-4 my-6">
                    {analyticsData.statusBreakdown.map((item, idx) => {
                      const percentage = analyticsData.statusTotal > 0 
                        ? Math.round((item.value / analyticsData.statusTotal) * 100) 
                        : 0;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-txt-base">{item.name} ({item.value})</span>
                            <span style={{ color: item.color }}>{percentage}%</span>
                          </div>
                          <div className="w-full bg-bg-surface border border-bdr-base h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%`, backgroundColor: item.color }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="text-[10px] text-txt-subtle italic border-t border-bdr-base/60 pt-3">
                    Total de marcas en el historial: {analyticsData.statusTotal}
                  </div>
                </div>
              </div>

              {/* Warnings and Alerts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Absences alert card */}
                <div className="bg-bg-card border border-bdr-base rounded-2xl shadow-sm p-6 space-y-4 theme-transition text-left">
                  <div className="flex items-center gap-2 border-b border-bdr-base/60 pb-3">
                    <ShieldAlert className="text-rose-500 w-5 h-5 shrink-0" />
                    <h4 className="font-bold text-sm">Exceso de Faltas (≥3)</h4>
                  </div>
                  
                  <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
                    {analyticsData.excessiveAbsences.length > 0 ? (
                      analyticsData.excessiveAbsences.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-bg-surface border border-bdr-base p-2.5 rounded-xl text-xs theme-transition">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentProfile({ id: s.id, name: s.name })}
                              className="font-bold text-txt-base block hover:underline hover:text-brand-primary text-left outline-none"
                            >
                              {s.name}
                            </button>
                            <span className="text-[10px] text-txt-subtle font-mono">{s.id}</span>
                          </div>
                          <span className="bg-rose-500/10 text-rose-650 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
                            {s.count} faltas
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-emerald-500 font-semibold text-xs">
                        ✔ Ningún alumno supera el límite de 3 faltas.
                      </div>
                    )}
                  </div>
                </div>

                {/* Tardies alert card */}
                <div className="bg-bg-card border border-bdr-base rounded-2xl shadow-sm p-6 space-y-4 theme-transition text-left">
                  <div className="flex items-center gap-2 border-b border-bdr-base/60 pb-3">
                    <Clock className="text-amber-500 w-5 h-5 shrink-0" />
                    <h4 className="font-bold text-sm">Exceso de Retardos (≥3)</h4>
                  </div>
                  
                  <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
                    {analyticsData.excessiveTardies.length > 0 ? (
                      analyticsData.excessiveTardies.map((s, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-bg-surface border border-bdr-base p-2.5 rounded-xl text-xs theme-transition">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentProfile({ id: s.id, name: s.name })}
                              className="font-bold text-txt-base block hover:underline hover:text-brand-primary text-left outline-none"
                            >
                              {s.name}
                            </button>
                            <span className="text-[10px] text-txt-subtle font-mono">{s.id}</span>
                          </div>
                          <span className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
                            {s.count} retardos
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-emerald-500 font-semibold text-xs">
                        ✔ Ningún alumno supera el límite de 3 retardos.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notifications Audit Trail Log */}
              <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition mt-8">
                <div className="p-6 border-b border-bdr-base flex justify-between items-center theme-transition">
                  <div>
                    <h3 className="text-lg font-bold">Bitácora de Alertas Enviadas</h3>
                    <p className="text-txt-muted text-xs mt-0.5">Historial y auditoría de notificaciones de asistencia crítica enviadas a alumnos de este grupo.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                        <th className="py-4 px-6 w-32">Fecha de Envío</th>
                        <th className="py-4 px-6">Alumno</th>
                        <th className="py-4 px-6">Matrícula</th>
                        <th className="py-4 px-6">Asunto</th>
                        <th className="py-4 px-6 text-center w-36">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bdr-subtle/50 theme-transition text-sm">
                      {sentAlerts.filter(log => {
                        // Find if student is in this group
                        return students.some(std => std.id === log.studentId);
                      }).map((log, index) => {
                        const dateFormatted = new Date(log.date).toLocaleString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        
                        return (
                          <tr key={log.id || index} className="hover:bg-bg-surface/10 transition-colors">
                            <td className="py-4 px-6 font-semibold text-txt-muted">{dateFormatted} hrs</td>
                            <td className="py-4 px-6 text-left">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentProfile({ id: log.studentId, name: log.studentName })}
                                className="font-bold text-txt-base hover:underline hover:text-brand-primary transition-all text-left outline-none"
                              >
                                {log.studentName}
                              </button>
                            </td>
                            <td className="py-4 px-6 font-mono text-xs text-txt-subtle">{log.studentId}</td>
                            <td className="py-4 px-6 font-medium text-txt-muted">{log.subject}</td>
                            <td className="py-4 px-6 text-center">
                              <button
                                type="button"
                                onClick={() => setViewingAlertDetail(log)}
                                className="px-3 py-1.5 border border-bdr-base rounded-xl text-xs font-bold text-txt-muted hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-all cursor-pointer"
                              >
                                Ver Alerta
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {sentAlerts.filter(log => students.some(std => std.id === log.studentId)).length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-xs text-txt-subtle italic">
                            No se registran alertas enviadas a alumnos de este grupo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}


      {/* ---------------- 5. MODAL: QR CODES PROJECTOR ---------------- */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-bg-card border border-bdr-base rounded-3xl p-8 max-w-sm w-full relative shadow-2xl space-y-6 text-center theme-transition">
            {/* Glowing background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-blue-500 rounded-3xl blur-xl opacity-20 -z-10 animate-pulse"></div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2.5">
                <img src="/isc_logo.jpg" alt="Logo ISC" className="h-10 w-auto object-contain rounded-lg shadow-sm border border-bdr-base/40 bg-white" />
                <h3 className="text-xl font-bold text-left leading-none">Código QR<br/><span className="text-xs text-brand-primary font-bold">RinoAsist ISC</span></h3>
              </div>
              <p className="text-xs text-txt-muted">
                Escanear para auto-registrar asistencia en <strong className="text-txt-base">{teacherGroups.find(g => g.id === selectedGroupId)?.name}</strong>.
              </p>
            </div>

            {/* QR Code Graphic Frame */}
            <div className="bg-white p-6 rounded-2xl inline-block shadow-lg mx-auto relative group">
              <div className="w-48 h-48 bg-slate-550 flex items-center justify-center border border-slate-200 rounded-xl relative overflow-hidden">
                {qrToken ? (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/scan?token=${qrToken}`)}`} 
                    alt="Código QR de Asistencia" 
                    className="w-44 h-44 object-contain transition-all duration-300"
                  />
                ) : (
                  <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
                )}
                {/* Scanner bar line */}
                <div className="absolute left-0 right-0 h-0.5 bg-rose-500/80 shadow-md shadow-rose-500 animate-bounce top-1/2"></div>
              </div>
            </div>

            {/* Manual Code Input Backup */}
            {qrToken && (
              <div className="bg-bg-surface border border-bdr-base/70 rounded-xl p-3 text-center theme-transition">
                <span className="text-[9px] text-txt-subtle uppercase block font-bold tracking-wider mb-1">Código de Respaldo Manual</span>
                <span className="text-xs font-mono font-bold select-all bg-bg-card border border-bdr-base rounded px-2.5 py-1 inline-block text-brand-primary tracking-wide">
                  {qrToken}
                </span>
              </div>
            )}

            {/* Timer indicators - Circular Progress Ring */}
            <div className="flex flex-col items-center justify-center space-y-2 py-2">
              <div className="relative flex items-center justify-center">
                <svg className="w-14 h-14 transform -rotate-90">
                  {/* Background Circle */}
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="currentColor"
                    className="text-bg-surface dark:text-bg-surface/30"
                    strokeWidth="3.5"
                    fill="transparent"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    stroke="currentColor"
                    className="text-brand-primary transition-all duration-1000 ease-linear"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={150.8}
                    strokeDashoffset={150.8 * (1 - qrCodeTimer / 30)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute font-mono font-bold text-xs text-txt-base">
                  {qrCodeTimer}s
                </div>
              </div>
              <div className="text-[9px] font-extrabold text-txt-subtle uppercase tracking-widest">
                Rotando Código QR
              </div>
            </div>

            <p className="text-[10px] text-txt-subtle leading-normal">
              Este código de asistencia cambia de firma periódicamente para evitar fraudes en el registro escolar.
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

      {/* ---------------- 5b. MODAL: CREDENTIAL SCANNER ---------------- */}
      {showCredentialScanner && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bdr-base rounded-3xl w-full max-w-2xl max-h-[95vh] overflow-y-auto p-6 shadow-2xl flex flex-col justify-between theme-transition relative text-left">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-bdr-base/60 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <Camera className="w-6 h-6 text-brand-primary animate-pulse" />
                <div>
                  <h3 className="text-lg font-bold text-txt-base">Escáner de Credenciales Físicas</h3>
                  <p className="text-xs text-txt-muted">Usa la cámara del dispositivo para registrar asistencias con la matrícula del alumno</p>
                </div>
              </div>
              <button
                onClick={handleCloseCredentialScanner}
                className="p-2 border border-bdr-base hover:border-rose-500/25 bg-bg-surface text-txt-muted hover:text-rose-500 rounded-xl cursor-pointer transition-all text-xs font-bold"
              >
                ✕ Cerrar Lector
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Scanner Camera view */}
              <div className="space-y-4">
                <div className="relative border-4 border-dashed border-brand-primary/25 rounded-2xl overflow-hidden bg-bg-surface flex items-center justify-center p-2 min-h-[300px] shadow-inner">
                  <div id="credential-qr-reader" className="w-full h-full"></div>
                </div>
                
                {/* Active scan status */}
                {scanStatus.type && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 text-sm border theme-transition animate-fadeIn ${
                    scanStatus.type === 'success' 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-455'
                      : scanStatus.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-455'
                      : 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary'
                  }`}>
                    {scanStatus.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : scanStatus.type === 'error' ? (
                      <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />
                    ) : (
                      <RefreshCw className="w-5 h-5 text-brand-primary animate-spin shrink-0" />
                    )}
                    <p className="font-semibold">{scanStatus.message}</p>
                  </div>
                )}
              </div>

              {/* Scanned history log for current session */}
              <div className="flex flex-col justify-between h-full space-y-4">
                <div className="border border-bdr-base rounded-2xl bg-bg-surface/50 p-4 flex-grow overflow-y-auto min-h-[220px] max-h-[280px] theme-transition">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-txt-subtle mb-3 border-b border-bdr-base/40 pb-1.5">Escaneados en esta Sesión</h4>
                  {scannedSessionLogs.length === 0 ? (
                    <p className="text-xs text-txt-muted italic text-center py-16">Presenta una credencial escolar frente a la cámara para iniciar.</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {scannedSessionLogs.map((log, index) => (
                        <div key={index} className="flex justify-between items-center text-xs p-2.5 bg-bg-card border border-bdr-base rounded-xl shadow-sm animate-slideDown">
                          <div>
                            <span className="font-bold text-txt-base block">{log.name}</span>
                            <span className="text-[10px] text-txt-muted font-mono font-bold tracking-wider">{log.matricula}</span>
                          </div>
                          <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-455 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase">
                            Presente
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-bg-surface border border-bdr-base p-4 rounded-2xl text-xs text-txt-muted space-y-1.5 theme-transition">
                  <span className="font-bold text-txt-base block mb-1">💡 Guía Rápida Docente:</span>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>La cámara detecta el QR automáticamente.</li>
                    <li>Cada escaneo exitoso emite una doble señal sonora.</li>
                    <li>Existe un retardo de 2.5 segundos entre lecturas para dar tiempo a retirar la credencial.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 6. MODAL: TIMETABLE AGENDA DETAIL POPOVER ---------------- */}
      {selectedClassDetailModal.isOpen && selectedClassDetailModal.classData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative text-left">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="text-brand-primary w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-lg text-txt-base">Detalle de Asignatura</h3>
              </div>
              <button 
                onClick={() => setSelectedClassDetailModal(prev => ({ ...prev, isOpen: false }))}
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm"
              >
                ✕
              </button>
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

            <div className="flex justify-end items-center pt-3 border-t border-bdr-base/60">
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setSelectedClassDetailModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedGroupId(selectedClassDetailModal.classData.id);
                    loadStudentListAndAttendance(selectedClassDetailModal.classData.id, attendanceDate);
                    setSelectedClassDetailModal(prev => ({ ...prev, isOpen: false }));
                    setActiveTab('pase_lista');
                  }}
                  className="px-5 py-2.5 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Pase de Lista</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 7. MODAL: SEND RISK NOTIFICATION EMAIL ---------------- */}
      {emailModal.isOpen && emailModal.student && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 theme-transition relative text-left">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <div className="flex items-center gap-2">
                <Mail className="text-brand-primary w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-lg text-txt-base">Redactar Notificación de Riesgo</h3>
              </div>
              <button 
                onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Destinatario</label>
                <input 
                  type="text"
                  value={`${emailModal.student.name} (${emailModal.student.id})`}
                  disabled
                  className="w-full bg-bg-surface/50 border border-bdr-base text-txt-muted rounded-xl px-4 py-2.5 outline-none text-sm theme-transition cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Asunto</label>
                <input 
                  type="text"
                  value={emailModal.subject}
                  onChange={(e) => setEmailModal(prev => ({ ...prev, subject: e.target.value }))}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Mensaje de Alerta</label>
                <textarea 
                  rows="7"
                  value={emailModal.body}
                  onChange={(e) => setEmailModal(prev => ({ ...prev, body: e.target.value }))}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm theme-transition font-sans resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base/60">
                <button 
                  type="button" 
                  onClick={() => setEmailModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={sendingEmail}
                  className="px-5 py-2.5 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5 active:scale-[0.98] font-bold"
                >
                  {sendingEmail ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Enviar Alerta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- 8. TOAST: NOTIFICATION COMPLETED SUCCESS ---------------- */}
      {emailToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center gap-3 animate-scale-in max-w-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 animate-pulse" />
          <div className="space-y-0.5 text-left">
            <h5 className="font-extrabold text-sm text-txt-base">Alerta Enviada</h5>
            <p className="text-xs text-txt-muted font-semibold">Se ha notificado al alumno sobre su estado de asistencia.</p>
          </div>
        </div>
      )}

      {/* ---------------- 9. MODAL: CONFIRM SAVING ATTENDANCE ---------------- */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 theme-transition relative text-left">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-brand-primary w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-lg text-txt-base">Confirmar Pase de Lista</h3>
              </div>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-txt-muted">
              <p>
                Estás por guardar el pase de lista para la materia de <strong className="text-txt-base">{teacherGroups.find(g => g.id === selectedGroupId)?.name}</strong> en la fecha <strong className="text-txt-base">{new Date(attendanceDate + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
              </p>

              <div className="bg-bg-surface border border-bdr-base/40 p-4 rounded-xl space-y-2">
                <span className="text-[10px] text-txt-subtle uppercase block font-bold tracking-wider mb-2">Desglose del Registro</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between border-b border-bdr-base/30 pb-1">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-500">Asistencias (A):</span>
                    <span className="font-bold text-txt-base">{confirmModalData.A}</span>
                  </div>
                  <div className="flex justify-between border-b border-bdr-base/30 pb-1">
                    <span className="font-semibold text-rose-600 dark:text-rose-500">Faltas (F):</span>
                    <span className="font-bold text-txt-base">{confirmModalData.F}</span>
                  </div>
                  <div className="flex justify-between border-b border-bdr-base/30 pb-1">
                    <span className="font-semibold text-amber-600 dark:text-amber-500">Retardos (R):</span>
                    <span className="font-bold text-txt-base">{confirmModalData.R}</span>
                  </div>
                  <div className="flex justify-between border-b border-bdr-base/30 pb-1">
                    <span className="font-semibold text-brand-primary">Justificados (J):</span>
                    <span className="font-bold text-txt-base">{confirmModalData.J}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs font-bold pt-2 border-t border-bdr-base/55">
                  <span className="text-txt-base">Total de Alumnos:</span>
                  <span className="text-txt-base">{confirmModalData.total}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base/60">
              <button 
                type="button" 
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-bdr-base rounded-xl text-xs font-semibold text-txt-muted hover:bg-bg-surface cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSaveAttendance}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5 active:scale-[0.98]"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Confirmar y Enviar</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ---------------- SLIDE-OVER DRAWER: STUDENT EXPEDIENT / PROFILE ---------------- */}
      {selectedStudentProfile && studentProfileData && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end animate-fadeIn">
          {/* Backdrop click to close */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setSelectedStudentProfile(null)}></div>
          
          {/* Drawer container */}
          <div className="relative w-full max-w-lg bg-bg-card border-l border-bdr-base h-full flex flex-col justify-between shadow-2xl theme-transition animate-slideLeft text-left">
            {/* Header */}
            <div className="p-6 border-b border-bdr-base flex justify-between items-center bg-bg-surface/50 theme-transition">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary font-bold text-lg">
                  {studentProfileData.student.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-txt-base">{studentProfileData.student.name}</h4>
                  <span className="text-[10px] text-txt-subtle font-mono">{studentProfileData.student.id}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudentProfile(null)}
                className="text-txt-muted hover:text-txt-base font-bold text-base cursor-pointer p-1 hover:bg-bg-surface rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            
            {/* Drawer Body (Scrollable) */}
            <div className="flex-grow p-6 overflow-y-auto space-y-6">
              {/* Stats overview card */}
              <div className="bg-bg-surface border border-bdr-base/70 p-5 rounded-2xl flex items-center justify-between shadow-sm theme-transition">
                <div className="space-y-1">
                  <span className="text-[10px] text-txt-subtle uppercase font-bold tracking-wider">Asistencia Acumulada</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-4xl font-black ${studentProfileData.stats.rate < 80 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {studentProfileData.stats.rate}%
                    </span>
                    <span className="text-[10px] text-txt-muted font-bold">de meta (80%)</span>
                  </div>
                </div>
                <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
                  {/* SVG Circular indicator */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-bdr-base" strokeWidth="4.5" fill="transparent" />
                    <circle 
                      cx="32" 
                      cy="32" 
                      r="28" 
                      className={studentProfileData.stats.rate < 80 ? "stroke-rose-500" : "stroke-emerald-500"} 
                      strokeWidth="4.5" 
                      fill="transparent" 
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={(2 * Math.PI * 28) * (1 - studentProfileData.stats.rate / 100)}
                    />
                  </svg>
                  <span className="absolute text-[10px] font-bold text-txt-base">{studentProfileData.stats.rate}%</span>
                </div>
              </div>

              {/* Status counts breakdown */}
              <div className="grid grid-cols-4 gap-3 bg-bg-surface/50 border border-bdr-base/40 p-4 rounded-xl text-center theme-transition">
                <div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-bold block">Asistió (A)</span>
                  <span className="text-lg font-extrabold text-txt-base block mt-0.5">{studentProfileData.stats.A}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 font-bold block">Falta (F)</span>
                  <span className="text-lg font-extrabold text-txt-base block mt-0.5">{studentProfileData.stats.F}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-500 font-bold block">Retardo (R)</span>
                  <span className="text-lg font-extrabold text-txt-base block mt-0.5">{studentProfileData.stats.R}</span>
                </div>
                <div>
                  <span className="text-[10px] text-brand-primary font-bold block">Justif. (J)</span>
                  <span className="text-lg font-extrabold text-txt-base block mt-0.5">{studentProfileData.stats.J}</span>
                </div>
              </div>

              {/* Session Timeline logs list */}
              <div className="space-y-4">
                <h5 className="text-xs font-extrabold text-txt-muted uppercase tracking-wider">Historial de Clases ({studentProfileData.stats.total} sesiones)</h5>
                
                <div className="space-y-3">
                  {studentProfileData.records.map((rec, index) => {
                    const dateFormatted = new Date(rec.date + 'T12:00:00').toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });
                    
                    return (
                      <div key={index} className="bg-bg-surface border border-bdr-base p-4 rounded-xl flex justify-between items-start gap-4 theme-transition hover:border-brand-primary/25">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-txt-base block capitalize">{dateFormatted}</span>
                          {rec.notes ? (
                            <span className="text-[10px] text-txt-subtle italic block">"{rec.notes}"</span>
                          ) : (
                            <span className="text-[10px] text-txt-subtle/40 italic block">Sin notas de sesión</span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md border shrink-0 ${
                          rec.status === 'A' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/25' :
                          rec.status === 'F' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/25' :
                          rec.status === 'R' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/35' :
                          'bg-brand-primary/10 text-brand-primary border-brand-primary/30'
                        }`}>
                          {rec.status === 'A' ? 'ASISTIÓ' :
                           rec.status === 'F' ? 'FALTA' :
                           rec.status === 'R' ? 'RETARDO' :
                           'JUSTIFICADO'}
                        </span>
                      </div>
                    );
                  })}
                  {studentProfileData.records.length === 0 && (
                    <div className="text-center py-8 text-xs text-txt-subtle italic">
                      No hay sesiones registradas en el historial de este grupo.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-5 border-t border-bdr-base bg-bg-surface/50 text-center theme-transition">
              <button 
                onClick={() => setSelectedStudentProfile(null)}
                className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-3 rounded-xl transition-all cursor-pointer shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 7b. MODAL: VIEW SENT ALERT DETAILS ---------------- */}
      {viewingAlertDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative text-left">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-brand-primary w-5 h-5 shrink-0" />
                <h3 className="font-extrabold text-base text-txt-base">Detalle de Alerta Enviada</h3>
              </div>
              <button 
                onClick={() => setViewingAlertDetail(null)}
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4 text-xs font-semibold text-txt-muted">
              <div>
                <span className="text-[10px] text-txt-subtle uppercase block tracking-wider font-bold mb-1">Destinatario</span>
                <span className="text-sm font-bold text-txt-base block">{viewingAlertDetail.studentName} ({viewingAlertDetail.studentId})</span>
              </div>
              <div>
                <span className="text-[10px] text-txt-subtle uppercase block tracking-wider font-bold mb-1">Fecha y Hora</span>
                <span className="text-txt-base block">{new Date(viewingAlertDetail.date).toLocaleString('es-MX')} hrs</span>
              </div>
              <div>
                <span className="text-[10px] text-txt-subtle uppercase block tracking-wider font-bold mb-1">Asunto</span>
                <span className="text-txt-base block font-extrabold">{viewingAlertDetail.subject}</span>
              </div>
              <div>
                <span className="text-[10px] text-txt-subtle uppercase block tracking-wider font-bold mb-1">Mensaje</span>
                <div className="bg-bg-surface border border-bdr-base/75 rounded-xl p-3.5 text-txt-base font-sans font-medium whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {viewingAlertDetail.body}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-3 border-t border-bdr-base/60">
              <button 
                type="button" 
                onClick={() => setViewingAlertDetail(null)}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all active:scale-[0.98]"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- MODAL DE CONFIRMACIÓN PERSONALIZADO PREMIUM --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] animate-fadeIn p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative text-left">
            <div className="flex items-center gap-2.5 pb-2 border-b border-bdr-base/60">
              {confirmModal.isDanger ? (
                <AlertTriangle className="text-rose-500 w-5.5 h-5.5 shrink-0 animate-bounce" />
              ) : (
                <CheckCircle className="text-brand-primary w-5.5 h-5.5 shrink-0" />
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

    </div>
  );
}
