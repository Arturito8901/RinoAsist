import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Check, X, ShieldAlert, FileCheck, FileX, 
  Plus, Calendar, User, Upload, ChevronDown, ChevronUp, Search, Info,
  Download, Printer
} from 'lucide-react';

const generateSessionId = () => `SESS-${Date.now()}`;

const INITIAL_MOCK_JUSTIFICATIONS = [];

export default function JustificantesTab({ isDocente = false, docenteId = null }) {
  const [activeSubTab, setActiveSubTab] = useState('justificantes'); // 'justificantes' | 'aclaraciones'
  const [justifications, setJustifications] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [claims, setClaims] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'Pendiente', 'Aprobado', 'Rechazado'
  const [claimSearchQuery, setClaimSearchQuery] = useState('');
  const [claimStatusFilter, setClaimStatusFilter] = useState('all'); // 'all', 'Pendiente', 'Aprobado', 'Rechazado'
  
  // Form fields
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [reason, setReason] = useState('Médico');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [fileName, setFileName] = useState('');
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load justifications and claims from localStorage on mount
  useEffect(() => {
    const savedJusts = localStorage.getItem('approved_justifications');
    if (savedJusts) {
      setJustifications(JSON.parse(savedJusts));
    } else {
      setJustifications(INITIAL_MOCK_JUSTIFICATIONS);
      localStorage.setItem('approved_justifications', JSON.stringify(INITIAL_MOCK_JUSTIFICATIONS));
    }

    const savedClaims = localStorage.getItem('attendance_claims');
    if (savedClaims) {
      setClaims(JSON.parse(savedClaims));
    } else {
      // Mock claims
      const initialClaims = [
        {
          id: 'claim-1',
          studentId: 'ST-001',
          studentName: 'Juan Pérez García',
          courseId: '101',
          courseName: 'Programación Web',
          date: '2026-05-25',
          reason: 'Error de lector QR',
          notes: 'El lector QR no leyó mi celular al ingresar, pero estuve presente toda la sesión.',
          status: 'Pendiente',
          submittedAt: new Date().toISOString()
        },
        {
          id: 'claim-2',
          studentId: 'ST-003',
          studentName: 'Carlos López Ramos',
          courseId: '101',
          courseName: 'Programación Web',
          date: '2026-05-27',
          reason: 'Olvido de escaneo',
          notes: 'Se me pasó registrar el QR al entrar porque llegué corriendo. El profesor me vio ahí.',
          status: 'Pendiente',
          submittedAt: new Date().toISOString()
        }
      ];
      setClaims(initialClaims);
      localStorage.setItem('attendance_claims', JSON.stringify(initialClaims));
    }
  }, []);

  // Save changes helper functions
  const saveToStorage = (updatedList) => {
    setJustifications(updatedList);
    localStorage.setItem('approved_justifications', JSON.stringify(updatedList));
  };

  const saveClaimsToStorage = (updatedClaims) => {
    setClaims(updatedClaims);
    localStorage.setItem('attendance_claims', JSON.stringify(updatedClaims));
  };

  const handleDownloadFile = (just) => {
    const content = `==================================================
✉️ [JUSTIFICANTE RinoAsist]
==================================================
Folio: ${just.id}
Alumno: ${just.studentName}
Matrícula: ${just.studentId || 'AL-XXXXXX'}
Motivo: ${just.reason}
Periodo: ${just.startDate} al ${just.endDate}
Estatus: ${just.status}

Archivo Original: ${just.fileName}

Notas y Diagnóstico:
${just.notes || 'No se ingresaron notas adicionales.'}
==================================================
Documento emitido para fines de justificación escolar.
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = just.fileName.replace(/\.[^/.]+$/, "") + "_descargado.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintReceipt = (just) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    
    const formattedDate = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Acuse de Justificación - ${just.studentName}</title>
          <style>
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              padding: 40px;
              color: #0f172a;
              line-height: 1.6;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #0052cc;
              padding-bottom: 20px;
              margin-bottom: 40px;
            }
            .logo {
              font-size: 28px;
              font-weight: 800;
              color: #0052cc;
              margin: 0;
              letter-spacing: 2px;
            }
            .subtitle {
              font-size: 12px;
              color: #64748b;
              margin-top: 5px;
              text-transform: uppercase;
              font-weight: bold;
            }
            .title {
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 30px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .date {
              text-align: right;
              font-size: 14px;
              margin-bottom: 40px;
            }
            .salutation {
              font-weight: bold;
              margin-bottom: 20px;
            }
            .content {
              font-size: 15px;
              text-align: justify;
              margin-bottom: 40px;
            }
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .details-table td {
              padding: 8px 12px;
              border: 1px solid #e2e8f0;
            }
            .details-table td.label {
              font-weight: bold;
              background-color: #f8fafc;
              width: 30%;
            }
            .signature {
              margin-top: 80px;
              text-align: center;
            }
            .signature-line {
              width: 250px;
              border-top: 1px solid #0f172a;
              margin: 0 auto 10px auto;
            }
            .footer {
              margin-top: 100px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="logo">RinoAsist</h1>
            <div class="subtitle">Tecnológico de Estudios Superiores de Chimalhuacán</div>
          </div>
          
          <div class="date">
            Chimalhuacán, Estado de México, a ${formattedDate}
          </div>
          
          <div class="title">
            Acuse de Justificación Oficial de Inasistencias
          </div>
          
          <div class="salutation">
            A LOS DOCENTES DE LA INSTITUCIÓN:<br>
            PRESENTE.
          </div>
          
          <div class="content">
            Por medio de la presente, el Departamento de Control Escolar hace constar que el estudiante cuyos detalles se describen a continuación ha presentado la documentación correspondiente para justificar sus inasistencias debido a motivos de causa mayor:
            
            <table class="details-table">
              <tr>
                <td class="label">Nombre del Alumno</td>
                <td>${just.studentName}</td>
              </tr>
              <tr>
                <td class="label">Matrícula</td>
                <td>${just.studentId || 'N/A'}</td>
              </tr>
              <tr>
                <td class="label">Motivo</td>
                <td>${just.reason}</td>
              </tr>
              <tr>
                <td class="label">Periodo Justificado</td>
                <td>Del <strong>${just.startDate}</strong> al <strong>${just.endDate}</strong></td>
              </tr>
              <tr>
                <td class="label">Archivo Adjunto</td>
                <td>${just.fileName}</td>
              </tr>
            </table>
            
            Por tal motivo, se solicita atentamente a los docentes correspondientes otorgar las facilidades necesarias para justificar las inasistencias acumuladas durante el periodo mencionado, así como permitir la entrega y evaluación de trabajos, prácticas o exámenes pendientes, conforme al reglamento escolar.
          </div>
          
          <div class="signature">
            <div class="signature-line"></div>
            <strong>Departamento de Control Escolar</strong><br>
            Administración Central RinoAsist
          </div>
          
          <div class="footer">
            Este acuse es un documento digital oficial generado por el sistema de control de asistencias RinoAsist.
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Get docente's assigned students (or all students for admin)
  const teacherStudents = useMemo(() => {
    try {
      const allAssignments = JSON.parse(localStorage.getItem('teacher_assignments') || '[]');
      const allStudentsMap = JSON.parse(localStorage.getItem('students') || '{}');
      
      if (isDocente && docenteId) {
        const myAssignments = allAssignments.filter(a => Number(a.docente_id) === Number(docenteId));
        const myGroupIds = myAssignments.map(a => a.grupo_id.toString());
        
        let list = [];
        myGroupIds.forEach(gid => {
          if (allStudentsMap[gid]) {
            list = [...list, ...allStudentsMap[gid]];
          }
        });
        
        // Unique students by ID
        const unique = [];
        const seen = new Set();
        list.forEach(s => {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            unique.push(s);
          }
        });
        return unique;
      }
      
      // For Admin: show all students from all groups
      let allStudents = [];
      Object.keys(allStudentsMap).forEach(gid => {
        allStudents = [...allStudents, ...allStudentsMap[gid]];
      });
      const unique = [];
      const seen = new Set();
      allStudents.forEach(s => {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          unique.push(s);
        }
      });
      return unique;
    } catch (e) {
      console.error("Error reading students for dropdown:", e);
      return [];
    }
  }, [isDocente, docenteId]);

  // Justifications scoped to the current user (filtered by group students if docent)
  const myJustifications = useMemo(() => {
    if (isDocente) {
      const studentIds = new Set(teacherStudents.map(s => s.id));
      return justifications.filter(just => studentIds.has(just.studentId));
    }
    return justifications;
  }, [justifications, isDocente, teacherStudents]);

  // KPIs computed over current user's scoped justifications
  const kpis = useMemo(() => {
    const total = myJustifications.length;
    const pending = myJustifications.filter(j => j.status === 'Pendiente').length;
    const approved = myJustifications.filter(j => j.status === 'Aprobado').length;
    const rejected = myJustifications.filter(j => j.status === 'Rechazado').length;
    return { total, pending, approved, rejected };
  }, [myJustifications]);

  // Filter justifications
  const filteredJustifications = useMemo(() => {
    return myJustifications.filter(just => {
      const matchesSearch = just.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            just.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (just.fileName && just.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || just.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [myJustifications, searchQuery, statusFilter]);

  // Claims scoped to the current user (filtered by group students if docent)
  const myClaims = useMemo(() => {
    if (isDocente) {
      const studentIds = new Set(teacherStudents.map(s => s.id));
      return claims.filter(c => studentIds.has(c.studentId));
    }
    return claims;
  }, [claims, isDocente, teacherStudents]);

  // Filter claims
  const filteredClaims = useMemo(() => {
    return myClaims.filter(claim => {
      const matchesSearch = claim.studentName.toLowerCase().includes(claimSearchQuery.toLowerCase()) || 
                            claim.studentId.toLowerCase().includes(claimSearchQuery.toLowerCase()) ||
                            claim.courseName.toLowerCase().includes(claimSearchQuery.toLowerCase());
      
      const matchesStatus = claimStatusFilter === 'all' || claim.status === claimStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [myClaims, claimSearchQuery, claimStatusFilter]);

  // KPIs for claims
  const claimKpis = useMemo(() => {
    const total = myClaims.length;
    const pending = myClaims.filter(c => c.status === 'Pendiente').length;
    const approved = myClaims.filter(c => c.status === 'Aprobado').length;
    const rejected = myClaims.filter(c => c.status === 'Rechazado').length;
    return { total, pending, approved, rejected };
  }, [myClaims]);

  // Handle registration submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!studentId || !studentName || !startDate || !endDate) {
      setErrorMessage('Por favor, completa todos los campos requeridos (*).');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setErrorMessage('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    const newJust = {
      id: `just-${Date.now()}`,
      studentId: studentId.trim().toUpperCase(),
      studentName: studentName.trim(),
      reason,
      startDate,
      endDate,
      status: 'Pendiente',
      fileName: fileName || 'documento_justificante.pdf',
      notes: notes.trim()
    };

    const updated = [newJust, ...justifications];
    saveToStorage(updated);
    
    // Clear form
    setStudentId('');
    setStudentName('');
    setStartDate('');
    setEndDate('');
    setNotes('');
    setFileName('');
    setReason('Médico');
    
    setIsFormOpen(false);
    setErrorMessage('');
    setSuccessMessage('¡Solicitud de justificante registrada como pendiente!');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Approve / Reject justification and update mock DB history/rates
  const handleUpdateStatus = (id, newStatus) => {
    const targetJust = justifications.find(j => j.id === id);
    
    const updated = justifications.map(j => {
      if (j.id === id) {
        return { ...j, status: newStatus };
      }
      return j;
    });
    saveToStorage(updated);
    
    // Update local DB if approved
    if (newStatus === 'Aprobado' && targetJust) {
      try {
        const studentId = targetJust.studentId;
        const startDate = targetJust.startDate;
        const endDate = targetJust.endDate;
        
        // 1. Update attendance_history
        const history = JSON.parse(localStorage.getItem('attendance_history') || '[]');
        let updatedHistoryCount = 0;
        
        const updatedHistory = history.map(session => {
          if (session.date >= startDate && session.date <= endDate) {
            const updatedRecords = session.records.map(record => {
              if (record.studentId === studentId && record.status === 'F') {
                updatedHistoryCount++;
                return { ...record, status: 'J', notes: 'Justificado: ' + (targetJust.reason || 'Médico') };
              }
              return record;
            });
            return { ...session, records: updatedRecords };
          }
          return session;
        });
        
        if (updatedHistoryCount > 0) {
          localStorage.setItem('attendance_history', JSON.stringify(updatedHistory));
        }
        
        // 2. Recalculate student attendance rates across all groups they are in
        const studentsMap = JSON.parse(localStorage.getItem('students') || '{}');
        let updatedStudentsCount = 0;
        
        Object.keys(studentsMap).forEach(groupId => {
          const groupStudents = studentsMap[groupId];
          const hasStudent = groupStudents.some(s => s.id === studentId);
          
          if (hasStudent) {
            const groupHistory = updatedHistory.filter(h => h.groupId === groupId);
            const studentRecords = [];
            
            groupHistory.forEach(session => {
              const rec = session.records.find(r => r.studentId === studentId);
              if (rec) studentRecords.push(rec);
            });
            
            if (studentRecords.length > 0) {
              let scoreSum = 0;
              studentRecords.forEach(r => {
                if (r.status === 'A') scoreSum += 1.0;
                else if (r.status === 'R') scoreSum += 0.8;
                else if (r.status === 'J') scoreSum += 1.0; // J counts as 1.0 (Neutral/Presente)
              });
              const newRate = Math.round((scoreSum / studentRecords.length) * 100);
              
              studentsMap[groupId] = groupStudents.map(student => {
                if (student.id === studentId) {
                  updatedStudentsCount++;
                  return { ...student, attendanceRate: newRate };
                }
                return student;
              });
            }
          }
        });
        
        if (updatedStudentsCount > 0) {
          localStorage.setItem('students', JSON.stringify(studentsMap));
        }
      } catch (err) {
        console.error("Error updating attendance records upon excuse approval:", err);
      }
    }
    
    setSuccessMessage(`Justificante ${newStatus === 'Aprobado' ? 'aprobado' : 'rechazado'} con éxito.`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // Approve / Reject claim and update mock DB history/rates
  const handleUpdateClaimStatus = (id, newStatus) => {
    const targetClaim = claims.find(c => c.id === id);
    
    const updated = claims.map(c => {
      if (c.id === id) {
        return { ...c, status: newStatus };
      }
      return c;
    });
    saveClaimsToStorage(updated);
    
    // Update local DB if approved
    if (newStatus === 'Aprobado' && targetClaim) {
      try {
        const studentId = targetClaim.studentId;
        const groupId = targetClaim.courseId;
        const targetDate = targetClaim.date;
        
        // 1. Update attendance_history
        const history = JSON.parse(localStorage.getItem('attendance_history') || '[]');
        let updatedHistoryCount = 0;
        
        const updatedHistory = history.map(session => {
          if (session.groupId === groupId && session.date === targetDate) {
            const updatedRecords = session.records.map(record => {
              if (record.studentId === studentId && (record.status === 'F' || record.status === 'R')) {
                updatedHistoryCount++;
                return { ...record, status: 'A', notes: 'Aclarado QR: ' + (targetClaim.reason || 'Error') };
              }
              return record;
            });
            return { ...session, records: updatedRecords };
          }
          return session;
        });
        
        if (updatedHistoryCount > 0) {
          localStorage.setItem('attendance_history', JSON.stringify(updatedHistory));
        } else {
          // If no session existed, create one
          const configs = JSON.parse(localStorage.getItem('qr_tolerance_configs') || '{}');
          const groupConfig = configs[groupId] || { present: 10, tardy: 20 };
          const studentsMap = JSON.parse(localStorage.getItem('students') || '{}');
          const groupStudents = studentsMap[groupId] || [];
          
          const newSession = {
            id: generateSessionId(),
            groupId,
            date: targetDate,
            records: groupStudents.map(s => ({
              studentId: s.id,
              status: s.id === studentId ? 'A' : 'F',
              notes: s.id === studentId ? 'Aclarado QR: ' + targetClaim.reason : ''
            })),
            updatedAt: new Date().toLocaleString('es-MX')
          };
          history.push(newSession);
          localStorage.setItem('attendance_history', JSON.stringify(history));
          updatedHistoryCount = 1;
        }
        
        // 2. Recalculate student attendance rates across all groups they are in
        const studentsMap = JSON.parse(localStorage.getItem('students') || '{}');
        let updatedStudentsCount = 0;
        
        Object.keys(studentsMap).forEach(gId => {
          const groupStudents = studentsMap[gId];
          const hasStudent = groupStudents.some(s => s.id === studentId);
          
          if (hasStudent) {
            const groupHistory = JSON.parse(localStorage.getItem('attendance_history') || '[]').filter(h => h.groupId === gId);
            const studentRecords = [];
            
            groupHistory.forEach(session => {
              const rec = session.records.find(r => r.studentId === studentId);
              if (rec) studentRecords.push(rec);
            });
            
            if (studentRecords.length > 0) {
              let scoreSum = 0;
              studentRecords.forEach(r => {
                if (r.status === 'A') scoreSum += 1.0;
                else if (r.status === 'R') scoreSum += 0.8;
                else if (r.status === 'J') scoreSum += 1.0;
              });
              const newRate = Math.round((scoreSum / studentRecords.length) * 100);
              
              studentsMap[gId] = groupStudents.map(student => {
                if (student.id === studentId) {
                  updatedStudentsCount++;
                  return { ...student, attendanceRate: newRate };
                }
                return student;
              });
            }
          }
        });
        
        if (updatedStudentsCount > 0) {
          localStorage.setItem('students', JSON.stringify(studentsMap));
        }
      } catch (err) {
        console.error("Error updating attendance records upon claim approval:", err);
      }
    }
    
    setSuccessMessage(`Aclaración de asistencia ${newStatus === 'Aprobado' ? 'aprobada' : 'rechazada'} con éxito.`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Aprobado':
        return (
          <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-450 text-xs px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Aprobado
          </span>
        );
      case 'Rechazado':
        return (
          <span className="bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1.5 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            Rechazado
          </span>
        );
      default:
        return (
          <span className="bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1.5 w-fit animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Sub-tabs switcher */}
      <div className="flex bg-bg-surface border border-bdr-base rounded-2xl p-1 w-fit theme-transition">
        <button
          onClick={() => {
            setActiveSubTab('justificantes');
            setSuccessMessage('');
            setErrorMessage('');
          }}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'justificantes'
              ? 'bg-brand-primary text-white shadow-sm font-black'
              : 'text-txt-muted hover:text-brand-primary'
          }`}
        >
          Justificantes Médicos
        </button>
        <button
          onClick={() => {
            setActiveSubTab('aclaraciones');
            setSuccessMessage('');
            setErrorMessage('');
          }}
          className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'aclaraciones'
              ? 'bg-brand-primary text-white shadow-sm font-black'
              : 'text-txt-muted hover:text-brand-primary'
          }`}
        >
          Aclaraciones de Faltas
        </button>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-450 p-3 rounded-xl text-xs font-bold text-center animate-fadeIn theme-transition">
          {successMessage}
        </div>
      )}

      {activeSubTab === 'justificantes' ? (
        <>
          {/* 1. Registration and List Header */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h3 className="font-extrabold text-xl">Gestión Centralizada de Justificantes</h3>
                <p className="text-xs text-txt-muted">Autoriza justificantes médicos u oficiales para omitir inasistencias en todas las asignaturas.</p>
              </div>

              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="py-2.5 px-4 bg-brand-primary hover:bg-brand-hover text-white font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-primary/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Justificante</span>
              </button>
            </div>

            {/* Expandable Registration Form */}
            {isFormOpen && (
              <form onSubmit={handleSubmit} className="border border-bdr-base/70 bg-bg-surface p-6 rounded-2xl space-y-4 animate-slideDown theme-transition">
                <h4 className="font-bold text-sm text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4.5 h-4.5" />
                  <span>Registrar justificante oficial / médico</span>
                </h4>
                
                {errorMessage && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-2.5 rounded-xl text-xs font-bold text-center">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Student Selector */}
                  {isDocente ? (
                    <div className="space-y-1.5 md:col-span-2 text-left">
                      <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Seleccionar Alumno *</label>
                      <select
                        required
                        value={studentId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setStudentId(selectedId);
                          const std = teacherStudents.find(s => s.id === selectedId);
                          if (std) setStudentName(std.name);
                        }}
                        className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs font-semibold theme-transition cursor-pointer"
                      >
                        <option value="">-- Selecciona un Alumno --</option>
                        {teacherStudents.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      {/* ID Alumno */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Matrícula / ID Alumno *</label>
                        <div className="relative">
                          <User className="w-4.5 h-4.5 text-txt-subtle absolute left-4 top-3" />
                          <input
                            type="text"
                            required
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            placeholder="Ej. AL-2610101"
                            className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl pl-11 pr-4 py-2.5 outline-none text-xs theme-transition"
                          />
                        </div>
                      </div>

                      {/* Nombre Completo */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Nombre Completo del Alumno *</label>
                        <input
                          type="text"
                          required
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="Nombre completo del estudiante..."
                          className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition"
                        />
                      </div>
                    </>
                  )}

                  {/* Motivo */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Motivo de Falta *</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs font-semibold theme-transition cursor-pointer"
                    >
                      <option value="Médico">Médico (Salud / Receta)</option>
                      <option value="Académico">Académico / Evento Oficial</option>
                      <option value="Personal">Personal / Fuerza Mayor</option>
                    </select>
                  </div>

                  {/* Mock Upload File */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Documento Adjunto (Opcional)</label>
                    <div className="relative">
                      <input
                        type="file"
                        id="justification-file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setFileName(file.name);
                          }
                        }}
                      />
                      <label
                        htmlFor="justification-file"
                        className="w-full bg-bg-card border border-bdr-base hover:border-brand-primary/50 text-txt-base hover:text-brand-primary rounded-xl pl-11 pr-4 py-2.5 outline-none text-xs theme-transition flex items-center justify-between cursor-pointer min-h-[38px]"
                      >
                        <Upload className="w-4.5 h-4.5 text-txt-subtle absolute left-4 top-2.5" />
                        <span className="truncate font-semibold pl-1">
                          {fileName || 'Seleccionar archivo...'}
                        </span>
                        {fileName && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setFileName('');
                              document.getElementById('justification-file').value = '';
                            }}
                            className="text-rose-500 hover:text-rose-700 ml-2 font-bold focus:outline-none"
                          >
                            ✕
                          </button>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Fecha de Inicio */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Fecha de Inicio *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                    />
                  </div>

                  {/* Fecha de Fin */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Fecha de Fin *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                    />
                  </div>
                </div>

                {/* Observaciones */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Observaciones / Diagnóstico</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Añade detalles del justificante (ej. Reposo médico de 48 horas, asistencia a evento deportivo)..."
                    className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setErrorMessage('');
                    }}
                    className="py-2.5 px-4 bg-bg-card hover:bg-bg-base/80 border border-bdr-base text-txt-base font-bold rounded-xl text-xs cursor-pointer transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-brand-primary hover:bg-brand-hover text-white font-bold rounded-xl text-xs cursor-pointer transition-all"
                  >
                    Enviar Solicitud
                  </button>
                </div>

              </form>
            )}
          </div>

          {/* 2. KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Total Recibidos</span>
                <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-txt-base">{kpis.total} solicitudes</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Justificantes cargados en ciclo</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Pendientes</span>
                <div className="bg-amber-500/10 text-amber-500 p-1.5 rounded-lg border border-amber-500/10">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className={`text-2xl font-extrabold ${kpis.pending > 0 ? 'text-amber-500 animate-pulse' : 'text-txt-base'}`}>{kpis.pending} peticiones</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Esperando firma de autorización</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Aprobados</span>
                <div className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-lg border border-emerald-500/10">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-emerald-500">{kpis.approved} aprobados</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Aplicados al historial escolar</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Rechazados</span>
                <div className="bg-rose-500/10 text-rose-500 p-1.5 rounded-lg border border-rose-500/10">
                  <FileX className="w-4 h-4 text-rose-500" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-txt-subtle">{kpis.rejected} rechazados</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Inasistencias no justificadas</span>
              </div>
            </div>
          </div>

          {/* 3. Search and Filters Row */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center theme-transition">
            <div className="flex-grow space-y-1.5">
              <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Búsqueda Rápida</label>
              <div className="relative">
                <Search className="w-4 h-4 text-txt-subtle absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, matrícula de alumno o archivo adjunto..."
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl pl-11 pr-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
            </div>

            {/* Estatus Filter Pills */}
            <div className="w-full md:w-auto space-y-1.5 shrink-0">
              <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Filtrar por Estatus</label>
              <div className="grid grid-cols-2 sm:flex bg-bg-surface border border-bdr-base rounded-2xl sm:rounded-xl p-1 w-full md:w-fit theme-transition gap-1 sm:gap-0">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'Pendiente', label: 'Pendientes' },
                  { id: 'Aprobado', label: 'Aprobados' },
                  { id: 'Rechazado', label: 'Rechazados' }
                ].map((filter) => {
                  const count = justifications.filter(j => filter.id === 'all' || j.status === filter.id).length;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setStatusFilter(filter.id)}
                      className={`px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
                        statusFilter === filter.id
                          ? 'bg-bg-card text-brand-primary shadow-sm border border-bdr-base/20 font-extrabold'
                          : 'text-txt-muted hover:text-brand-primary border border-transparent'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        statusFilter === filter.id 
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

          {/* 4. Requests Audit Table */}
          <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
            <div className="p-6 border-b border-bdr-base flex justify-between items-center theme-transition">
              <div>
                <h3 className="text-lg font-bold">Historial de Justificantes Registrados</h3>
                <p className="text-txt-muted text-xs mt-0.5">Listado y auditoría de permisos. Los aprobados sobreescriben faltas en el sistema automáticamente.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                    <th className="py-4 px-6 w-32">ID Alumno</th>
                    <th className="py-4 px-6">Alumno</th>
                    <th className="py-4 px-6">Motivo</th>
                    <th className="py-4 px-6">Período de Falta</th>
                    <th className="py-4 px-6">Adjunto</th>
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6 text-center w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-subtle/50 theme-transition">
                  {filteredJustifications.map((just) => (
                    <tr key={just.id} className="hover:bg-bg-surface/10 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-txt-subtle">{just.studentId}</td>
                      <td className="py-4 px-6">
                        <div>
                          <span className="font-semibold text-txt-base block">{just.studentName}</span>
                          {just.notes && (
                            <p className="text-[10px] text-txt-subtle italic max-w-xs truncate" title={just.notes}>
                              "{just.notes}"
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-xs font-bold ${
                          just.reason === 'Médico' ? 'text-blue-500' : just.reason === 'Académico' ? 'text-indigo-500' : 'text-purple-550'
                        }`}>
                          {just.reason}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-xs text-txt-muted font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                          <span>{just.startDate} al {just.endDate}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-[11px] text-txt-subtle">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[120px]" title={just.fileName}>{just.fileName}</span>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(just)}
                            className="text-brand-primary hover:text-brand-hover p-1 rounded hover:bg-brand-primary/10 transition-all cursor-pointer flex items-center justify-center"
                            title="Descargar Justificante"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(just.status)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center items-center gap-2">
                          {just.status === 'Pendiente' ? (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(just.id, 'Aprobado')}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 p-2 rounded-xl transition-all cursor-pointer"
                                title="Aprobar Justificante"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(just.id, 'Rechazado')}
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 p-2 rounded-xl transition-all cursor-pointer"
                                title="Rechazar Justificante"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-txt-subtle font-bold italic mr-1">Auditado</span>
                              {!isDocente && just.status === 'Aprobado' && (
                                <button
                                  type="button"
                                  onClick={() => handlePrintReceipt(just)}
                                  className="bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center animate-fadeIn"
                                  title="Generar Acuse de Recibo"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredJustifications.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-12 px-6 text-center text-txt-subtle space-y-2">
                        <Info className="w-8 h-8 mx-auto text-txt-subtle" />
                        <h4 className="font-bold text-sm">No se encontraron justificantes</h4>
                        <p className="text-xs">No hay registros cargados con los filtros seleccionados.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ACLARACIONES SUBTAB */}
          {/* 1. Header */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-2 theme-transition">
            <h3 className="font-extrabold text-xl">Aclaraciones de Asistencias (Reportes de Omisión QR)</h3>
            <p className="text-xs text-txt-muted">
              Revisa y autoriza las solicitudes de alumnos que no pudieron registrar su asistencia presencial debido a fallas técnicas, olvido o falta de datos.
            </p>
          </div>

          {/* 2. KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Total Recibidos</span>
                <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg border border-brand-primary/10">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-txt-base">{claimKpis.total} solicitudes</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Aclaraciones reportadas</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Pendientes</span>
                <div className="bg-amber-500/10 text-amber-500 p-1.5 rounded-lg border border-amber-500/10">
                  <ShieldAlert className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className={`text-2xl font-extrabold ${claimKpis.pending > 0 ? 'text-amber-500' : 'text-txt-base'}`}>{claimKpis.pending} peticiones</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Esperando tu revisión</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Aprobadas</span>
                <div className="bg-emerald-500/10 text-emerald-500 p-1.5 rounded-lg border border-emerald-500/10">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-emerald-500">{claimKpis.approved} autorizadas</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Corregidas en bitácora</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex flex-col justify-between theme-transition">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-bold text-txt-subtle uppercase tracking-wider">Rechazadas</span>
                <div className="bg-rose-500/10 text-rose-500 p-1.5 rounded-lg border border-rose-500/10">
                  <FileX className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-extrabold text-txt-base">{claimKpis.rejected} denegadas</h3>
                <span className="text-[10px] font-semibold text-txt-muted block">Sin modificación de falta</span>
              </div>
            </div>
          </div>

          {/* 3. Search and Filters */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center theme-transition">
            <div className="flex-grow space-y-1.5">
              <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Buscar Aclaraciones</label>
              <div className="relative">
                <Search className="w-4 h-4 text-txt-subtle absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={claimSearchQuery}
                  onChange={(e) => setClaimSearchQuery(e.target.value)}
                  placeholder="Buscar por alumno, matrícula o materia..."
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl pl-11 pr-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>
            </div>

            <div className="w-full md:w-auto space-y-1.5 shrink-0">
              <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Filtrar Estatus</label>
              <div className="grid grid-cols-2 sm:flex bg-bg-surface border border-bdr-base rounded-2xl sm:rounded-xl p-1 w-full md:w-fit theme-transition gap-1 sm:gap-0">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'Pendiente', label: 'Pendientes' },
                  { id: 'Aprobado', label: 'Aprobados' },
                  { id: 'Rechazado', label: 'Rechazados' }
                ].map((filter) => {
                  const count = myClaims.filter(c => filter.id === 'all' || c.status === filter.id).length;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setClaimStatusFilter(filter.id)}
                      className={`px-3 py-2 sm:py-1.5 rounded-xl sm:rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-1.5 ${
                        claimStatusFilter === filter.id
                          ? 'bg-bg-card text-brand-primary shadow-sm border border-bdr-base/20 font-extrabold'
                          : 'text-txt-muted hover:text-brand-primary border border-transparent'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        claimStatusFilter === filter.id 
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

          {/* 4. Claims Table */}
          <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                    <th className="py-4 px-6 w-32">Matrícula</th>
                    <th className="py-4 px-6">Alumno</th>
                    <th className="py-4 px-6">Materia / Grupo</th>
                    <th className="py-4 px-6">Fecha Clase</th>
                    <th className="py-4 px-6">Motivo Reportado</th>
                    <th className="py-4 px-6">Notas / Detalles</th>
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6 text-center w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-subtle/50 theme-transition">
                  {filteredClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-bg-surface/10 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-txt-subtle">{claim.studentId}</td>
                      <td className="py-4 px-6 font-semibold text-txt-base">{claim.studentName}</td>
                      <td className="py-4 px-6 font-bold text-txt-base">{claim.courseName}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-xs text-txt-muted font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                          <span>{claim.date}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-brand-primary font-bold">{claim.reason}</td>
                      <td className="py-4 px-6 text-xs text-txt-muted italic max-w-xs truncate" title={claim.notes}>
                        "{claim.notes || 'Sin detalles'}"
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(claim.status)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center items-center gap-2">
                          {claim.status === 'Pendiente' ? (
                            <>
                              <button
                                onClick={() => handleUpdateClaimStatus(claim.id, 'Aprobado')}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-450 border border-emerald-500/20 p-2 rounded-xl transition-all cursor-pointer"
                                title="Autorizar Asistencia"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUpdateClaimStatus(claim.id, 'Rechazado')}
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 p-2 rounded-xl transition-all cursor-pointer"
                                title="Rechazar Reclamación"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-txt-subtle font-bold italic">Auditado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredClaims.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-12 px-6 text-center text-txt-subtle space-y-2">
                        <Info className="w-8 h-8 mx-auto text-txt-subtle" />
                        <h4 className="font-bold text-sm">No se encontraron aclaraciones</h4>
                        <p className="text-xs">No hay reportes de omisión QR con los filtros seleccionados.</p>
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
  );
}
