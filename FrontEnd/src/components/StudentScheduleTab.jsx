import React from 'react';
import { Calendar, Clock, BookOpen, User, CheckCircle2, AlertCircle, HelpCircle, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StudentScheduleTab({ studentData }) {
  const navigate = useNavigate();
  // Days of the week
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  // Static list of class schedules with associated group IDs
  // (In a real app, this would be fetched from the backend, but we tie it to the courses list)
  const scheduleSlots = [
    {
      day: 'Lunes',
      courseId: '101',
      courseName: 'Programación Web',
      time: '08:00 - 10:00',
      key: 'PROG-WEB-A',
      room: 'Laboratorio de Cómputo L4'
    },
    {
      day: 'Martes',
      courseId: '102',
      courseName: 'Bases de Datos II',
      time: '10:00 - 12:00',
      key: 'BD2-B',
      room: 'Aula 204'
    },
    {
      day: 'Miércoles',
      courseId: '101',
      courseName: 'Programación Web',
      time: '08:00 - 10:00',
      key: 'PROG-WEB-A',
      room: 'Laboratorio de Cómputo L4'
    },
    {
      day: 'Jueves',
      courseId: '102',
      courseName: 'Bases de Datos II',
      time: '10:00 - 12:00',
      key: 'BD2-B',
      room: 'Aula 204'
    },
    {
      day: 'Viernes',
      courseId: '103',
      courseName: 'Desarrollo de Aplicaciones Móviles',
      time: '07:00 - 11:00',
      key: 'APP-MOV-C',
      room: 'Laboratorio de Cómputo L5'
    }
  ];

  // Helper to determine if a class is active right now (with weekend simulation for testing)
  const isSlotActive = (slot) => {
    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const currentHour = now.getHours();

    const dayMap = {
      'Lunes': 1,
      'Martes': 2,
      'Miércoles': 3,
      'Jueves': 4,
      'Viernes': 5
    };

    const targetDayIndex = dayMap[slot.day];

    let activeDayIndex = currentDayIndex;
    let activeHour = currentHour;
    
    // Simulate Monday 9:00 AM if testing on a weekend
    if (currentDayIndex === 0 || currentDayIndex === 6) {
      activeDayIndex = 1;
      activeHour = 9;
    }

    if (activeDayIndex !== targetDayIndex) return false;

    const [startStr, endStr] = slot.time.split(' - ');
    const startHour = parseInt(startStr.split(':')[0]);
    const endHour = parseInt(endStr.split(':')[0]);

    return activeHour >= startHour && activeHour < endHour;
  };

  // Helper to find student's attendance rate for a course
  const getCourseInfo = (courseId) => {
    return studentData.myCourses?.find(c => c.id === courseId) || {
      attendanceRate: 100,
      teacherName: 'Docente Asignado'
    };
  };

  // Helper to determine status icon and class
  const getStatusColor = (rate) => {
    if (rate >= 90) return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-450';
    if (rate >= 80) return 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-450';
    return 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition">
        <h3 className="text-lg font-bold">Mi Agenda Escolar</h3>
        <p className="text-txt-muted text-xs mt-0.5">Consulta tu horario de clases semanal de Ingeniería en Sistemas Computacionales y tu rendimiento en cada asignatura.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {days.map((dayName) => {
          // Find slots for this day
          const daySlots = scheduleSlots.filter(s => s.day === dayName);

          return (
            <div key={dayName} className="bg-bg-card border border-bdr-base rounded-2xl p-4 flex flex-col justify-between min-h-[350px] shadow-sm theme-transition">
              <div className="space-y-4 flex-1">
                <div className="border-b border-bdr-base pb-2 text-center">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-txt-muted">{dayName}</span>
                </div>

                <div className="space-y-3 flex-1 flex flex-col justify-start">
                  {daySlots.length > 0 ? (
                    daySlots.map((slot, idx) => {
                      const isActive = isSlotActive(slot);
                      const courseInfo = getCourseInfo(slot.courseId);
                      const statusClass = isActive 
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-500/5'
                        : getStatusColor(courseInfo.attendanceRate);

                      return (
                        <div
                          key={`${slot.courseId}-${idx}`}
                          className={`p-3.5 border rounded-xl flex flex-col justify-between gap-3 theme-transition relative transition-all duration-300 ${statusClass}`}
                        >
                          {isActive && (
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-emerald-500 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                              En Curso
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="text-xs font-extrabold leading-tight text-txt-base block">
                              {slot.courseName}
                            </span>
                            <span className="inline-block text-[9px] font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.2 rounded border border-brand-primary/15">
                              {slot.key}
                            </span>
                          </div>

                          <div className="space-y-1 border-t border-bdr-base/10 pt-2 text-[10px]">
                            <div className="flex items-center gap-1.5 text-txt-muted">
                              <Clock className="w-3 h-3 text-txt-subtle" />
                              <span className={isActive ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}>{slot.time}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-txt-muted">
                              <BookOpen className="w-3 h-3 text-txt-subtle" />
                              <span className="truncate max-w-[130px]">{slot.room}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-txt-muted">
                              <User className="w-3 h-3 text-txt-subtle" />
                              <span className="truncate max-w-[130px] font-semibold">{courseInfo.teacherName}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-bg-surface/50 border border-bdr-base/20 rounded-lg px-2 py-1 text-[10px]">
                            <span className="text-txt-subtle font-semibold">Mi Asistencia:</span>
                            <span className={`font-extrabold ${
                              courseInfo.attendanceRate < 80 ? 'text-rose-500' : 'text-emerald-500'
                            }`}>
                              {courseInfo.attendanceRate}%
                            </span>
                          </div>

                          {isActive && (
                            <button
                              onClick={() => navigate('/scan')}
                              className="w-full mt-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-[10px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer transition-all uppercase tracking-wide"
                            >
                              <QrCode className="w-3.5 h-3.5 animate-pulse" />
                              <span>Escanear Asistencia</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-bdr-base/50 rounded-xl py-12 text-center text-txt-subtle italic">
                      <Calendar className="w-6 h-6 text-txt-subtle opacity-40 mb-1" />
                      <span className="text-[10px] font-semibold">Sin clases agendadas</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timetable legend */}
      <div className="bg-bg-card border border-bdr-base p-4 rounded-xl flex flex-wrap gap-6 items-center text-xs justify-center md:justify-start theme-transition text-txt-muted">
        <span className="font-bold uppercase tracking-wider text-[10px] text-txt-subtle">Simbología del Horario:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Excelente (&gt;= 90%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Precaución (80% - 89%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Riesgo de Reprobar (&lt; 80%)</span>
        </div>
      </div>
    </div>
  );
}
