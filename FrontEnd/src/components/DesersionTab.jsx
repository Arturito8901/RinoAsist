import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, UserCheck, Users, Search, 
  ChevronDown, ChevronUp, Download, Printer, Check, X, Clock, FileText,
  TrendingDown, Info, ArrowUpRight, ArrowDownRight, MoveRight
} from 'lucide-react';
import { api } from '../services/api';

// Spanish Month Names helper
const getFormattedDate = () => {
  return new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Deterministic seed-based random generator
const seedRandom = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return () => {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };
};

const SEMESTER_SUBJECTS = {
  1: ['Fundamentos de Programación', 'Fundamentos de Investigación', 'Química', 'Cálculo Diferencial', 'Matemáticas Discretas', 'Taller de Ética'],
  2: ['Cálculo Integral', 'Programación Orientada a Objetos', 'Probabilidad y Estadística', 'Álgebra Lineal', 'Física General', 'Tópicos Avanzados de Programación'],
  3: ['Estructura de Datos', 'Cálculo Vectorial', 'Sistemas Operativos', 'Interfaces Humano-Computadora', 'Principios Eléctricos y Aplicaciones Digitales', 'Investigación de Operaciones'],
  4: ['Ecuaciones Diferenciales', 'Taller de Sistemas Operativos', 'Fundamentos de Bases de Datos', 'Simulación', 'Métodos Numéricos', 'Desarrollo Sustentable'],
  5: ['Arquitectura de Computadoras', 'Fundamentos de Telecomunicaciones', 'Lenguajes y autómatas I', 'Fundamentos de Ingeniería de Software', 'Graficación', 'Taller de Base de Datos'],
  6: ['Redes de Computadoras', 'Taller de Investigación I', 'Lenguajes y Autómatas II', 'Lenguajes de Interfaz', 'Administración de Bases de Datos', 'Programación Web'],
  7: ['Taller de Investigación II', 'Inteligencia Artificial', 'Sistemas Programables', 'Conmutación y Enrutamiento de Redes de Datos', 'Programación Lógica y Funcional', 'Mercadotecnia Electrónica'],
  8: ['Administración de Redes', 'Modelo Vista-Controlador', 'Programación del lado del Cliente', 'Programación del lado del Servidor', 'Seguridad en Aplicaciones Web', 'Ingeniería de Requerimientos']
};

// STUDENT_NAMES array removed to prioritize real database students

// Helper to determine the schedule block of a subject based on its index in the syllabus
const getSubjectSchedule = (subjectName, subjectsList, isMatutino) => {
  const idx = subjectsList.indexOf(subjectName);
  
  if (isMatutino) {
    if (idx < 2) return { block: 'Inicio', time: '07:00 - 08:40', label: 'Inicio de Jornada' };
    if (idx < 4) return { block: 'Mitad', time: '08:40 - 10:20', label: 'Mitad de Jornada' };
    return { block: 'Fin', time: '10:20 - 12:00', label: 'Fin de Jornada' };
  } else {
    if (idx < 2) return { block: 'Inicio', time: '14:00 - 15:40', label: 'Inicio de Jornada' };
    if (idx < 4) return { block: 'Mitad', time: '15:40 - 17:20', label: 'Mitad de Jornada' };
    return { block: 'Fin', time: '17:20 - 19:00', label: 'Fin de Jornada' };
  }
};

export default function DesersionTab({ adminData, selectedWeek, setSelectedWeek }) {
  const [selectedSemester, setSelectedSemester] = useState(1);
  const [dbStudents, setDbStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    let active = true;
    api.getAlumnosOverview()
      .then(data => {
        if (active) {
          setDbStudents(data.alumnos || []);
          setLoadingStudents(false);
        }
      })
      .catch(err => {
        console.error("Error loading students for DesersionTab:", err);
        if (active) setLoadingStudents(false);
      });
    return () => {
      active = false;
    };
  }, []);
  
  const semesterKey = `${selectedSemester}º Sem`;
  const groups = useMemo(() => {
    return adminData?.semesterDetailedData?.[semesterKey]?.groups || [];
  }, [adminData, semesterKey]);

  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all'); // 'all', 'high', 'medium', 'safe'
  const [expandedStudents, setExpandedStudents] = useState({});
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Interactive Student Notes Bitacora State
  const [studentNotes, setStudentNotes] = useState({});
  const [newNoteTexts, setNewNoteTexts] = useState({});

  // Reset states when group or semester changes
  useEffect(() => {
    setExpandedStudents({});
  }, [selectedSemester, selectedGroupName]);

  // Update selectedGroupName when groups list changes or selectedSemester changes
  useEffect(() => {
    if (groups.length > 0) {
      if (!groups.some(g => g.name === selectedGroupName)) {
        setSelectedGroupName(groups[0].name);
      }
    } else {
      setSelectedGroupName('');
    }
  }, [groups, selectedGroupName]);

  const groupName = selectedGroupName || '';
  const weekId = selectedWeek || 'w1';
  const isMatutino = selectedGroupName ? !selectedGroupName.toUpperCase().includes('V') : true;

  // Get active subjects
  const subjects = useMemo(() => {
    return SEMESTER_SUBJECTS[selectedSemester] || [];
  }, [selectedSemester]);

  // Generate deterministic student data with hourly block behaviors
  const studentsData = useMemo(() => {
    const list = [];
    const daysOfWeek = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];

    // Load approved justifications from localStorage
    const approvedJustifications = JSON.parse(localStorage.getItem('approved_justifications') || '[]');

    const getExactDateOfRecord = (wkId, dayName) => {
      const baseDates = {
        w1: { Lun: '2026-05-25', Mar: '2026-05-26', Mie: '2026-05-27', Jue: '2026-05-28', Vie: '2026-05-29' },
        w2: { Lun: '2026-05-18', Mar: '2026-05-19', Mie: '2026-05-20', Jue: '2026-05-21', Vie: '2026-05-22' },
        w3: { Lun: '2026-05-11', Mar: '2026-05-12', Mie: '2026-05-13', Jue: '2026-05-14', Vie: '2026-05-15' },
        w4: { Lun: '2026-05-04', Mar: '2026-05-05', Mie: '2026-05-06', Jue: '2026-05-07', Vie: '2026-05-08' }
      };
      return baseDates[wkId]?.[dayName] || null;
    };

    // Filter database students by selectedSemester and selectedGroupName
    const filteredDbStudents = dbStudents.filter(student => {
      const studentSemestre = Number(student.semestre);
      const isSameSemester = studentSemestre === Number(selectedSemester);
      const isSameGroup = student.grupo_clave && selectedGroupName && 
        student.grupo_clave.toString().trim().toLowerCase() === selectedGroupName.toString().trim().toLowerCase();
      return isSameSemester && isSameGroup;
    });

    filteredDbStudents.forEach((student) => {
      const studentName = student.nombre;
      const studentId = student.matricula || `AL-${student.id}`;
      
      let baseRate = 85;
      let isEarlyDepartureProfile = false;
      let isLateArrivalProfile = false;

      // Assign deterministic risk values based on student.id
      if (student.id === 38) {
        baseRate = 74; // Medium Risk - Profile: Late Arrival
        isLateArrivalProfile = true;
      } else if (student.id % 3 === 0) {
        baseRate = 65; // High Risk - Profile: Early Departure
        isEarlyDepartureProfile = true;
      } else if (student.id % 3 === 1) {
        baseRate = 78; // Medium Risk - Profile: Early Departure
        isEarlyDepartureProfile = true;
      } else {
        baseRate = 85 + (student.id % 15);
      }

      // Generate subjects attendance for current week
      const subjectsAttendance = subjects.map((subj) => {
        const keySeed = `${studentId}-${subj}-${weekId}`;
        const rand = seedRandom(keySeed);
        
        const subjRateOffset = Math.round((rand() * 12) - 6); // -6% to +6%
        let subjTargetRate = Math.min(100, Math.max(20, baseRate + subjRateOffset));

        const schedInfo = getSubjectSchedule(subj, subjects, isMatutino);

        // Apply profile behavioral modifications to subject targets
        if (isEarlyDepartureProfile && schedInfo.block === 'Fin') {
          subjTargetRate = Math.max(10, subjTargetRate - 35); // drops attendance significantly at end of day
        }
        if (isLateArrivalProfile && schedInfo.block === 'Inicio') {
          subjTargetRate = Math.max(10, subjTargetRate - 30); // drops attendance at the start of day
        }

        const history = daysOfWeek.map((day, dayIdx) => {
          const daySeed = `${keySeed}-${dayIdx}`;
          const dayRand = seedRandom(daySeed);
          const roll = dayRand();

          let status = 'A';
          if (roll * 100 > subjTargetRate) {
            status = dayRand() < 0.25 ? 'J' : 'F';
          } else {
            // Late arrival profile has 40% late rate on start block
            if (isLateArrivalProfile && schedInfo.block === 'Inicio') {
              status = dayRand() < 0.40 ? 'R' : 'A';
            } else {
              status = dayRand() < 0.12 ? 'R' : 'A';
            }
          }

          // Check if there is an approved central justification covering this day
          const exactDate = getExactDateOfRecord(weekId, day);
          const hasJustification = approvedJustifications.some(just => 
            just.studentId === studentId && 
            just.status === 'Aprobado' &&
            exactDate >= just.startDate && 
            exactDate <= just.endDate
          );

          if (hasJustification) {
            status = 'J'; // Override to excused absence
          }

          return { day, status };
        });

        const attendedCount = history.filter(h => h.status === 'A' || h.status === 'R' || h.status === 'J').length;
        const rate = Math.round((attendedCount / 5) * 100);

        return {
          subjectName: subj,
          history,
          rate,
          attendedCount,
          scheduleBlock: schedInfo.block,
          scheduleTime: schedInfo.time
        };
      });

      // Calculate student overall attendance average for current week
      const overallRate = Math.round(
        subjectsAttendance.reduce((sum, s) => sum + s.rate, 0) / subjectsAttendance.length
      );

      // --- TENDENCIA: Calculate same data for previous week to get trend difference ---
      let prevWeekId = 'w2';
      if (weekId === 'w1') prevWeekId = 'w2';
      else if (weekId === 'w2') prevWeekId = 'w3';
      else if (weekId === 'w3') prevWeekId = 'w4';
      else prevWeekId = null;

      let prevOverallRate = baseRate;
      if (prevWeekId) {
        const prevSubjectsAttendance = subjects.map((subj) => {
          const keySeed = `${studentId}-${subj}-${prevWeekId}`;
          const rand = seedRandom(keySeed);
          const subjRateOffset = Math.round((rand() * 12) - 6);
          let subjTargetRate = Math.min(100, Math.max(20, baseRate + subjRateOffset));

          const schedInfo = getSubjectSchedule(subj, subjects, isMatutino);
          if (isEarlyDepartureProfile && schedInfo.block === 'Fin') {
            subjTargetRate = Math.max(10, subjTargetRate - 35);
          }
          if (isLateArrivalProfile && schedInfo.block === 'Inicio') {
            subjTargetRate = Math.max(10, subjTargetRate - 30);
          }

          const history = daysOfWeek.map((day, dayIdx) => {
            const daySeed = `${keySeed}-${dayIdx}`;
            const dayRand = seedRandom(daySeed);
            const roll = dayRand();

            let status = 'A';
            if (roll * 100 > subjTargetRate) {
              status = dayRand() < 0.25 ? 'J' : 'F';
            } else {
              if (isLateArrivalProfile && schedInfo.block === 'Inicio') {
                status = dayRand() < 0.40 ? 'R' : 'A';
              } else {
                status = dayRand() < 0.12 ? 'R' : 'A';
              }
            }

            // Check if there is an approved central justification covering this day in previous week
            const exactDate = getExactDateOfRecord(prevWeekId, day);
            const hasJustification = approvedJustifications.some(just => 
              just.studentId === studentId && 
              just.status === 'Aprobado' &&
              exactDate >= just.startDate && 
              exactDate <= just.endDate
            );

            if (hasJustification) {
              status = 'J';
            }

            return { day, status };
          });

          const attendedCount = history.filter(h => h.status === 'A' || h.status === 'R' || h.status === 'J').length;
          const rate = Math.round((attendedCount / 5) * 100);
          return rate;
        });

        prevOverallRate = Math.round(
          prevSubjectsAttendance.reduce((sum, r) => sum + r, 0) / prevSubjectsAttendance.length
        );
      } else {
        prevOverallRate = overallRate;
      }

      const trendDiff = overallRate - prevOverallRate;

      // Calculate Student Hourly Block Averages
      const inicioSubjects = subjectsAttendance.filter(s => s.scheduleBlock === 'Inicio');
      const mitadSubjects = subjectsAttendance.filter(s => s.scheduleBlock === 'Mitad');
      const finSubjects = subjectsAttendance.filter(s => s.scheduleBlock === 'Fin');

      const hourlyBlocks = {
        inicio: inicioSubjects.length > 0 ? Math.round(inicioSubjects.reduce((sum, s) => sum + s.rate, 0) / inicioSubjects.length) : 0,
        mitad: mitadSubjects.length > 0 ? Math.round(mitadSubjects.reduce((sum, s) => sum + s.rate, 0) / mitadSubjects.length) : 0,
        fin: finSubjects.length > 0 ? Math.round(finSubjects.reduce((sum, s) => sum + s.rate, 0) / finSubjects.length) : 0
      };

      // Determine risk level
      let riskLevel = 'safe';
      if (overallRate < 70) riskLevel = 'high';
      else if (overallRate >= 70 && overallRate < 80) riskLevel = 'medium';

      list.push({
        id: studentId,
        name: studentName,
        subjectsAttendance,
        overallRate,
        riskLevel,
        trendDiff,
        isEarlyDepartureProfile,
        isLateArrivalProfile,
        hourlyBlocks
      });
    });

    return list;
  }, [selectedSemester, selectedGroupName, subjects, weekId, isMatutino, dbStudents]);

  // Load notes from localStorage
  useEffect(() => {
    const notesMap = {};
    studentsData.forEach(student => {
      const saved = localStorage.getItem(`desersion_notes_${student.id}`);
      if (saved) {
        notesMap[student.id] = JSON.parse(saved);
      } else {
        // Initial notes seed
        if (student.isEarlyDepartureProfile) {
          notesMap[student.id] = [
            {
              id: 1,
              date: '22 May, 11:40 AM',
              author: 'Coordinación ISC',
              text: 'Se detecta patrón recurrente de salidas tempranas. No asiste a las asignaturas de la última hora del día. Pendiente citar a tutoría escolar.'
            }
          ];
        } else if (student.isLateArrivalProfile) {
          notesMap[student.id] = [
            {
              id: 1,
              date: '20 May, 09:15 AM',
              author: 'Prof. Carlos Mendoza',
              text: 'El alumno llega sistemáticamente tarde o falta a la clase de las 7:00 AM debido a tiempos de traslado.'
            }
          ];
        } else if (student.riskLevel === 'high') {
          notesMap[student.id] = [
            {
              id: 1,
              date: '18 May, 10:30 AM',
              author: 'Tutoría',
              text: 'Ausentismo generalizado en todas las materias. Se agendó plática con padres de familia.'
            }
          ];
        } else {
          notesMap[student.id] = [];
        }
      }
    });
    setStudentNotes(notesMap);
  }, [studentsData]);

  // Handle saving new note in persistent localStorage
  const handleSaveNote = (studentId) => {
    const text = newNoteTexts[studentId];
    if (!text || !text.trim()) return;

    const currentNotes = studentNotes[studentId] || [];
    const newNote = {
      id: Date.now(),
      date: new Date().toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      author: 'Coordinación ISC (Tú)',
      text: text.trim()
    };

    const updatedNotes = [newNote, ...currentNotes];
    setStudentNotes(prev => ({
      ...prev,
      [studentId]: updatedNotes
    }));

    localStorage.setItem(`desersion_notes_${studentId}`, JSON.stringify(updatedNotes));
    setNewNoteTexts(prev => ({
      ...prev,
      [studentId]: ''
    }));

    setSuccessMessage(`Observación añadida para el alumno ${studentId}`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Group Heatmap daily averages
  const dailyAverages = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
    const totalRegistrationsPerDay = studentsData.length * subjects.length;

    return days.map(day => {
      let attendedCount = 0;
      studentsData.forEach(student => {
        student.subjectsAttendance.forEach(sa => {
          const record = sa.history.find(h => h.day === day);
          if (record && (record.status === 'A' || record.status === 'R' || record.status === 'J')) {
            attendedCount++;
          }
        });
      });

      const avg = totalRegistrationsPerDay > 0 
        ? Math.round((attendedCount / totalRegistrationsPerDay) * 100) 
        : 0;

      return {
        day,
        avg
      };
    });
  }, [studentsData, subjects]);

  // Dynamic Hourly Block group averages
  const blockAverages = useMemo(() => {
    let inicioSum = 0;
    let mitadSum = 0;
    let finSum = 0;
    const total = studentsData.length;

    studentsData.forEach(student => {
      inicioSum += student.hourlyBlocks.inicio;
      mitadSum += student.hourlyBlocks.mitad;
      finSum += student.hourlyBlocks.fin;
    });

    return {
      inicio: total > 0 ? Math.round(inicioSum / total) : 0,
      mitad: total > 0 ? Math.round(mitadSum / total) : 0,
      fin: total > 0 ? Math.round(finSum / total) : 0
    };
  }, [studentsData]);

  // Find day with lowest average attendance
  const lowestAttendanceDay = useMemo(() => {
    if (dailyAverages.length === 0) return null;
    return dailyAverages.reduce((min, d) => d.avg < min.avg ? d : min, dailyAverages[0]);
  }, [dailyAverages]);

  // Dynamic description inside heatmap card
  const heatmapInsight = useMemo(() => {
    if (!lowestAttendanceDay) return '';
    const dayNames = {
      Lun: 'Lunes',
      Mar: 'Martes',
      Mie: 'Miércoles',
      Jue: 'Jueves',
      Vie: 'Viernes'
    };
    const dayName = dayNames[lowestAttendanceDay.day] || lowestAttendanceDay.day;
    
    if (lowestAttendanceDay.avg < 80) {
      return `Se detecta que el **${dayName}** registra la tasa de inasistencia más alta (${lowestAttendanceDay.avg}%). Se recomienda evitar programar evaluaciones críticas en este día.`;
    }
    return `Asistencia estable durante la semana. El día de menor concurrencia es el **${dayName}** con un **${lowestAttendanceDay.avg}%**.`;
  }, [lowestAttendanceDay]);

  // Hourly block diagnostic insights
  const hourlyInsight = useMemo(() => {
    const { inicio, mitad, fin } = blockAverages;
    const lowestVal = Math.min(inicio, mitad, fin);
    
    const inicioTime = isMatutino ? '07:00 - 08:40' : '14:00 - 15:40';
    const finTime = isMatutino ? '10:20 - 12:00' : '17:20 - 19:00';

    if (lowestVal === fin && fin < 80) {
      return `Alerta de Fuga: Caída de asistencia del grupo al final de la jornada (${fin}% de asistencia entre ${finTime}). Sugiere que los alumnos se retiran temprano.`;
    }
    if (lowestVal === inicio && inicio < 80) {
      return `Alerta de Demora: Ausentismo significativo a primera hora (${inicio}% de asistencia entre ${inicioTime}). Sugiere retardos por transporte/tráfico de entrada.`;
    }
    if (lowestVal === mitad && mitad < 80) {
      return `Alerta de Ausentismo Intermedio: Caída de asistencia del grupo a mitad de la jornada (${mitad}%). Alumnos faltan a clases intermedias.`;
    }
    return `Distribución Horaria Estable: Asistencia balanceada en los tres bloques horarios del día.`;
  }, [blockAverages, isMatutino]);

  // Filter students based on search and risk filters
  const filteredStudents = useMemo(() => {
    return studentsData.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            student.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRisk = riskFilter === 'all' || student.riskLevel === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [studentsData, searchQuery, riskFilter]);

  // Group KPIs calculated dynamically
  const kpis = useMemo(() => {
    const total = studentsData.length;
    const highRisk = studentsData.filter(s => s.riskLevel === 'high').length;
    const mediumRisk = studentsData.filter(s => s.riskLevel === 'medium').length;
    const avgAttendance = total > 0 ? Math.round(studentsData.reduce((sum, s) => sum + s.overallRate, 0) / total) : 0;

    // Find the critical subject (lowest attendance rate across all students)
    const subjectAverages = subjects.map(subj => {
      let sum = 0;
      studentsData.forEach(student => {
        const sa = student.subjectsAttendance.find(s => s.subjectName === subj);
        if (sa) sum += sa.rate;
      });
      return {
        name: subj,
        avg: total > 0 ? Math.round(sum / total) : 0
      };
    });

    const criticalSubject = subjectAverages.reduce((min, s) => s.avg < min.avg ? s : min, { name: 'Ninguna', avg: 100 });

    return {
      total,
      highRisk,
      mediumRisk,
      avgAttendance,
      criticalSubject
    };
  }, [studentsData, subjects]);

  const toggleStudentExpand = (id) => {
    setExpandedStudents(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getStatusBadge = (risk) => {
    switch (risk) {
      case 'high':
        return (
          <span className="bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs px-2.5 py-1 rounded-full font-bold uppercase animate-pulse flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            Riesgo Alto
          </span>
        );
      case 'medium':
        return (
          <span className="bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            Riesgo Medio
          </span>
        );
      default:
        return (
          <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-450 text-xs px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Sin Riesgo
          </span>
        );
    }
  };

  // Trend Badge Component
  const getTrendBadge = (diff) => {
    if (diff > 0) {
      return (
        <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-0.5 border border-emerald-500/15" title="Asistencia subió en comparación a la semana pasada">
          <ArrowUpRight className="w-3 h-3 text-emerald-500" />
          <span>+{diff}%</span>
        </span>
      );
    }
    if (diff < 0) {
      return (
        <span className="bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-455 text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-0.5 border border-rose-500/15" title="Asistencia bajó en comparación a la semana pasada">
          <ArrowDownRight className="w-3 h-3 text-rose-500" />
          <span>{diff}%</span>
        </span>
      );
    }
    return (
      <span className="bg-slate-500/5 text-txt-subtle text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-0.5 border border-bdr-base/20" title="Asistencia estable">
        <MoveRight className="w-3 h-3 text-txt-subtle" />
        <span>Estable</span>
      </span>
    );
  };

  const getStatusColor = (rate) => {
    if (rate < 70) return 'text-rose-500 dark:text-rose-400 font-extrabold';
    if (rate < 80) return 'text-amber-500 dark:text-amber-400 font-bold';
    return 'text-emerald-500 dark:text-emerald-450 font-bold';
  };

  const getDayIcon = (status) => {
    switch (status) {
      case 'A': // Asistió
        return (
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 relative" title="Asistencia Registrada">
            <Check className="w-3.5 h-3.5" />
          </div>
        );
      case 'F': // Falta
        return (
          <div className="w-7 h-7 rounded-full bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-500 relative" title="Inasistencia">
            <X className="w-3.5 h-3.5" />
          </div>
        );
      case 'R': // Retardo
        return (
          <div className="w-7 h-7 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 relative" title="Retardo Registrado">
            <Clock className="w-3.5 h-3.5" />
          </div>
        );
      case 'J': // Justificado
        return (
          <div className="w-7 h-7 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 relative" title="Falta Justificada">
            <Info className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return null;
    }
  };

  // --- EXPORT PDF ACTION ---
  const handleExportPDF = () => {
    setExportingPDF(true);
    setTimeout(() => {
      setExportingPDF(false);
      
      const printWindow = window.open('', '_blank');
      const weekLabel = adminData?.weeks?.find(w => w.id === weekId)?.label || 'Semana de Consulta';
      const lowestVal = Math.min(blockAverages.inicio, blockAverages.mitad, blockAverages.fin);

      printWindow.document.write(`
        <html>
          <head>
            <title>Reporte de Deserción y Asistencia - ${groupName}</title>
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
              .title { font-size: 19px; font-weight: 800; color: #0052cc; letter-spacing: -0.5px; }
              .subtitle { font-size: 12px; color: #64748b; margin-top: 5px; font-weight: 500; }
              .kpi-container { display: flex; gap: 15px; margin-bottom: 20px; }
              .kpi-card { flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; }
              .kpi-val { font-size: 18px; font-weight: 800; color: #0052cc; }
              .kpi-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 2px; }
              .section-title { font-size: 14px; font-weight: 700; margin-top: 30px; margin-bottom: 15px; color: #0052cc; border-left: 4px solid #0052cc; padding-left: 8px; text-transform: uppercase; page-break-after: avoid; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; }
              th { background-color: #0052cc; color: white; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; font-weight: 700; }
              td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; }
              tr:nth-child(even) td { background-color: #f8fafc; }
              .status-badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; }
              .status-high { background-color: #fee2e2; color: #b91c1c; }
              .status-medium { background-color: #fef3c7; color: #b45309; }
              .status-safe { background-color: #dcfce7; color: #15803d; }
              .footer { margin-top: 50px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-weight: 500; }
              .day-grid { display: flex; gap: 4px; }
              .day-dot { width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; color: white; }
              .dot-A { background-color: #10b981; }
              .dot-F { background-color: #ef4444; }
              .dot-R { background-color: #f59e0b; }
              .dot-J { background-color: #3b82f6; }
              .student-section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 15px; page-break-inside: avoid; }
              .student-header { display: flex; justify-content: space-between; font-weight: 750; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 8px; }
              .watermark { height: 55px; opacity: 0.95; object-fit: contain; margin-left: 20px; }
              .notes-container { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; margin-top: 10px; }
              .note-item { font-size: 11px; margin-bottom: 6px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
              .block-analysis { margin-bottom: 25px; padding: 15px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title-area">
                <div class="title">REPORTE DE ALERTA DE ATENCIÓN Y RIESGO DE DESERCIÓN</div>
                <div class="subtitle">Semestre: <strong>${selectedSemester}º Semestre</strong> | Grupo: <strong>${groupName}</strong> | Semana: <strong>${weekLabel}</strong> | Generado: ${new Date().toLocaleString()}</div>
              </div>
              <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" class="watermark" />
            </div>
            
            <div class="kpi-container">
              <div class="kpi-card">
                <div class="kpi-val">${kpis.avgAttendance}%</div>
                <div class="kpi-label">Asistencia Promedio</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val" style="color: #ef4444;">${kpis.highRisk}</div>
                <div class="kpi-label">Riesgo Crítico (<70%)</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val" style="color: #f59e0b;">${kpis.mediumRisk}</div>
                <div class="kpi-label">Riesgo Medio (70%-80%)</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-val" style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${kpis.criticalSubject.name}</div>
                <div class="kpi-label">Materia Crítica (${kpis.criticalSubject.avg}%)</div>
              </div>
            </div>

            <div class="block-analysis">
              <div style="font-size: 12px; font-weight: bold; color: #0052cc; margin-bottom: 10px;">ANÁLISIS DE ASISTENCIA POR BLOQUES HORARIOS:</div>
              <div style="display: flex; gap: 20px; font-size: 12px; margin-bottom: 8px;">
                <div>Inicio Jornada: <strong>${blockAverages.inicio}%</strong></div>
                <div>Mitad Jornada: <strong>${blockAverages.mitad}%</strong></div>
                <div>Fin Jornada: <strong>${blockAverages.fin}%</strong></div>
              </div>
              <div style="font-size: 11px; font-style: italic; color: #475569;">
                <strong>Diagnóstico:</strong> ${hourlyInsight}
              </div>
            </div>
            
            <div class="section-title">Resumen de Alumnos Críticos y en Alerta</div>
            <table>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nombre del Alumno</th>
                  <th>Tasa de Asistencia</th>
                  <th>Tendencia</th>
                  <th>Inicio / Mitad / Fin</th>
                  <th>Nivel de Riesgo</th>
                </tr>
              </thead>
              <tbody>
                ${studentsData.filter(s => s.riskLevel !== 'safe').map(s => {
                  const rClass = s.riskLevel === 'high' ? 'status-high' : 'status-medium';
                  const rLabel = s.riskLevel === 'high' ? 'Riesgo Alto' : 'Riesgo Medio';
                  const trendText = s.trendDiff > 0 ? `+${s.trendDiff}% ↑` : s.trendDiff < 0 ? `${s.trendDiff}% ↓` : 'Estable →';
                  const hourText = `${s.hourlyBlocks.inicio}% / ${s.hourlyBlocks.mitad}% / ${s.hourlyBlocks.fin}%`;
                  return `
                    <tr>
                      <td><strong>${s.id}</strong></td>
                      <td>${s.name}</td>
                      <td><strong>${s.overallRate}%</strong></td>
                      <td>${trendText}</td>
                      <td>${hourText}</td>
                      <td><span class="status-badge ${rClass}">${rLabel}</span></td>
                    </tr>
                  `;
                }).join('')}
                ${studentsData.filter(s => s.riskLevel !== 'safe').length === 0 ? '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No se detectaron alumnos en riesgo crítico en este grupo.</td></tr>' : ''}
              </tbody>
            </table>
            
            <div class="section-title">Detalle de Asistencia de los 5 días por Alumno (Desglose de Materias)</div>
            
            ${studentsData.map(s => {
              const rClass = s.riskLevel === 'high' ? 'status-high' : s.riskLevel === 'medium' ? 'status-medium' : 'status-safe';
              const rLabel = s.riskLevel === 'high' ? 'Riesgo Alto' : s.riskLevel === 'medium' ? 'Riesgo Medio' : 'Sin Riesgo';
              const trendText = s.trendDiff > 0 ? `+${s.trendDiff}% ↑` : s.trendDiff < 0 ? `${s.trendDiff}% ↓` : 'Estable →';
              const savedNotes = studentNotes[s.id] || [];
              const hourText = `Inicio: ${s.hourlyBlocks.inicio}% | Mitad: ${s.hourlyBlocks.mitad}% | Fin: ${s.hourlyBlocks.fin}%`;
              const tagText = s.isEarlyDepartureProfile ? ' - [Se retira temprano]' : s.isLateArrivalProfile ? ' - [Llegadas tarde]' : '';

              return `
                <div class="student-section">
                  <div class="student-header">
                    <span>${s.name} (${s.id}) ${tagText}</span>
                    <div>
                      <span class="status-badge ${rClass}" style="margin-right: 5px;">${rLabel}</span>
                      <span style="font-size: 11px; margin-right: 10px; color:#475569;">Tendencia: ${trendText}</span>
                      <span>Promedio: <strong>${s.overallRate}%</strong></span>
                    </div>
                  </div>
                  <div style="font-size:11px; margin-bottom: 8px; color: #64748b;">
                    <strong>Desglose por Horario:</strong> ${hourText}
                  </div>
                  <table style="margin: 0; width: 100%;">
                    <thead>
                      <tr style="background-color: #f1f5f9;">
                        <th style="color: #475569; font-size: 9px; padding: 4px 8px;">Materia / Asignatura (Hora)</th>
                        <th style="color: #475569; font-size: 9px; padding: 4px 8px; width: 120px;">Lunes - Viernes</th>
                        <th style="color: #475569; font-size: 9px; padding: 4px 8px; text-align: right; width: 80px;">Tasa Asistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${s.subjectsAttendance.map(sa => {
                        const alertIcon = sa.rate < 80 ? '<span style="color: #ef4444; font-weight: bold;">⚠️ </span>' : '';
                        return `
                          <tr>
                            <td style="padding: 4px 8px; font-size: 11px;">${alertIcon}${sa.subjectName} (${sa.scheduleTime})</td>
                            <td style="padding: 4px 8px;">
                              <div class="day-grid">
                                ${sa.history.map(day => `
                                  <div class="day-dot dot-${day.status}" title="${day.day}: ${day.status}">${day.status}</div>
                                `).join('')}
                              </div>
                            </td>
                            <td style="padding: 4px 8px; font-size: 11px; text-align: right; font-weight: bold; ${sa.rate < 80 ? 'color: #b91c1c;' : ''}">${sa.rate}%</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                  
                  ${savedNotes.length > 0 ? `
                    <div class="notes-container">
                      <div style="font-size: 10px; font-weight: bold; color: #0052cc; margin-bottom: 5px;">Bitácora de Observaciones y Tutorías:</div>
                      ${savedNotes.map(n => `
                        <div class="note-item">
                          <strong>${n.author} (${n.date}):</strong> ${n.text}
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
            
            <div class="footer">RinoAsist - Portal Oficial de Monitoreo de Asistencias e Indicador de Alerta de Deserción</div>
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
      
      setSuccessMessage('¡Reporte institucional de alerta de deserción generado con éxito!');
      setTimeout(() => setSuccessMessage(''), 4000);
    }, 1200);
  };

  const handleExportStudentBitacora = (student) => {
    const printWindow = window.open('', '_blank');
    const savedNotes = studentNotes[student.id] || [];
    const overallRateColor = student.overallRate >= 80 ? '#10b981' : student.overallRate >= 70 ? '#d97706' : '#dc2626';
    const riskLabel = student.riskLevel === 'high' ? 'Riesgo Alto' : student.riskLevel === 'medium' ? 'Riesgo Medio' : 'Sin Riesgo';
    const riskBadgeColor = student.riskLevel === 'high' ? '#fee2e2' : student.riskLevel === 'medium' ? '#fef3c7' : '#dcfce7';
    const riskTextColor = student.riskLevel === 'high' ? '#b91c1c' : student.riskLevel === 'medium' ? '#b45309' : '#15803d';

    // Helper to calculate deterministic rate for a specific week
    const getWeekAttendanceRate = (stud, wkId) => {
      const dbStud = dbStudents.find(s => s.nombre === stud.name || s.matricula === stud.id || `AL-${s.id}` === stud.id);
      const dbId = dbStud ? dbStud.id : 38;

      let baseRate = 85;
      let isEarlyDepartureProfile = false;
      let isLateArrivalProfile = false;

      if (dbId === 38) {
        baseRate = 74; // Medium Risk - Profile: Late Arrival
        isLateArrivalProfile = true;
      } else if (dbId % 3 === 0) {
        baseRate = 65; // High Risk - Profile: Early Departure
        isEarlyDepartureProfile = true;
      } else if (dbId % 3 === 1) {
        baseRate = 78; // Medium Risk - Profile: Early Departure
        isEarlyDepartureProfile = true;
      } else {
        baseRate = 85 + (dbId % 15);
      }

      let isEarlyDepartureProfileVal = isEarlyDepartureProfile;
      let isLateArrivalProfileVal = isLateArrivalProfile;

      const approvedJustifications = JSON.parse(localStorage.getItem('approved_justifications') || '[]');

      const getExactDateOfRecord = (wk, dayName) => {
        const baseDates = {
          w1: { Lun: '2026-05-25', Mar: '2026-05-26', Mie: '2026-05-27', Jue: '2026-05-28', Vie: '2026-05-29' },
          w2: { Lun: '2026-05-18', Mar: '2026-05-19', Mie: '2026-05-20', Jue: '2026-05-21', Vie: '2026-05-22' },
          w3: { Lun: '2026-05-11', Mar: '2026-05-12', Mie: '2026-05-13', Jue: '2026-05-14', Vie: '2026-05-15' },
          w4: { Lun: '2026-05-04', Mar: '2026-05-05', Mie: '2026-05-06', Jue: '2026-05-07', Vie: '2026-05-08' }
        };
        return baseDates[wk]?.[dayName] || null;
      };

      const daysOfWeek = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
      const rates = subjects.map(subj => {
        const keySeed = `${stud.id}-${subj}-${wkId}`;
        const rand = seedRandom(keySeed);
        const subjRateOffset = Math.round((rand() * 12) - 6);
        let subjTargetRate = Math.min(100, Math.max(20, baseRate + subjRateOffset));

        const schedInfo = getSubjectSchedule(subj, subjects, isMatutino);
        if (isEarlyDepartureProfile && schedInfo.block === 'Fin') {
          subjTargetRate = Math.max(10, subjTargetRate - 35);
        }
        if (isLateArrivalProfile && schedInfo.block === 'Inicio') {
          subjTargetRate = Math.max(10, subjTargetRate - 30);
        }

        const history = daysOfWeek.map((day, dayIdx) => {
          const daySeed = `${keySeed}-${dayIdx}`;
          const dayRand = seedRandom(daySeed);
          const roll = dayRand();

          let status = 'A';
          if (roll * 100 > subjTargetRate) {
            status = dayRand() < 0.25 ? 'J' : 'F';
          } else {
            if (isLateArrivalProfile && schedInfo.block === 'Inicio') {
              status = dayRand() < 0.40 ? 'R' : 'A';
            } else {
              status = dayRand() < 0.12 ? 'R' : 'A';
            }
          }

          const exactDate = getExactDateOfRecord(wkId, day);
          const hasJustification = approvedJustifications.some(just => 
            just.studentId === stud.id && 
            just.status === 'Aprobado' &&
            exactDate >= just.startDate && 
            exactDate <= just.endDate
          );

          if (hasJustification) {
            status = 'J';
          }

          return { day, status };
        });

        const attendedCount = history.filter(h => h.status === 'A' || h.status === 'R' || h.status === 'J').length;
        return Math.round((attendedCount / 5) * 100);
      });

      return Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
    };

    const rateW1 = getWeekAttendanceRate(student, 'w1');
    const rateW2 = getWeekAttendanceRate(student, 'w2');
    const rateW3 = getWeekAttendanceRate(student, 'w3');
    const rateW4 = getWeekAttendanceRate(student, 'w4');

    printWindow.document.write(`
      <html>
        <head>
          <title>Bitácora de Observaciones - ${student.name}</title>
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
            .title { font-size: 19px; font-weight: 800; color: #0052cc; letter-spacing: -0.5px; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 5px; font-weight: 500; }
            .watermark { height: 55px; opacity: 0.95; object-fit: contain; margin-left: 20px; }
            
            .info-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 25px; }
            .info-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background-color: #f8fafc; }
            .info-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
            .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
            .info-row:last-child { border-bottom: none; }
            .info-row strong { color: #1e293b; }
            
            .stats-card { display: flex; flex-direction: column; justify-content: center; align-items: center; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background-color: #f8fafc; text-align: center; }
            .stats-val { font-size: 32px; font-weight: 800; }
            .stats-lbl { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 4px; }
            .risk-badge { margin-top: 10px; padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-weight: 750; text-transform: uppercase; display: inline-block; }
            
            .weeks-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; page-break-inside: avoid; }
            .week-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background-color: #f8fafc; text-align: center; }
            .week-title { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.2px; }
            .week-val { font-size: 18px; font-weight: 800; margin-top: 4px; }

            .attendance-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
            .attendance-table th { background-color: #0052cc; color: #ffffff; padding: 8px 12px; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; text-align: center; }
            .attendance-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; }
            .attendance-table tr:last-child td { border-bottom: none; }

            .section-title { font-size: 13px; font-weight: 700; color: #0052cc; border-left: 4px solid #0052cc; padding-left: 8px; text-transform: uppercase; margin-top: 30px; margin-bottom: 15px; page-break-after: avoid; }
            
            .timeline { position: relative; margin-left: 10px; padding-left: 20px; border-left: 2px solid #cbd5e1; }
            .timeline-item { position: relative; margin-bottom: 20px; page-break-inside: avoid; }
            .timeline-dot { position: absolute; left: -26px; top: 3px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 2px #0052cc; background-color: #0052cc; }
            .timeline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-size: 11px; font-weight: 700; color: #475569; }
            .timeline-author { color: #0052cc; font-weight: 750; }
            .timeline-body { font-size: 12.5px; line-height: 1.5; color: #334155; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; }
            
            .empty-state { text-align: center; padding: 30px; color: #94a3b8; font-style: italic; font-size: 12px; border: 1px dashed #cbd5e1; border-radius: 12px; }
            .footer { margin-top: 60px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-area">
              <div class="title">BITÁCORA DE SEGUIMIENTO Y ACUERDOS DE TUTORÍA</div>
              <div class="subtitle">Reporte Oficial del Estudiante | Generado: ${new Date().toLocaleString()}</div>
            </div>
            <img src="${window.location.origin}/isc_logo.jpg" alt="Logo ISC" class="watermark" />
          </div>
          
          <div class="info-grid">
            <div class="info-card">
              <div class="info-title">Datos del Estudiante</div>
              <div class="info-row">
                <span>Nombre Completo:</span>
                <strong>${student.name}</strong>
              </div>
              <div class="info-row">
                <span>Número de Control / Matrícula:</span>
                <strong>${student.id}</strong>
              </div>
              <div class="info-row">
                <span>Semestre y Grupo:</span>
                <strong>${selectedSemester}º Semestre | ${groupName}</strong>
              </div>
              <div class="info-row">
                <span>Plan de Estudios:</span>
                <strong>Ingeniería en Sistemas Computacionales (Turno ${isMatutino ? 'Matutino' : 'Vespertino'})</strong>
              </div>
            </div>
            
            <div class="stats-card">
              <div class="info-title">Tasa de Asistencia Semanal</div>
              <div class="stats-val" style="color: ${overallRateColor};">${student.overallRate}%</div>
              <div class="stats-lbl">Promedio Consolidado</div>
              <span class="risk-badge" style="background-color: ${riskBadgeColor}; color: ${riskTextColor};">
                ${riskLabel}
              </span>
            </div>
          </div>

          <div class="section-title">Reporte de Asistencia Histórica (Últimas 4 Semanas)</div>
          <div class="weeks-container">
            <div class="week-card">
              <div class="week-title">Semana Actual (w1)</div>
              <div class="week-val" style="color: ${rateW1 >= 80 ? '#10b981' : rateW1 >= 70 ? '#d97706' : '#dc2626'};">${rateW1}%</div>
            </div>
            <div class="week-card">
              <div class="week-title">Semana Anterior (w2)</div>
              <div class="week-val" style="color: ${rateW2 >= 80 ? '#10b981' : rateW2 >= 70 ? '#d97706' : '#dc2626'};">${rateW2}%</div>
            </div>
            <div class="week-card">
              <div class="week-title">Hace 2 Semanas (w3)</div>
              <div class="week-val" style="color: ${rateW3 >= 80 ? '#10b981' : rateW3 >= 70 ? '#d97706' : '#dc2626'};">${rateW3}%</div>
            </div>
            <div class="week-card">
              <div class="week-title">Hace 3 Semanas (w4)</div>
              <div class="week-val" style="color: ${rateW4 >= 80 ? '#10b981' : rateW4 >= 70 ? '#d97706' : '#dc2626'};">${rateW4}%</div>
            </div>
          </div>

          <div class="section-title">Desglose de Asistencia por Materia (Semana Seleccionada)</div>
          <table class="attendance-table">
            <thead>
              <tr>
                <th style="text-align: left;">Materia</th>
                <th>Lun</th>
                <th>Mar</th>
                <th>Mié</th>
                <th>Jue</th>
                <th>Vie</th>
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              ${student.subjectsAttendance.map(subj => {
                const getStatusBadge = (status) => {
                  if (status === 'A') return '<span style="color: #10b981; font-weight: bold;">✔</span>';
                  if (status === 'R') return '<span style="color: #d97706; font-weight: bold;">R</span>';
                  if (status === 'J') return '<span style="color: #3b82f6; font-weight: bold;">J</span>';
                  return '<span style="color: #dc2626; font-weight: bold;">✘</span>';
                };
                return `
                  <tr>
                    <td style="font-weight: 600; text-align: left; color: #1e293b;">${subj.subjectName}</td>
                    <td>${getStatusBadge(subj.history[0]?.status)}</td>
                    <td>${getStatusBadge(subj.history[1]?.status)}</td>
                    <td>${getStatusBadge(subj.history[2]?.status)}</td>
                    <td>${getStatusBadge(subj.history[3]?.status)}</td>
                    <td>${getStatusBadge(subj.history[4]?.status)}</td>
                    <td style="font-weight: bold; color: ${subj.rate >= 80 ? '#10b981' : subj.rate >= 70 ? '#d97706' : '#dc2626'};">${subj.rate}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="section-title">Historial Cronológico de Anotaciones</div>
          
          ${savedNotes.length > 0 ? `
            <div class="timeline">
              ${savedNotes.map(note => `
                <div class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-header">
                    <span class="timeline-author">${note.author}</span>
                    <span>${note.date}</span>
                  </div>
                  <div class="timeline-body">
                    ${note.text}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state">
              No se han registrado observaciones, acuerdos de tutoría ni amonestaciones en la bitácora escolar de este alumno.
            </div>
          `}
          
          <div class="footer">RinoAsist - Portal Oficial de Monitoreo de Asistencias e Indicador de Alerta de Deserción</div>
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
    setSuccessMessage(`¡Bitácora en PDF de ${student.name} generada con éxito!`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // --- EXPORT EXCEL ACTION ---
  const handleExportExcel = () => {
    setExportingExcel(true);
    setTimeout(() => {
      setExportingExcel(false);
      const weekLabel = adminData?.weeks?.find(w => w.id === weekId)?.label || 'Semana';

      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Control Deserción</x:Name>
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
            .section-row { background-color: #f1f5f9; font-weight: bold; font-size: 11pt; color: #0f172a; }
            .val-good { color: #15803d; font-weight: bold; background-color: #dcfce7; text-align: right; }
            .val-warning { color: #b45309; font-weight: bold; background-color: #fef3c7; text-align: right; }
            .val-danger { color: #b91c1c; font-weight: bold; background-color: #fee2e2; text-align: right; }
            .status-A { color: #15803d; background-color: #dcfce7; font-weight: bold; text-align: center; }
            .status-F { color: #b91c1c; background-color: #fee2e2; font-weight: bold; text-align: center; }
            .status-R { color: #b45309; background-color: #fef3c7; font-weight: bold; text-align: center; }
            .status-J { color: #1d4ed8; background-color: #dbeafe; font-weight: bold; text-align: center; }
            .student-total-row { background-color: #e2e8f0; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="12" class="title-row" style="border: none;">REPORTE DE CONTROL DE ASISTENCIA Y DESERCIÓN - INGENIERÍA EN SISTEMAS COMPUTACIONALES</td>
            </tr>
            <tr>
              <td colspan="12" class="meta-row" style="border: none;">Semestre: ${selectedSemester}º Semestre | Grupo: ${groupName} | Filtro: ${weekLabel} | Generado: ${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td colspan="12" style="border: none;"><strong>KPI Asistencia Promedio del Grupo:</strong> ${kpis.avgAttendance}% de asistencia.</td>
            </tr>
            <tr><td colspan="12" style="border: none;"></td></tr>
            
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Nombre del Alumno</th>
                <th>Materia / Indicador</th>
                <th>Horario Bloque</th>
                <th>Lunes</th>
                <th>Martes</th>
                <th>Miércoles</th>
                <th>Jueves</th>
                <th>Viernes</th>
                <th>Tasa de Asistencia</th>
                <th>Tendencia vs anterior</th>
                <th>Observaciones Bitácora</th>
              </tr>
            </thead>
            <tbody>
      `;

      studentsData.forEach(student => {
        const studClass = student.overallRate >= 80 ? 'val-good' : student.overallRate >= 70 ? 'val-warning' : 'val-danger';
        const trendText = student.trendDiff > 0 ? `+${student.trendDiff}% (Sube)` : student.trendDiff < 0 ? `${student.trendDiff}% (Baja)` : 'Estable';
        const lastNote = studentNotes[student.id] && studentNotes[student.id].length > 0 
          ? `[${studentNotes[student.id][0].date}] ${studentNotes[student.id][0].author}: ${studentNotes[student.id][0].text}`
          : 'Sin anotaciones';
        const profileTag = student.isEarlyDepartureProfile ? 'Se retira temprano' : student.isLateArrivalProfile ? 'Llegadas tarde' : 'Estable';
        
        // General student line
        htmlContent += `
          <tr class="student-total-row">
            <td><strong>${student.id}</strong></td>
            <td><strong>${student.name}</strong></td>
            <td><strong>CONSOLIDADO SEMANAL</strong></td>
            <td>${profileTag}</td>
            <td colspan="5" style="background-color: #f8fafc; text-align: center; color: #64748b; font-style: italic;">Resumen General (Inicio: ${student.hourlyBlocks.inicio}% / Mitad: ${student.hourlyBlocks.mitad}% / Fin: ${student.hourlyBlocks.fin}%)</td>
            <td class="${studClass}">${student.overallRate}%</td>
            <td><strong>${trendText}</strong></td>
            <td><strong>${lastNote}</strong></td>
          </tr>
        `;

        // Render each subject for the student
        student.subjectsAttendance.forEach(sa => {
          const subClass = sa.rate >= 80 ? 'val-good' : sa.rate >= 70 ? 'val-warning' : 'val-danger';
          
          const lun = sa.history.find(h => h.day === 'Lun')?.status || '-';
          const mar = sa.history.find(h => h.day === 'Mar')?.status || '-';
          const mie = sa.history.find(h => h.day === 'Mie')?.status || '-';
          const jue = sa.history.find(h => h.day === 'Jue')?.status || '-';
          const vie = sa.history.find(h => h.day === 'Vie')?.status || '-';

          htmlContent += `
            <tr>
              <td style="color: #64748b; font-style: italic;">${student.id}</td>
              <td style="color: #64748b;">${student.name}</td>
              <td>${sa.subjectName}</td>
              <td>${sa.scheduleTime} (${sa.scheduleBlock})</td>
              <td class="status-${lun}">${lun}</td>
              <td class="status-${mar}">${mar}</td>
              <td class="status-${mie}">${mie}</td>
              <td class="status-${jue}">${jue}</td>
              <td class="status-${vie}">${vie}</td>
              <td class="${subClass}">${sa.rate}%</td>
              <td></td>
              <td></td>
            </tr>
          `;
        });
      });
      
      htmlContent += `
            </tbody>
          </table>
          <br/>
          <table>
            <thead>
              <tr>
                <th colspan="2" style="background-color: #475569;">Glosario de Estados</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>A</strong></td><td>Asistencia Puntual (100% de validez)</td></tr>
              <tr><td><strong>F</strong></td><td>Falta / Inasistencia (0% de validez)</td></tr>
              <tr><td><strong>R</strong></td><td>Retardo (Registrado como asistencia con demora)</td></tr>
              <tr><td><strong>J</strong></td><td>Falta Justificada (Justificación médica/oficial)</td></tr>
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Alerta_Desercion_${groupName.replace(/\s+/g, '_')}_${weekId}.xls`;
      link.click();
      
      setSuccessMessage('¡Reporte detallado en Excel (.xls) descargado con éxito!');
      setTimeout(() => setSuccessMessage(''), 4000);
    }, 1200);
  };

  const lowestVal = Math.min(blockAverages.inicio, blockAverages.mitad, blockAverages.fin);

  if (loadingStudents) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Clock className="w-10 h-10 animate-spin text-brand-primary" />
        <p className="text-sm font-semibold text-txt-subtle">Cargando listado de alumnos y análisis de deserción...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      
      {/* 1. KPI cards for early warning */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI: Group Average Attendance */}
        <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Asistencia Promedio</span>
            <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-extrabold text-brand-primary">{kpis.avgAttendance}%</h3>
            <span className="text-[10px] font-semibold text-txt-muted block">Promedio semanal del grupo</span>
          </div>
        </div>

        {/* KPI: High Risk */}
        <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Riesgo Crítico</span>
            <div className="bg-rose-500/10 text-rose-500 p-1.5 rounded-lg border border-rose-500/10">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className={`text-2xl font-extrabold ${kpis.highRisk > 0 ? 'text-rose-500 animate-pulse' : 'text-txt-base'}`}>{kpis.highRisk} alumnos</h3>
            <span className="text-[10px] font-semibold text-txt-muted block">Con asistencia menor al 70%</span>
          </div>
        </div>

        {/* KPI: Medium Risk */}
        <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Riesgo Medio</span>
            <div className="bg-amber-500/10 text-amber-500 p-1.5 rounded-lg border border-amber-500/10">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className={`text-2xl font-extrabold ${kpis.mediumRisk > 0 ? 'text-amber-500' : 'text-txt-base'}`}>{kpis.mediumRisk} alumnos</h3>
            <span className="text-[10px] font-semibold text-txt-muted block">Con asistencia entre 70% y 80%</span>
          </div>
        </div>

        {/* KPI: Critical Subject */}
        <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
          <div className="flex justify-between items-start mb-3">
            <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Materia Crítica</span>
            <div className="bg-slate-500/10 text-txt-muted p-1.5 rounded-lg border border-bdr-base">
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
          </div>
          <div className="space-y-1 overflow-hidden">
            <h3 className="text-base font-extrabold truncate text-txt-base" title={kpis.criticalSubject.name}>
              {kpis.criticalSubject.name}
            </h3>
            <span className="text-[10px] font-bold text-rose-500 block">Mayor inasistencia ({kpis.criticalSubject.avg}%)</span>
          </div>
        </div>
      </div>

      {/* 2. Semester Selector Grid */}
      <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-xl">Monitoreo de Deserción por Carrera (ISC)</h3>
            <p className="text-xs text-txt-muted">Selecciona el semestre y el grupo para evaluar el ausentismo diario y horario.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-bold text-txt-muted whitespace-nowrap">Semana:</label>
              <select 
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs font-semibold cursor-pointer theme-transition w-full sm:w-40"
              >
                <option value="w1">Semana Actual (25-29 May)</option>
                <option value="w2">Semana Anterior (18-22 May)</option>
                <option value="w3">Hace 2 Semanas (11-15 May)</option>
                <option value="w4">Hace 3 Semanas (04-08 May)</option>
              </select>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF || exportingExcel}
              className="py-2.5 px-4 border border-brand-primary hover:bg-brand-primary/5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 text-brand-primary theme-transition"
            >
              {exportingPDF ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Ficha PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportingPDF || exportingExcel}
              className="py-2.5 px-4 border border-emerald-600 hover:bg-emerald-600/5 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 text-emerald-650 dark:text-emerald-500 theme-transition"
            >
              {exportingExcel ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Descargar Excel</span>
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-450 p-2 rounded-xl text-xs font-bold text-center animate-fadeIn theme-transition">
            {successMessage}
          </div>
        )}

        {/* Semesters Pills */}
        <div className="space-y-2 pt-2">
          <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Seleccionar Semestre</label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
              <button
                key={sem}
                onClick={() => setSelectedSemester(sem)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedSemester === sem
                    ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30 shadow-sm'
                    : 'bg-bg-surface hover:bg-bg-base/40 text-txt-muted border-bdr-base hover:border-brand-primary/40 hover:text-brand-primary'
                }`}
              >
                {sem}º Semestre
              </button>
            ))}
          </div>
        </div>

        {/* Groups Grid Selector */}
        <div className="space-y-2 pt-2">
          <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Seleccionar Grupo de {selectedSemester}º Semestre</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {groups.map((group) => {
              const isSelected = selectedGroupName === group.name;
              const isMatutinoGroup = group.name ? !group.name.toUpperCase().includes('V') : true;
              const displayAvg = group.average;

              return (
                <div
                  key={group.name}
                  onClick={() => setSelectedGroupName(group.name)}
                  className={`border p-3.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-20 select-none ${
                    isSelected
                      ? 'bg-brand-primary/5 dark:bg-brand-primary/10 border-brand-primary/45 shadow-md shadow-brand-primary/5 scale-[1.02]'
                      : 'bg-bg-surface hover:bg-bg-base/50 border-bdr-base hover:border-brand-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-xs text-txt-base">{group.name}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      isMatutinoGroup 
                        ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' 
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {isMatutinoGroup ? 'Mat' : 'Vesp'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end mt-1">
                    <span className="text-[9px] text-txt-subtle">Carrera ISC</span>
                    <span className={`text-xs font-extrabold ${
                      displayAvg >= 85 ? 'text-emerald-500' : displayAvg >= 80 ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {displayAvg}%
                    </span>
                  </div>
                </div>
              );
            })}
            {groups.length === 0 && (
              <div className="col-span-full py-4 text-center text-txt-subtle text-xs bg-bg-surface/50 rounded-xl border border-bdr-base/50">
                No hay grupos registrados en este semestre para el turno seleccionado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2b. Two-Column Analytics: Heatmap & Hourly Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Card: Mapa de Calor Semanal (Heatmap) */}
        <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4.5 h-4.5 text-brand-primary" />
              <h4 className="font-extrabold text-base text-txt-base">Mapa de Calor Semanal</h4>
            </div>
            <p className="text-[11px] text-txt-muted">Tasa de ausentismo del grupo por día de la semana.</p>
          </div>

          <div className="grid grid-cols-5 gap-2 my-4">
            {dailyAverages.map((dayData) => {
              const val = dayData.avg;
              const bgClass = val >= 85 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                : val >= 80 
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' 
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20';

              return (
                <div 
                  key={dayData.day} 
                  className={`border rounded-xl p-2.5 flex flex-col items-center justify-center gap-1.5 h-20 transition-all ${bgClass}`}
                  title={`${dayData.day}: ${val}% asistencia`}
                >
                  <span className="text-xs font-extrabold">{dayData.day}</span>
                  <span className="text-[10px] font-extrabold leading-none">{val}%</span>
                </div>
              );
            })}
          </div>

          <div className="bg-bg-surface/50 border border-bdr-base/50 p-3 rounded-xl flex gap-2 items-start text-[11px] theme-transition">
            <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <p className="text-txt-muted text-left leading-relaxed font-semibold">
              {heatmapInsight}
            </p>
          </div>
        </div>

        {/* Right Card: Distribución por Bloque Horario */}
        <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4.5 h-4.5 text-brand-primary" />
              <h4 className="font-extrabold text-base text-txt-base">Distribución por Bloque Horario</h4>
            </div>
            <p className="text-[11px] text-txt-muted">Asistencia promedio según la hora del día en este grupo.</p>
          </div>

          <div className="space-y-3.5 my-4">
            {/* Inicio */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-txt-muted">Inicio de Jornada ({isMatutino ? '07:00 - 08:40' : '14:00 - 15:40'})</span>
                <span className={`${blockAverages.inicio < 80 ? 'text-rose-500 font-extrabold' : 'text-emerald-500 font-bold'}`}>{blockAverages.inicio}%</span>
              </div>
              <div className="w-full bg-bg-surface border border-bdr-base/45 rounded-full h-2 theme-transition">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${blockAverages.inicio < 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                  style={{ width: `${blockAverages.inicio}%` }}
                ></div>
              </div>
            </div>

            {/* Mitad */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-txt-muted">Mitad de Jornada ({isMatutino ? '08:40 - 10:20' : '15:40 - 17:20'})</span>
                <span className={`${blockAverages.mitad < 80 ? 'text-rose-500 font-extrabold' : 'text-emerald-500 font-bold'}`}>{blockAverages.mitad}%</span>
              </div>
              <div className="w-full bg-bg-surface border border-bdr-base/45 rounded-full h-2 theme-transition">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${blockAverages.mitad < 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                  style={{ width: `${blockAverages.mitad}%` }}
                ></div>
              </div>
            </div>

            {/* Fin */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-txt-muted">Fin de Jornada ({isMatutino ? '10:20 - 12:00' : '17:20 - 19:00'})</span>
                <span className={`${blockAverages.fin < 80 ? 'text-rose-500 font-extrabold' : 'text-emerald-500 font-bold'}`}>{blockAverages.fin}%</span>
              </div>
              <div className="w-full bg-bg-surface border border-bdr-base/45 rounded-full h-2 theme-transition">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${blockAverages.fin < 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                  style={{ width: `${blockAverages.fin}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-bg-surface/50 border border-bdr-base/50 p-3 rounded-xl flex gap-2 items-start text-[11px] theme-transition">
            <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${lowestVal < 80 ? 'text-rose-500' : 'text-brand-primary'}`} />
            <p className="text-txt-muted text-left leading-relaxed font-semibold">
              {hourlyInsight}
            </p>
          </div>
        </div>

      </div>

      {/* 3. Search and Filters Row */}
      <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center theme-transition">
        <div className="flex-grow space-y-1.5">
          <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Buscar Estudiante</label>
          <div className="relative">
            <Search className="w-4 h-4 text-txt-subtle absolute left-4 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o número de control / matrícula..."
              className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl pl-11 pr-4 py-2.5 outline-none text-sm theme-transition"
            />
          </div>
        </div>

        {/* Attrition Risk Filter Pills */}
        <div className="shrink-0 space-y-1.5 w-full sm:w-auto">
          <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Filtrar por Riesgo de Deserción</label>
          <div className="flex flex-wrap sm:flex-nowrap bg-bg-surface border border-bdr-base rounded-xl p-1 w-full sm:w-fit theme-transition gap-1 sm:gap-0">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'high', label: 'Riesgo Alto' },
              { id: 'medium', label: 'Riesgo Medio' },
              { id: 'safe', label: 'Sin Riesgo' }
            ].map((filter) => {
              const count = studentsData.filter(s => filter.id === 'all' || s.riskLevel === filter.id).length;
              return (
                <button
                  key={filter.id}
                  onClick={() => setRiskFilter(filter.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-grow sm:flex-grow-0 ${
                    riskFilter === filter.id
                      ? 'bg-bg-card text-brand-primary shadow-sm border border-bdr-base/20 font-extrabold'
                      : 'text-txt-muted hover:text-brand-primary border border-transparent'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    riskFilter === filter.id 
                      ? 'bg-brand-primary/10 text-brand-primary' 
                      : 'bg-bg-base/30 text-txt-subtle'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Students Expandable Table */}
      <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
        <div className="p-6 border-b border-bdr-base flex justify-between items-center theme-transition">
          <div>
            <h3 className="text-lg font-bold">Listado de Alumnos Inscritos</h3>
            <p className="text-txt-muted text-xs mt-0.5">Control individualizado y semáforo de asistencia de las materias en curso.</p>
          </div>
          <span className="text-[10px] font-bold bg-brand-primary/10 border border-brand-primary/15 text-brand-primary px-3 py-1 rounded-full uppercase tracking-wider">
            {groupName} • {weekId === 'w1' ? 'Semana Actual' : 'Historial'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                <th className="py-4 px-6 w-12 text-center">Detalle</th>
                <th className="py-4 px-6 w-32">ID Alumno</th>
                <th className="py-4 px-6">Nombre Completo</th>
                <th className="py-4 px-6">Tendencia</th>
                <th className="py-4 px-6">Nivel de Riesgo</th>
                <th className="py-4 px-6 text-right">Asistencia Semanal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-subtle/50 theme-transition">
              {filteredStudents.map((student) => {
                const isExpanded = !!expandedStudents[student.id];
                
                return (
                  <React.Fragment key={student.id}>
                    {/* Main Row */}
                    <tr 
                      onClick={() => toggleStudentExpand(student.id)}
                      className="hover:bg-bg-surface/30 cursor-pointer transition-colors duration-200"
                    >
                      <td className="py-4 px-6 text-center">
                        <div className="flex justify-center items-center">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-brand-primary shrink-0 transition-transform" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-txt-subtle shrink-0 transition-transform hover:text-brand-primary" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-txt-subtle">{student.id}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-brand-primary/10 text-brand-primary border border-brand-primary/20 w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0">
                            {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-txt-base block">{student.name}</span>
                            <span className="text-[10px] text-txt-subtle font-medium">Inscrito en {subjects.length} materias</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {getTrendBadge(student.trendDiff)}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(student.riskLevel)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`text-sm font-extrabold ${getStatusColor(student.overallRate)}`}>
                          {student.overallRate}%
                        </span>
                      </td>
                    </tr>

                    {/* Expandable detailed Row */}
                    <tr className={`bg-bg-surface/15 theme-transition table-accordion-row ${isExpanded ? 'expanded' : ''}`}>
                      <td colSpan="6" className={`p-0 transition-all duration-300 ${isExpanded ? 'border-b border-bdr-base' : 'border-b-0 border-bdr-base/0'}`}>
                        <div className={`table-accordion-content ${isExpanded ? 'expanded' : ''}`}>
                          <div className="space-y-6 text-left">
                            
                            {/* Personal Hourly Performance metrics block */}
                            <div className="space-y-2">
                              <h4 className="font-bold text-xs text-brand-primary uppercase tracking-wider">Desglose de asistencia por horario de jornada</h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-bdr-base/60 bg-bg-card p-4 rounded-xl shadow-sm">
                                <div className="text-center space-y-1">
                                  <span className="text-[10px] text-txt-subtle font-bold uppercase tracking-wider block">Inicio de Jornada</span>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className={`text-base font-extrabold ${getStatusColor(student.hourlyBlocks.inicio)}`}>
                                      {student.hourlyBlocks.inicio}%
                                    </span>
                                    {student.isLateArrivalProfile && (
                                      <span className="bg-amber-550/10 border border-amber-500/25 text-[8px] text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded font-bold uppercase animate-pulse shrink-0">Llega Tarde</span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-txt-subtle">{isMatutino ? '07:00 - 08:40' : '14:00 - 15:40'}</p>
                                </div>

                                <div className="text-center space-y-1 border-y sm:border-y-0 sm:border-x border-bdr-base/50 py-3 sm:py-0">
                                  <span className="text-[10px] text-txt-subtle font-bold uppercase tracking-wider block">Mitad de Jornada</span>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className={`text-base font-extrabold ${getStatusColor(student.hourlyBlocks.mitad)}`}>
                                      {student.hourlyBlocks.mitad}%
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-txt-subtle">{isMatutino ? '08:40 - 10:20' : '15:40 - 17:20'}</p>
                                </div>

                                <div className="text-center space-y-1">
                                  <span className="text-[10px] text-txt-subtle font-bold uppercase tracking-wider block">Fin de Jornada</span>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className={`text-base font-extrabold ${getStatusColor(student.hourlyBlocks.fin)}`}>
                                      {student.hourlyBlocks.fin}%
                                    </span>
                                    {student.isEarlyDepartureProfile && (
                                      <span className="bg-rose-550/10 border border-rose-500/25 text-[8px] text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded font-bold uppercase animate-pulse shrink-0">Se va Temprano</span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-txt-subtle">{isMatutino ? '10:20 - 12:00' : '17:20 - 19:00'}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Detailed Attendance Grid */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <h4 className="font-bold text-xs text-brand-primary uppercase tracking-wider">Detalle semanal por materia y horario de clase</h4>
                                <div className="flex gap-4 text-[9px] text-txt-subtle font-bold">
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> A: Asistió</span>
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"></span> F: Falta</span>
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span> R: Retardo</span>
                                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500"></span> J: Justificado</span>
                                </div>
                              </div>

                              <div className="border border-bdr-base/70 rounded-xl overflow-hidden bg-bg-card">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-bg-surface/50 text-txt-subtle text-[9px] font-extrabold uppercase tracking-wider border-b border-bdr-base theme-transition">
                                      <th className="py-2.5 px-4">Asignatura / Materia</th>
                                      <th className="py-2.5 px-4">Bloque Horario</th>
                                      <th className="py-2.5 px-4 text-center w-20">Lun</th>
                                      <th className="py-2.5 px-4 text-center w-20">Mar</th>
                                      <th className="py-2.5 px-4 text-center w-20">Mié</th>
                                      <th className="py-2.5 px-4 text-center w-20">Jue</th>
                                      <th className="py-2.5 px-4 text-center w-20">Vie</th>
                                      <th className="py-2.5 px-4 text-center w-24">Asistencias</th>
                                      <th className="py-2.5 px-4 text-right w-24">Porcentaje</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-bdr-subtle/40">
                                    {student.subjectsAttendance.map((sa) => {
                                      const isSubjAtRisk = sa.rate < 80;
                                      const lun = sa.history.find(h => h.day === 'Lun')?.status;
                                      const mar = sa.history.find(h => h.day === 'Mar')?.status;
                                      const mie = sa.history.find(h => h.day === 'Mie')?.status;
                                      const jue = sa.history.find(h => h.day === 'Jue')?.status;
                                      const vieDay = sa.history.find(h => h.day === 'Vie')?.status;

                                      return (
                                        <tr key={sa.subjectName} className="hover:bg-bg-surface/20 transition-colors">
                                          <td className="py-2.5 px-4 flex items-center gap-2">
                                            {isSubjAtRisk && (
                                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" title="Atención: Asistencia crítica en esta materia" />
                                            )}
                                            <span className={`text-xs font-semibold ${isSubjAtRisk ? 'text-rose-500 font-bold' : 'text-txt-base'}`}>
                                              {sa.subjectName}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-4 text-xs font-semibold text-txt-subtle">
                                            {sa.scheduleTime} ({sa.scheduleBlock})
                                          </td>
                                          <td className="py-2.5 px-4"><div className="flex justify-center">{getDayIcon(lun)}</div></td>
                                          <td className="py-2.5 px-4"><div className="flex justify-center">{getDayIcon(mar)}</div></td>
                                          <td className="py-2.5 px-4"><div className="flex justify-center">{getDayIcon(mie)}</div></td>
                                          <td className="py-2.5 px-4"><div className="flex justify-center">{getDayIcon(jue)}</div></td>
                                          <td className="py-2.5 px-4"><div className="flex justify-center">{getDayIcon(vieDay)}</div></td>
                                          <td className="py-2.5 px-4 text-center text-xs font-bold text-txt-muted">
                                            {sa.attendedCount} / 5 días
                                          </td>
                                          <td className="py-2.5 px-4 text-right">
                                            <span className={`text-xs font-extrabold ${getStatusColor(sa.rate)}`}>
                                              {sa.rate}%
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* TENDENCIA & PROJECTION: Dropout / Risk Alert Banner */}
                            {student.riskLevel !== 'safe' && (
                              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-start gap-3 text-rose-600 dark:text-rose-455 theme-transition">
                                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                                <div className="space-y-1">
                                  <h5 className="font-extrabold text-xs">Alerta de Deserción Escolar Activa</h5>
                                  <p className="text-[11px] font-semibold text-txt-muted leading-relaxed">
                                    {student.isEarlyDepartureProfile ? (
                                      `Proyección Horaria: El estudiante presenta ausentismo selectivo al final de la jornada (${student.hourlyBlocks.fin}% de asistencia). Este comportamiento de retirarse temprano pone en riesgo el derecho a evaluación en las materias del último bloque.`
                                    ) : student.isLateArrivalProfile ? (
                                      `Proyección Horaria: El estudiante registra ausentismo recurrente y retardos al inicio de la jornada (${student.hourlyBlocks.inicio}% de asistencia). Sugiere dificultades críticas para presentarse a primera hora del día.`
                                    ) : (
                                      `Proyección Escolar: El estudiante presenta ausentismo generalizado en todos los bloques del día (${student.overallRate}% general). Requiere entrevista inmediata con coordinación y tutoría.`
                                    )}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* BITÁCORA: Follow-up Notes */}
                            <div className="border-t border-bdr-base/70 pt-5 space-y-3.5 text-left">
                              <div className="flex justify-between items-center border-b border-bdr-base/40 pb-2 flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-txt-base">
                                  <FileText className="w-4 h-4 text-brand-primary" />
                                  <h5 className="font-bold text-xs uppercase tracking-wider">Bitácora de Observaciones y Tutorías</h5>
                                </div>
                                <button
                                  onClick={() => handleExportStudentBitacora(student)}
                                  className="py-1.5 px-3 border border-brand-primary hover:bg-brand-primary/5 hover:scale-[1.01] active:scale-[0.98] rounded-xl text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 text-brand-primary theme-transition"
                                  title="Descargar bitácora de este alumno en PDF"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Descargar Bitácora</span>
                                </button>
                              </div>

                              {/* Form to submit a new note */}
                              <div className="flex gap-3 items-end">
                                <div className="flex-grow">
                                  <textarea
                                    rows={2}
                                    value={newNoteTexts[student.id] || ''}
                                    onChange={(e) => setNewNoteTexts(prev => ({ ...prev, [student.id]: e.target.value }))}
                                    placeholder="Escribe una observación administrativa, justificación oficial o acuerdo de tutoría escolar..."
                                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2 outline-none text-xs theme-transition resize-none"
                                  />
                                </div>
                                <button
                                  onClick={() => handleSaveNote(student.id)}
                                  disabled={!newNoteTexts[student.id] || !newNoteTexts[student.id].trim()}
                                  className="py-2 px-4 bg-brand-primary hover:bg-brand-hover disabled:opacity-55 disabled:scale-100 text-white font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 h-[36px] shrink-0"
                                >
                                  <span>Guardar Nota</span>
                                </button>
                              </div>

                              {/* Notes list */}
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {(studentNotes[student.id] || []).map((note) => (
                                  <div key={note.id} className="bg-bg-surface/50 border border-bdr-base/40 p-3 rounded-xl text-xs space-y-1">
                                    <div className="flex justify-between items-center text-[10px] text-txt-subtle font-bold">
                                      <span>{note.author}</span>
                                      <span>{note.date}</span>
                                    </div>
                                    <p className="text-txt-muted text-left leading-relaxed">{note.text}</p>
                                  </div>
                                ))}
                                {(!studentNotes[student.id] || studentNotes[student.id].length === 0) && (
                                  <p className="text-[11px] text-txt-subtle italic text-center py-2">No se han registrado observaciones en la bitácora escolar de este alumno.</p>
                                )}
                              </div>

                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 px-6 text-center text-txt-subtle space-y-2">
                    <AlertTriangle className="w-8 h-8 mx-auto text-txt-subtle" />
                    <h4 className="font-bold text-sm">No se encontraron alumnos</h4>
                    <p className="text-xs">Intenta cambiar el término de búsqueda o aflojar el filtro de riesgo.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
