import React, { useState } from 'react';
import { BookOpen, Calculator, AlertTriangle, CheckCircle, Info, RefreshCw } from 'lucide-react';

export default function StudentCalculatorTab({ studentData }) {
  const [selectedCourseId, setSelectedCourseId] = useState(
    studentData.myCourses && studentData.myCourses.length > 0 ? studentData.myCourses[0].id : ''
  );
  const [futureAbsences, setFutureAbsences] = useState(0);

  // Find course details
  const selectedCourse = studentData.myCourses?.find(c => c.id === selectedCourseId);

  // Simulation calculations
  // We assume:
  // - A semester has 30 classes per subject.
  // - 15 classes have already taken place (current rate represents this).
  // - 15 classes are remaining in the future.
  const totalClassesPassed = 15;
  const totalClassesFuture = 15;
  const semesterTotalClasses = totalClassesPassed + totalClassesFuture;

  const currentRate = selectedCourse ? selectedCourse.attendanceRate : 100;
  const currentAttended = Math.round((totalClassesPassed * currentRate) / 100);
  const currentAbsent = totalClassesPassed - currentAttended;

  // Simulated results
  const simulatedAttended = Math.max(0, currentAttended + (totalClassesFuture - futureAbsences));
  const simulatedRate = Math.round((simulatedAttended / semesterTotalClasses) * 100);
  const simulatedAbsent = currentAbsent + futureAbsences;

  const getVerdict = (rate) => {
    if (rate >= 85) {
      return {
        label: 'A salvo (Sin Riesgo)',
        color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
        desc: 'Tu porcentaje de asistencia proyectado es óptimo. Cumples con el reglamento escolar de Ingeniería.'
      };
    }
    if (rate >= 80) {
      return {
        label: 'Límite (Precaución)',
        color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        icon: <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />,
        desc: 'Estás muy cerca de perder el derecho de evaluación. Evita faltar en las siguientes clases.'
      };
    }
    return {
      label: 'Sin Derecho a Examen (Peligro)',
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      icon: <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />,
      desc: '¡Cuidado! Tu porcentaje de asistencia proyectado es inferior al 80% mínimo requerido para examen ordinario.'
    };
  };

  const verdict = getVerdict(simulatedRate);

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      {/* Header */}
      <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition">
        <h3 className="text-lg font-bold">Simulador de Asistencias (Proyección Semestral)</h3>
        <p className="text-txt-muted text-xs mt-0.5">Calcula el impacto de faltas proyectadas sobre tu calificación final y asegura tu derecho a examen.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Control Card (2 cols) */}
        <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm lg:col-span-2 space-y-6 theme-transition">
          <div className="space-y-2">
            <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">Seleccionar Asignatura para Simular</label>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setFutureAbsences(0); // Reset simulation
              }}
              className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-4 py-2.5 outline-none text-sm font-semibold cursor-pointer theme-transition"
            >
              {studentData.myCourses?.map(c => (
                <option key={c.id} value={c.id}>{c.courseName} - {c.teacherName}</option>
              ))}
            </select>
          </div>

          {selectedCourse && (
            <>
              {/* Current Metrics summary */}
              <div className="grid grid-cols-3 gap-4 bg-bg-surface/50 border border-bdr-base/50 p-4 rounded-xl text-center theme-transition">
                <div>
                  <span className="text-[10px] text-txt-subtle uppercase block font-semibold">Tasa Actual</span>
                  <span className={`text-lg font-black block mt-0.5 ${currentRate < 80 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {currentRate}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-txt-subtle uppercase block font-semibold">Firmas de Asistió</span>
                  <span className="text-lg font-extrabold text-txt-base block mt-0.5">
                    {currentAttended} / {totalClassesPassed}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-txt-subtle uppercase block font-semibold">Faltas Reales</span>
                  <span className="text-lg font-extrabold text-rose-500 block mt-0.5">
                    {currentAbsent}
                  </span>
                </div>
              </div>

              {/* Absences Simulator slider */}
              <div className="space-y-4 pt-4 border-t border-bdr-base/40">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-txt-base uppercase tracking-wider">Simular Faltas Futuras</span>
                  <span className="bg-rose-500/10 text-rose-600 px-3 py-1 rounded-full text-xs font-black">
                    +{futureAbsences} inasistencias
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max={totalClassesFuture}
                    value={futureAbsences}
                    onChange={(e) => setFutureAbsences(Number(e.target.value))}
                    className="w-full accent-brand-primary h-2 bg-bg-surface rounded-lg appearance-none cursor-pointer border border-bdr-base"
                  />
                  <div className="flex justify-between text-[10px] text-txt-subtle font-semibold">
                    <span>0 faltas más (Asistencia Perfecta Futura)</span>
                    <span>{totalClassesFuture} faltas más (Faltar todo el mes)</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Projection Card (1 col) */}
        {selectedCourse && (
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-6 theme-transition flex flex-col justify-between">
            <div className="space-y-4 text-center">
              <span className="text-[10px] text-txt-subtle uppercase font-extrabold tracking-wider block">Porcentaje Proyectado al Final de Semestre</span>
              
              <div className="w-28 h-28 relative mx-auto flex items-center justify-center group/ring">
                {/* Outer pulsing blur ring on hover */}
                <div className={`absolute inset-2 rounded-full blur-md opacity-5 transition-opacity duration-300 group-hover/ring:opacity-20 ${
                  simulatedRate < 80 ? 'bg-rose-500' : simulatedRate < 85 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}></div>
                
                <svg className="w-full h-full transform -rotate-90">
                  {/* Track Circle */}
                  <circle 
                    cx="56" 
                    cy="56" 
                    r="48" 
                    className="text-bg-surface dark:text-bg-surface/30" 
                    stroke="currentColor"
                    strokeWidth="5.5" 
                    fill="transparent" 
                  />
                  {/* Glowing Progress Circle */}
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    stroke={simulatedRate < 80 ? "#ef4444" : simulatedRate < 85 ? "#d97706" : "#10b981"}
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={(2 * Math.PI * 48) * (1 - simulatedRate / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                    style={{
                      filter: `drop-shadow(0 0 3px ${simulatedRate < 80 ? 'rgba(239,68,68,0.4)' : simulatedRate < 85 ? 'rgba(217,119,6,0.4)' : 'rgba(16,185,129,0.4)'})`
                    }}
                  />
                </svg>
                <div className="absolute text-center flex flex-col items-center justify-center">
                  <span className={`text-2xl font-black leading-none tracking-tight ${simulatedRate < 80 ? 'text-rose-500 animate-pulse' : 'text-txt-base'}`}>{simulatedRate}%</span>
                  <span className="text-[7px] text-txt-subtle font-extrabold uppercase tracking-widest mt-1">Tasa Final</span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-bold text-txt-muted uppercase tracking-widest">Estado Proyectado</h4>
                <div className={`border px-3 py-1.5 rounded-xl font-black text-xs inline-block capitalize ${verdict.color}`}>
                  {verdict.label}
                </div>
              </div>
            </div>

            <div className="bg-bg-surface border border-bdr-base/40 p-4 rounded-xl space-y-3 theme-transition">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-txt-muted">Clases Totales:</span>
                <span className="font-bold text-txt-base">{semesterTotalClasses}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-txt-muted">Clases Asistidas Proyectadas:</span>
                <span className="font-bold text-emerald-500">{simulatedAttended}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-txt-muted">Faltas Totales Proyectadas:</span>
                <span className="font-bold text-rose-500">{simulatedAbsent}</span>
              </div>
            </div>

            <p className="text-[10px] text-txt-subtle leading-normal">
              <strong>Nota:</strong> Esta simulación asume un total de 30 clases por semestre. Las inasistencias acumuladas incluyen faltas reales e inasistencias futuras proyectadas.
            </p>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-bg-card border border-bdr-base p-4 rounded-2xl flex items-start gap-3.5 shadow-sm theme-transition text-xs text-txt-muted leading-relaxed">
        <Info className="w-5 h-5 text-brand-primary shrink-0" />
        <p>
          De acuerdo con el Reglamento de Alumnos de la institución, para conservar el derecho a presentar examen de evaluación ordinaria en cualquier asignatura, debes registrar una asistencia mínima del **80%**. Si tu promedio simulado desciende de este límite, el sistema te catalogará en estatus de **Sin Derecho**.
        </p>
      </div>
    </div>
  );
}
