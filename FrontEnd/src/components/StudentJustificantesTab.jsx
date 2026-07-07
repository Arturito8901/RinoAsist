import React, { useState, useEffect } from 'react';
import { 
  FileText, Calendar, Upload, Plus, AlertCircle, FileCheck, FileX, 
  Clock, Info, ChevronDown, ChevronUp, FileUp, HelpCircle, AlertTriangle
} from 'lucide-react';

export default function StudentJustificantesTab({ user, studentData }) {
  const [activeSubTab, setActiveSubTab] = useState('justificantes'); // 'justificantes' | 'aclaraciones'
  
  const [justifications, setJustifications] = useState([]);
  const [claims, setClaims] = useState([]);
  
  const [isJustFormOpen, setIsJustFormOpen] = useState(false);
  const [isClaimFormOpen, setIsClaimFormOpen] = useState(false);
  
  // Justificantes Form fields
  const [justReason, setJustReason] = useState('Médico');
  const [justStartDate, setJustStartDate] = useState('');
  const [justEndDate, setJustEndDate] = useState('');
  const [justNotes, setJustNotes] = useState('');
  const [justFileName, setJustFileName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [justFilePreview, setJustFilePreview] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadedFile = (file) => {
    setJustFileName(file.name);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setJustFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setJustFilePreview(null);
    }
  };
  
  // Aclaraciones Form fields
  const [claimCourseId, setClaimCourseId] = useState(
    studentData.myCourses && studentData.myCourses.length > 0 ? studentData.myCourses[0].id : ''
  );
  const [claimDate, setClaimDate] = useState('');
  const [claimReason, setClaimReason] = useState('Error de lector QR');
  const [claimNotes, setClaimNotes] = useState('');
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const studentId = user.id === 3 ? 'ST-001' : user.id.toString();

  // Load justifications and claims on mount
  useEffect(() => {
    loadJustifications();
    loadClaims();
  }, []);

  function loadJustifications() {
    const saved = localStorage.getItem('approved_justifications');
    if (saved) {
      const allJusts = JSON.parse(saved);
      const myJusts = allJusts.filter(j => 
        j.studentId === studentId || 
        j.studentName.toLowerCase() === user.name.toLowerCase()
      );
      setJustifications(myJusts);
    }
  }

  function loadClaims() {
    const saved = localStorage.getItem('attendance_claims');
    if (saved) {
      const allClaims = JSON.parse(saved);
      const myClaims = allClaims.filter(c => 
        c.studentId === studentId ||
        c.studentName.toLowerCase() === user.name.toLowerCase()
      );
      setClaims(myClaims);
    }
  }

  const handleJustSubmit = (e) => {
    e.preventDefault();
    
    if (!justStartDate || !justEndDate) {
      setErrorMessage('Por favor, completa todos los campos de fecha.');
      return;
    }

    if (new Date(justStartDate) > new Date(justEndDate)) {
      setErrorMessage('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    const saved = localStorage.getItem('approved_justifications');
    const allJusts = saved ? JSON.parse(saved) : [];

    const newJust = {
      id: `just-${Date.now()}`,
      studentId: studentId,
      studentName: user.name,
      reason: justReason,
      startDate: justStartDate,
      endDate: justEndDate,
      status: 'Pendiente',
      fileName: justFileName || 'justificante_adjunto.pdf',
      notes: justNotes.trim()
    };

    const updated = [newJust, ...allJusts];
    localStorage.setItem('approved_justifications', JSON.stringify(updated));
    
    // Clear form
    setJustStartDate('');
    setJustEndDate('');
    setJustNotes('');
    setJustFileName('');
    setJustFilePreview(null);
    setJustReason('Médico');
    
    setIsJustFormOpen(false);
    setErrorMessage('');
    setSuccessMessage('¡Solicitud de justificante enviada con éxito!');
    
    loadJustifications();
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleClaimSubmit = (e) => {
    e.preventDefault();

    if (!claimDate) {
      setErrorMessage('Por favor, selecciona la fecha de la inasistencia.');
      return;
    }

    const selectedCourse = studentData.myCourses?.find(c => c.id === claimCourseId);
    if (!selectedCourse) return;

    const savedClaims = localStorage.getItem('attendance_claims');
    const allClaims = savedClaims ? JSON.parse(savedClaims) : [];

    const newClaim = {
      id: `claim-${Date.now()}`,
      studentId: studentId,
      studentName: user.name,
      courseId: claimCourseId,
      courseName: selectedCourse.courseName,
      date: claimDate,
      reason: claimReason,
      notes: claimNotes.trim(),
      status: 'Pendiente',
      submittedAt: new Date().toISOString()
    };

    const updated = [newClaim, ...allClaims];
    localStorage.setItem('attendance_claims', JSON.stringify(updated));

    // Clear form
    setClaimDate('');
    setClaimNotes('');
    setClaimReason('Error de lector QR');

    setIsClaimFormOpen(false);
    setErrorMessage('');
    setSuccessMessage('¡Aclaración de asistencia enviada al profesor con éxito!');

    loadClaims();
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
    <div className="space-y-6 text-left animate-fadeIn">
      {/* Sub-tabs header */}
      <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4 theme-transition">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-xl">Centro de Trámites y Permisos</h3>
            <p className="text-xs text-txt-muted">Gestiona tus justificantes médicos y envía aclaraciones por inasistencias no registradas.</p>
          </div>

          <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 theme-transition">
            <button
              onClick={() => {
                setActiveSubTab('justificantes');
                setErrorMessage('');
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'justificantes'
                  ? 'bg-brand-primary text-white shadow-sm font-extrabold'
                  : 'text-txt-muted hover:text-brand-primary'
              }`}
            >
              Justificantes
            </button>
            <button
              onClick={() => {
                setActiveSubTab('aclaraciones');
                setErrorMessage('');
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'aclaraciones'
                  ? 'bg-brand-primary text-white shadow-sm font-extrabold'
                  : 'text-txt-muted hover:text-brand-primary'
              }`}
            >
              Aclaración de Faltas
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-450 p-3 rounded-xl text-xs font-bold text-center animate-fadeIn theme-transition">
            {successMessage}
          </div>
        )}
      </div>

      {/* VIEW: JUSTIFICANTES */}
      {activeSubTab === 'justificantes' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex justify-between items-center flex-wrap gap-4 theme-transition">
            <div className="text-xs text-txt-muted">
              Carga tu receta médica o pase oficial. Al ser aprobado por el administrador, las inasistencias en el rango de fechas serán omitidas.
            </div>
            <button
              onClick={() => setIsJustFormOpen(!isJustFormOpen)}
              className="py-2.5 px-4 bg-brand-primary hover:bg-brand-hover text-white font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-primary/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Justificante</span>
            </button>
          </div>

          {/* Form Justificantes */}
          {isJustFormOpen && (
            <form onSubmit={handleJustSubmit} className="border border-bdr-base bg-bg-surface p-6 rounded-2xl space-y-4 animate-slideDown theme-transition">
              <h4 className="font-bold text-sm text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                <FileUp className="w-4.5 h-4.5" />
                <span>Nueva Solicitud de Justificación</span>
              </h4>
              
              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-2.5 rounded-xl text-xs font-bold text-center">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Motivo de Falta *</label>
                  <select
                    value={justReason}
                    onChange={(e) => setJustReason(e.target.value)}
                    className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs font-semibold theme-transition cursor-pointer"
                  >
                    <option value="Médico">Médico (Salud / Receta)</option>
                    <option value="Académico">Académico / Evento Oficial</option>
                    <option value="Personal">Personal / Fuerza Mayor</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Comprobante / Documento Adjunto *</label>
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 relative flex flex-col items-center justify-center min-h-[140px] theme-transition ${
                      dragActive 
                        ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]' 
                        : justFileName
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-bdr-base bg-bg-card hover:border-brand-primary/50'
                    }`}
                  >
                    <input
                      type="file"
                      id="student-excuse-file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handleUploadedFile(file);
                      }}
                    />
                    
                    {!justFileName ? (
                      <div className="space-y-2 pointer-events-none">
                        <div className="mx-auto w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                          <Upload className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="text-xs">
                          <span className="font-bold text-brand-primary hover:underline">Haz clic para subir</span> o arrastra tu archivo aquí
                        </div>
                        <p className="text-[10px] text-txt-subtle font-medium">Formatos soportados: PDF, PNG, JPG (Máx. 5MB)</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 w-full z-20">
                        {justFilePreview ? (
                          <div className="relative group/preview w-20 h-20 rounded-xl overflow-hidden border border-emerald-500/20 shadow-md">
                            <img src={justFilePreview} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                              <span className="text-[10px] text-white font-bold">Vista previa</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}
                        
                        <div className="space-y-0.5 text-center">
                          <span className="text-xs font-bold text-txt-base block truncate max-w-[240px]">{justFileName}</span>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-450 font-extrabold uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Listo para enviar</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setJustFileName('');
                            setJustFilePreview(null);
                            document.getElementById('student-excuse-file').value = '';
                          }}
                          className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/25 font-bold py-1 px-3.5 rounded-xl cursor-pointer transition-colors"
                        >
                          Remover archivo
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Fecha de Inicio *</label>
                  <input
                    type="date"
                    required
                    value={justStartDate}
                    onChange={(e) => setJustStartDate(e.target.value)}
                    className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Fecha de Fin *</label>
                  <input
                    type="date"
                    required
                    value={justEndDate}
                    onChange={(e) => setJustEndDate(e.target.value)}
                    className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Explicación del Motivo</label>
                <textarea
                  rows={2}
                  value={justNotes}
                  onChange={(e) => setJustNotes(e.target.value)}
                  placeholder="Añade detalles adicionales (ej. Cita con odontólogo, reposo IMSS)..."
                  className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsJustFormOpen(false);
                    setErrorMessage('');
                    setJustFileName('');
                    setJustFilePreview(null);
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

          {/* Justifications Table */}
          <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                    <th className="py-4 px-6 w-32">Motivo</th>
                    <th className="py-4 px-6">Período</th>
                    <th className="py-4 px-6">Detalles / Diagnóstico</th>
                    <th className="py-4 px-6">Documento</th>
                    <th className="py-4 px-6">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-subtle/50 theme-transition">
                  {justifications.map((just) => (
                    <tr key={just.id} className="hover:bg-bg-surface/10 transition-colors">
                      <td className="py-4 px-6">
                        <span className={`text-xs font-bold ${
                          just.reason === 'Médico' ? 'text-blue-500' : just.reason === 'Académico' ? 'text-indigo-500' : 'text-purple-550'
                        }`}>
                          {just.reason}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-txt-muted font-semibold">{just.startDate} al {just.endDate}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-txt-base font-medium">{just.notes || 'Sin observaciones'}</span>
                      </td>
                      <td className="py-4 px-6 font-mono text-[11px] text-txt-subtle">
                        {just.fileName}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(just.status)}
                      </td>
                    </tr>
                  ))}

                  {justifications.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-12 px-6 text-center text-txt-subtle space-y-2">
                        <Info className="w-8 h-8 mx-auto text-txt-subtle opacity-50" />
                        <h4 className="font-bold text-sm">Sin solicitudes de justificante</h4>
                        <p className="text-xs">No has enviado ningún justificante de asistencia en este ciclo escolar.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: ACLARACIONES */}
      {activeSubTab === 'aclaraciones' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm flex justify-between items-center flex-wrap gap-4 theme-transition">
            <div className="text-xs text-txt-muted col-span-3">
              ¿Estuviste en el salón pero olvidaste escanear el QR, o falló el lector? Envía una aclaración de asistencia al profesor para su revisión.
            </div>
            <button
              onClick={() => setIsClaimFormOpen(!isClaimFormOpen)}
              className="py-2.5 px-4 bg-brand-primary hover:bg-brand-hover text-white font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-primary/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Reportar Omisión QR</span>
            </button>
          </div>

          {/* Form Aclaraciones */}
          {isClaimFormOpen && (
            <form onSubmit={handleClaimSubmit} className="border border-bdr-base bg-bg-surface p-6 rounded-2xl space-y-4 animate-slideDown theme-transition">
              <h4 className="font-bold text-sm text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4.5 h-4.5" />
                <span>Reportar Omisión o Error de Lector QR</span>
              </h4>
              
              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 p-2.5 rounded-xl text-xs font-bold text-center">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Asignatura *</label>
                  <select
                    value={claimCourseId}
                    onChange={(e) => setClaimCourseId(e.target.value)}
                    className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs font-semibold theme-transition cursor-pointer"
                  >
                    {studentData.myCourses?.map(c => (
                      <option key={c.id} value={c.id}>{c.courseName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Tipo de Aclaración *</label>
                  <select
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs font-semibold theme-transition cursor-pointer"
                  >
                    <option value="Error de lector QR">Falla/Error en el lector QR del docente</option>
                    <option value="Olvido de escaneo">Olvido involuntario de escanear código</option>
                    <option value="Llegada tardía">Llegada después de la tolerancia (Retardo)</option>
                    <option value="Sin internet móvil">Falta de datos móviles/internet en el aula</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Fecha de la Clase *</label>
                  <input
                    type="date"
                    required
                    value={claimDate}
                    onChange={(e) => setClaimDate(e.target.value)}
                    className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">Explicación para el Profesor *</label>
                <textarea
                  rows={2}
                  required
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="Por favor, describe detalladamente la situación (ej. Estuve sentado en la fila 3, respondí a la lista manual pero no registré QR)..."
                  className="w-full bg-bg-card border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-xs theme-transition resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsClaimFormOpen(false);
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
                  Enviar Aclaración
                </button>
              </div>
            </form>
          )}

          {/* Claims Table */}
          <div className="bg-bg-card border border-bdr-base rounded-2xl overflow-hidden shadow-xl theme-transition">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-surface text-txt-muted text-[10px] font-bold uppercase tracking-wider border-b border-bdr-base theme-transition">
                    <th className="py-4 px-6 w-44">Materia</th>
                    <th className="py-4 px-6 w-32">Fecha Clase</th>
                    <th className="py-4 px-6">Tipo / Motivo</th>
                    <th className="py-4 px-6">Detalles del Alumno</th>
                    <th className="py-4 px-6">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-subtle/50 theme-transition">
                  {claims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-bg-surface/10 transition-colors">
                      <td className="py-4 px-6">
                        <span className="text-xs font-bold text-txt-base">{claim.courseName}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-txt-muted font-semibold">{claim.date}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs text-brand-primary font-bold">{claim.reason}</span>
                      </td>
                      <td className="py-4 px-6 text-xs text-txt-muted">
                        {claim.notes}
                      </td>
                      <td className="py-4 px-6">
                        {getStatusBadge(claim.status)}
                      </td>
                    </tr>
                  ))}

                  {claims.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-12 px-6 text-center text-txt-subtle space-y-2">
                        <Info className="w-8 h-8 mx-auto text-txt-subtle opacity-50" />
                        <h4 className="font-bold text-sm">Sin reportes de omisión</h4>
                        <p className="text-xs">No has enviado ninguna reclamación de firmas de asistencia.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
