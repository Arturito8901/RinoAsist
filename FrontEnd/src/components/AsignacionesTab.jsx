import React, { useState, useMemo, useEffect } from 'react';
import { 
  BookOpen, CalendarRange, Clock, CheckCircle2, ShieldAlert, 
  Trash2, Edit, RefreshCw, Lock, FileSpreadsheet, Search,
  Users, AlertTriangle, Layers, ChevronRight, X, Plus, BookMarked,
  Award, Check, Library, RotateCcw, Archive
} from 'lucide-react';
import { api } from '../services/api';

const DAYS_OF_WEEK = [
  { key: 'Lunes', abbrev: 'Lu', label: 'Lunes', colIndex: 2 },
  { key: 'Martes', abbrev: 'Ma', label: 'Martes', colIndex: 3 },
  { key: 'Miércoles', abbrev: 'Mi', label: 'Miércoles', colIndex: 4 },
  { key: 'Jueves', abbrev: 'Ju', label: 'Jueves', colIndex: 5 },
  { key: 'Viernes', abbrev: 'Vi', label: 'Viernes', colIndex: 6 }
];

// Color palette for distinct subjects in calendar
const SUBJECT_COLORS = [
  'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300',
  'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300',
  'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300',
  'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-cyan-300',
  'bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300',
  'bg-teal-500/15 border-teal-500/40 text-teal-700 dark:text-teal-300'
];

export default function AsignacionesTab({
  assignmentOptions,
  onRefreshOptions,
  isPastCycle = false,
  onOpenImportModal
}) {
  // Sub-tabs: 'horarios' | 'catalogo'
  const [subTab, setSubTab] = useState('horarios');

  // Form Filters & Selectors
  const [assignGroupSemesterFilter, setAssignGroupSemesterFilter] = useState('all');
  const [assignGroupShiftFilter, setAssignGroupShiftFilter] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedMateriaId, setSelectedMateriaId] = useState('');
  const [selectedDocenteId, setSelectedDocenteId] = useState('');
  
  // Interactive Day/Slot selector for form
  const [activeScheduleDay, setActiveScheduleDay] = useState('Lu');
  const [selectedScheduleSlots, setSelectedScheduleSlots] = useState([]);
  const [scheduleString, setScheduleString] = useState('');

  // Form states
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Table filters
  const [tableSemesterFilter, setTableSemesterFilter] = useState('all');
  const [tableGroupFilter, setTableGroupFilter] = useState('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Edit Assignment Modal
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editDocenteId, setEditDocenteId] = useState('');
  const [editScheduleString, setEditScheduleString] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Assignment Modal
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // -------------------------------------------------------------
  // CATÁLOGO DE MATERIAS (CRUD) STATE
  // -------------------------------------------------------------
  const [materiasList, setMateriasList] = useState([]);
  const [loadingMaterias, setLoadingMaterias] = useState(false);
  const [materiaSearchQuery, setMateriaSearchQuery] = useState('');
  const [materiaCreditFilter, setMateriaCreditFilter] = useState('all');
  const [materiaStatusFilter, setMateriaStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [reactivatingMateriaId, setReactivatingMateriaId] = useState(null);

  // Modal Crear / Editar Materia
  const [materiaModal, setMateriaModal] = useState({
    isOpen: false,
    mode: 'create', // 'create' | 'edit'
    id: null,
    clave: '',
    nombre: '',
    creditos: 5
  });
  const [savingMateria, setSavingMateria] = useState(false);
  const [materiaModalError, setMateriaModalError] = useState('');

  // Modal Eliminar Materia
  const [materiaToDelete, setMateriaToDelete] = useState(null);
  const [deletingMateria, setDeletingMateria] = useState(false);
  const [deleteMateriaError, setDeleteMateriaError] = useState('');

  const fetchMaterias = async () => {
    setLoadingMaterias(true);
    try {
      const data = await api.getMaterias();
      setMateriasList(data || []);
    } catch (err) {
      console.error('Error fetching materias:', err);
    } finally {
      setLoadingMaterias(false);
    }
  };

  useEffect(() => {
    fetchMaterias();
  }, []);

  // Helper parser for schedule strings (e.g., "Lu 07-09, Mi 07-09")
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
        const hours = tp.split('-').map(h => parseInt(h, 10));
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
    const pad = (n) => String(n).padStart(2, '0');
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
          blocks.push(`${pad(start)}-${pad(prev + 1)}`);
          start = hours[i];
          prev = hours[i];
        }
      }
      blocks.push(`${pad(start)}-${pad(prev + 1)}`);
      formattedSegments.push(`${day} ${blocks.join('/')}`);
    });
    return formattedSegments.join(', ');
  };

  const parseScheduleBlocks = (scheduleStr) => {
    if (!scheduleStr || scheduleStr === 'Sin horario') return [];
    const blocks = [];
    const segments = scheduleStr.split(',').map(s => s.trim());
    segments.forEach(seg => {
      const spaceIndex = seg.indexOf(' ');
      if (spaceIndex === -1) return;
      const dayAbbrev = seg.substring(0, spaceIndex).trim();
      
      let day = 'Lunes';
      if (/^lu/i.test(dayAbbrev)) day = 'Lunes';
      else if (/^ma/i.test(dayAbbrev)) day = 'Martes';
      else if (/^mi/i.test(dayAbbrev)) day = 'Miércoles';
      else if (/^ju/i.test(dayAbbrev)) day = 'Jueves';
      else if (/^vi/i.test(dayAbbrev)) day = 'Viernes';
      else return;
      
      const timeParts = seg.substring(spaceIndex + 1).split('/');
      timeParts.forEach(tp => {
        const hours = tp.split('-').map(h => parseInt(h, 10));
        if (hours.length === 2 && !isNaN(hours[0]) && !isNaN(hours[1])) {
          const startHour = hours[0];
          const endHour = hours[1];
          blocks.push({
            day,
            dayAbbrev,
            startHour,
            endHour,
            duration: endHour - startHour
          });
        }
      });
    });
    return blocks;
  };

  // Keep schedule string in sync with selected slots
  useEffect(() => {
    setScheduleString(formatHorario(selectedScheduleSlots));
  }, [selectedScheduleSlots]);

  // Clear selected slots when group or teacher changes
  useEffect(() => {
    setSelectedScheduleSlots([]);
  }, [selectedGroupId, selectedDocenteId]);

  // Filtered groups for the assignment form dropdown
  const filteredGroupsForAssign = useMemo(() => {
    if (!assignmentOptions?.grupos) return [];
    return assignmentOptions.grupos.filter(g => {
      if (g.clave === '*') return false;
      const matchSemester = assignGroupSemesterFilter === 'all' || String(g.semestre) === String(assignGroupSemesterFilter);
      const matchShift = assignGroupShiftFilter === 'all' || g.turno === assignGroupShiftFilter;
      return matchSemester && matchShift;
    });
  }, [assignmentOptions?.grupos, assignGroupSemesterFilter, assignGroupShiftFilter]);

  // Selected group object
  const selectedGroupObj = useMemo(() => {
    if (!selectedGroupId || !assignmentOptions?.grupos) return null;
    return assignmentOptions.grupos.find(g => String(g.id) === String(selectedGroupId));
  }, [selectedGroupId, assignmentOptions?.grupos]);

  // Turno & hours for grid
  const selectedGroupTurno = selectedGroupObj?.turno || null;
  const hoursToShow = useMemo(() => {
    if (selectedGroupTurno === 'Matutino') {
      return Array.from({ length: 8 }, (_, i) => i + 7); // 7 to 14
    } else if (selectedGroupTurno === 'Vespertino') {
      return Array.from({ length: 8 }, (_, i) => i + 13); // 13 to 20
    }
    return Array.from({ length: 14 }, (_, i) => i + 7); // 7 to 20
  }, [selectedGroupTurno]);

  // Assignments belonging strictly to the selected group
  const groupAssignments = useMemo(() => {
    if (!selectedGroupId || !assignmentOptions?.asignaciones) return [];
    return assignmentOptions.asignaciones.filter(asg => String(asg.grupo_id) === String(selectedGroupId));
  }, [assignmentOptions?.asignaciones, selectedGroupId]);

  // Group Academic Load Metrics
  const groupMetrics = useMemo(() => {
    if (!selectedGroupObj) return null;
    let totalWeeklyHours = 0;
    groupAssignments.forEach(asg => {
      const blocks = parseScheduleBlocks(asg.horario);
      blocks.forEach(b => {
        totalWeeklyHours += b.duration;
      });
    });
    return {
      subjectsCount: groupAssignments.length,
      totalHours: totalWeeklyHours,
      clave: selectedGroupObj.clave,
      semestre: selectedGroupObj.semestre,
      turno: selectedGroupObj.turno,
      cupo: selectedGroupObj.cupo || 30
    };
  }, [selectedGroupObj, groupAssignments]);

  // Color mapping for subjects in current group
  const subjectColorMap = useMemo(() => {
    const map = {};
    groupAssignments.forEach((asg, index) => {
      map[asg.materia_id] = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
    });
    return map;
  }, [groupAssignments]);

  // Flattened blocks for rendering in the calendar
  const groupCalendarBlocks = useMemo(() => {
    const blocks = [];
    groupAssignments.forEach(asg => {
      const parsed = parseScheduleBlocks(asg.horario);
      parsed.forEach((b, idx) => {
        blocks.push({
          ...b,
          blockId: `${asg.id}-${b.day}-${b.startHour}-${idx}`,
          assignmentId: asg.id,
          materiaId: asg.materia_id,
          materiaNombre: asg.materia_nombre,
          materiaClave: asg.materia_clave,
          docenteNombre: asg.docente_nombre,
          docenteId: asg.docente_id,
          horarioRaw: asg.horario
        });
      });
    });
    return blocks;
  }, [groupAssignments]);

  // Conflict slots for new assignment
  const conflictSlots = useMemo(() => {
    const slots = [];
    const assignments = assignmentOptions?.asignaciones || [];
    assignments.forEach(asg => {
      const isGroupConflict = selectedGroupId && String(asg.grupo_id) === String(selectedGroupId);
      const isTeacherConflict = selectedDocenteId && String(asg.docente_id) === String(selectedDocenteId);
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
  }, [assignmentOptions?.asignaciones, selectedGroupId, selectedDocenteId]);

  // Toggle hour slot
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

  // Submit new assignment
  const handleSaveGroupAssignment = async (e) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedMateriaId || !selectedDocenteId || !scheduleString) {
      setFormError('Por favor completa todos los campos y selecciona al menos una hora.');
      return;
    }

    setSaving(true);
    setFormError('');
    setFormSuccess('');

    try {
      await api.createAssignment({
        docenteId: parseInt(selectedDocenteId, 10),
        materiaId: parseInt(selectedMateriaId, 10),
        grupoId: parseInt(selectedGroupId, 10),
        docente_id: parseInt(selectedDocenteId, 10),
        materia_id: parseInt(selectedMateriaId, 10),
        grupo_id: parseInt(selectedGroupId, 10),
        horario: scheduleString
      });

      setFormSuccess('¡Materia y horario asignados con éxito!');
      setSelectedMateriaId('');
      setSelectedScheduleSlots([]);
      setScheduleString('');

      if (onRefreshOptions) {
        await onRefreshOptions();
      }
      fetchMaterias();

      setTimeout(() => setFormSuccess(''), 4000);
    } catch (err) {
      console.error('Error al guardar asignación:', err);
      setFormError(err.message || 'Error al guardar la asignación.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered assignments for the main table
  const filteredAssignments = useMemo(() => {
    let list = assignmentOptions?.asignaciones || [];
    if (tableSemesterFilter !== 'all') {
      list = list.filter(a => String(a.semestre) === String(tableSemesterFilter));
    }
    if (tableGroupFilter !== 'all') {
      list = list.filter(a => String(a.grupo_id) === String(tableGroupFilter));
    }
    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.toLowerCase();
      list = list.filter(a => 
        (a.materia_nombre && a.materia_nombre.toLowerCase().includes(q)) ||
        (a.materia_clave && a.materia_clave.toLowerCase().includes(q)) ||
        (a.docente_nombre && a.docente_nombre.toLowerCase().includes(q)) ||
        (a.grupo_clave && a.grupo_clave.toLowerCase().includes(q))
      );
    }
    return list;
  }, [assignmentOptions?.asignaciones, tableSemesterFilter, tableGroupFilter, tableSearchQuery]);

  // Group options for table filter
  const tableGroupOptions = useMemo(() => {
    if (!assignmentOptions?.grupos) return [];
    return assignmentOptions.grupos.filter(g => {
      if (g.clave === '*') return false;
      return tableSemesterFilter === 'all' ? true : String(g.semestre) === String(tableSemesterFilter);
    });
  }, [assignmentOptions?.grupos, tableSemesterFilter]);

  // Open Edit Assignment Modal
  const handleOpenEdit = (asg) => {
    setEditingAssignment(asg);
    setEditDocenteId(asg.docente_id ? String(asg.docente_id) : '');
    setEditScheduleString(asg.horario || '');
    setEditError('');
  };

  // Save Edit Assignment
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingAssignment) return;
    setSavingEdit(true);
    setEditError('');

    try {
      await api.updateAssignment(editingAssignment.id, {
        docente_id: editDocenteId,
        horario: editScheduleString
      });

      setEditingAssignment(null);
      if (onRefreshOptions) {
        await onRefreshOptions();
      }
      fetchMaterias();
    } catch (err) {
      console.error('Error updating assignment:', err);
      setEditError(err.message || 'No se pudo actualizar la asignación.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Assignment
  const handleConfirmDelete = async () => {
    if (!assignmentToDelete) return;
    setDeleting(true);
    try {
      await api.deleteAssignment(assignmentToDelete.id);
      setAssignmentToDelete(null);
      if (onRefreshOptions) {
        await onRefreshOptions();
      }
      fetchMaterias();
    } catch (err) {
      console.error('Error deleting assignment:', err);
      alert(err.message || 'Error al eliminar la asignación.');
    } finally {
      setDeleting(false);
    }
  };

  // -------------------------------------------------------------
  // MATERIAS CRUD HANDLERS
  // -------------------------------------------------------------
  const filteredMaterias = useMemo(() => {
    let list = materiasList;
    if (materiaStatusFilter === 'active') {
      list = list.filter(m => m.activo !== false);
    } else if (materiaStatusFilter === 'inactive') {
      list = list.filter(m => m.activo === false);
    }
    if (materiaCreditFilter !== 'all') {
      list = list.filter(m => String(m.creditos) === String(materiaCreditFilter));
    }
    if (materiaSearchQuery.trim()) {
      const q = materiaSearchQuery.toLowerCase();
      list = list.filter(m => 
        (m.nombre && m.nombre.toLowerCase().includes(q)) ||
        (m.clave && m.clave.toLowerCase().includes(q))
      );
    }
    return list;
  }, [materiasList, materiaStatusFilter, materiaCreditFilter, materiaSearchQuery]);

  const materiasStats = useMemo(() => {
    const total = materiasList.length;
    const activeCount = materiasList.filter(m => m.activo !== false).length;
    const inactiveCount = materiasList.filter(m => m.activo === false).length;
    const withClassesCurrentCycle = materiasList.filter(m => (m.asignaciones_count || 0) > 0).length;
    const unassignedCurrentCycle = materiasList.filter(m => m.activo !== false && (m.asignaciones_count || 0) === 0).length;
    return { 
      total, 
      activeCount, 
      inactiveCount, 
      withClassesCurrentCycle, 
      unassignedCurrentCycle 
    };
  }, [materiasList]);

  const handleReactivateMateria = async (materia) => {
    setReactivatingMateriaId(materia.materia_id);
    try {
      await api.reactivateMateria(materia.materia_id);
      await fetchMaterias();
      if (onRefreshOptions) {
        await onRefreshOptions();
      }
    } catch (err) {
      console.error('Error reactivating materia:', err);
      alert(err.message || 'Error al reactivar la materia.');
    } finally {
      setReactivatingMateriaId(null);
    }
  };

  const handleOpenCreateMateria = () => {
    setMateriaModal({
      isOpen: true,
      mode: 'create',
      id: null,
      clave: '',
      nombre: '',
      creditos: 5
    });
    setMateriaModalError('');
  };

  const handleOpenEditMateria = (materia) => {
    setMateriaModal({
      isOpen: true,
      mode: 'edit',
      id: materia.materia_id,
      clave: materia.clave,
      nombre: materia.nombre,
      creditos: materia.creditos || 5
    });
    setMateriaModalError('');
  };

  const handleSaveMateria = async (e) => {
    e.preventDefault();
    if (!materiaModal.clave.trim() || !materiaModal.nombre.trim()) {
      setMateriaModalError('La clave y el nombre de la materia son obligatorios.');
      return;
    }

    setSavingMateria(true);
    setMateriaModalError('');

    try {
      if (materiaModal.mode === 'create') {
        await api.createMateria({
          clave: materiaModal.clave.trim().toUpperCase(),
          nombre: materiaModal.nombre.trim(),
          creditos: parseInt(materiaModal.creditos, 10) || 5
        });
      } else {
        await api.updateMateria(materiaModal.id, {
          clave: materiaModal.clave.trim().toUpperCase(),
          nombre: materiaModal.nombre.trim(),
          creditos: parseInt(materiaModal.creditos, 10) || 5
        });
      }

      setMateriaModal(prev => ({ ...prev, isOpen: false }));
      await fetchMaterias();
      if (onRefreshOptions) {
        await onRefreshOptions();
      }
    } catch (err) {
      console.error('Error saving materia:', err);
      setMateriaModalError(err.message || 'No se pudo guardar la materia.');
    } finally {
      setSavingMateria(false);
    }
  };

  const handleConfirmDeleteMateria = async () => {
    if (!materiaToDelete) return;
    setDeletingMateria(true);
    setDeleteMateriaError('');

    try {
      await api.deleteMateria(materiaToDelete.materia_id);
      setMateriaToDelete(null);
      await fetchMaterias();
      if (onRefreshOptions) {
        await onRefreshOptions();
      }
    } catch (err) {
      console.error('Error deleting materia:', err);
      setDeleteMateriaError(err.message || 'Error al eliminar la materia.');
    } finally {
      setDeletingMateria(false);
    }
  };

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      {/* Top Banner & Sub-tab Switcher */}
      <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-grow">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-2xl text-txt-base">Asignación y Plan de Estudios</h3>
              <p className="text-xs font-semibold text-txt-muted mt-0.5">
                Programa los horarios semanales por grupo o administra el catálogo oficial de materias de la carrera.
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 theme-transition">
            <button
              type="button"
              onClick={() => setSubTab('horarios')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                subTab === 'horarios'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-txt-muted hover:text-brand-primary'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Asignar Horarios</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubTab('catalogo');
                fetchMaterias();
              }}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 relative ${
                subTab === 'catalogo'
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-txt-muted hover:text-brand-primary'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Catálogo de Materias</span>
              {materiasList.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  subTab === 'catalogo' ? 'bg-white/25 text-white' : 'bg-brand-primary/15 text-brand-primary'
                }`}>
                  {materiasList.length}
                </span>
              )}
            </button>
          </div>

          {/* Contextual Top Button */}
          {!isPastCycle && (
            subTab === 'horarios' ? (
              onOpenImportModal && (
                <button
                  onClick={onOpenImportModal}
                  className="px-4 py-2.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/20 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Importar Horarios Excel</span>
                </button>
              )
            ) : (
              <button
                onClick={handleOpenCreateMateria}
                className="px-4 py-2.5 bg-brand-primary hover:bg-brand-hover text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Materia</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* SUB-TAB 1: ASIGNACIÓN DE HORARIOS                             */}
      {/* ============================================================= */}
      {subTab === 'horarios' && (
        <>
          {/* Main Grid: Assignment Creator & Interactive Weekly Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Form Controls (4 cols) */}
            <div className="lg:col-span-4 bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4 h-fit">
              <div>
                <h4 className="font-bold text-lg text-txt-base flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand-primary" />
                  Asignar Materia a Grupo
                </h4>
                <p className="text-[11px] text-txt-muted mt-0.5">
                  Filtra y selecciona el grupo para visualizar su horario semanal y programar una materia.
                </p>
              </div>

              <form onSubmit={handleSaveGroupAssignment} className="space-y-4">
                {/* Filters: Semester & Shift */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                      Semestre (Filtro)
                    </label>
                    <select
                      value={assignGroupSemesterFilter}
                      onChange={(e) => {
                        setAssignGroupSemesterFilter(e.target.value);
                        setSelectedGroupId('');
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
                        setSelectedGroupId('');
                      }}
                      className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-2 outline-none text-xs theme-transition cursor-pointer"
                    >
                      <option value="all">Todos</option>
                      <option value="Matutino">Matutino</option>
                      <option value="Vespertino">Vespertino</option>
                    </select>
                  </div>
                </div>

                {/* Group Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                    Seleccionar Grupo *
                  </label>
                  <select
                    required
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer font-semibold"
                  >
                    <option value="">Selecciona un grupo...</option>
                    {filteredGroupsForAssign.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.clave} — {g.turno} ({g.semestre}° Sem)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject Selection with Quick Link to Catalog */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                      Seleccionar Materia *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSubTab('catalogo');
                        handleOpenCreateMateria();
                      }}
                      className="text-[10px] font-bold text-brand-primary hover:underline cursor-pointer"
                    >
                      + Nueva Materia
                    </button>
                  </div>
                  <select
                    required
                    value={selectedMateriaId}
                    onChange={(e) => setSelectedMateriaId(e.target.value)}
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                  >
                    <option value="">Selecciona una materia...</option>
                    {assignmentOptions?.materias?.map(m => (
                      <option key={m.id || m.materia_id} value={m.id || m.materia_id}>
                        {m.nombre} ({m.clave})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Teacher Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                    Seleccionar Docente *
                  </label>
                  <select
                    required
                    value={selectedDocenteId}
                    onChange={(e) => setSelectedDocenteId(e.target.value)}
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-sm theme-transition cursor-pointer"
                  >
                    <option value="">Selecciona un docente...</option>
                    {assignmentOptions?.docentes?.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Schedule Selector: Day Pills and Hours Buttons */}
                <div className="space-y-2 pt-2 border-t border-bdr-base/60">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                      Configuración de Horario Semanal
                    </label>
                    <span className="text-[10px] text-txt-muted font-mono font-semibold">
                      {selectedScheduleSlots.length} horas seleccionadas
                    </span>
                  </div>

                  {/* Day selection tabs */}
                  <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 gap-1">
                    {DAYS_OF_WEEK.map(d => {
                      const slotsForDay = selectedScheduleSlots.filter(s => s.day === d.abbrev).length;
                      return (
                        <button
                          key={d.abbrev}
                          type="button"
                          onClick={() => setActiveScheduleDay(d.abbrev)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                            activeScheduleDay === d.abbrev
                              ? 'bg-brand-primary text-white shadow-sm'
                              : 'text-txt-muted hover:text-brand-primary'
                          }`}
                        >
                          <span>{d.abbrev}</span>
                          {slotsForDay > 0 && (
                            <span className={`ml-1 text-[9px] px-1 py-0.2 rounded-full ${
                              activeScheduleDay === d.abbrev ? 'bg-white/25 text-white' : 'bg-brand-primary/20 text-brand-primary'
                            }`}>
                              {slotsForDay}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hours Grid for Active Day */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-txt-muted font-medium block">
                      Haz clic en las horas para activar/desactivar en <strong>{DAYS_OF_WEEK.find(d => d.abbrev === activeScheduleDay)?.label}</strong>:
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
                      {hoursToShow.map(hour => {
                        const isSelected = selectedScheduleSlots.some(s => s.day === activeScheduleDay && s.hour === hour);
                        const conflict = conflictSlots.find(c => c.day === activeScheduleDay && c.hour === hour);
                        const timeLabel = `${String(hour).padStart(2, '0')}:00`;

                        if (conflict) {
                          return (
                            <div
                              key={hour}
                              className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-center font-bold text-[10px] cursor-not-allowed select-none"
                              title={conflict.reason}
                            >
                              <div className="flex flex-col items-center justify-center">
                                <span>{timeLabel}</span>
                                <span className="text-[8px] bg-rose-500 text-white px-1 py-0.2 rounded font-extrabold mt-0.5">Ocupado</span>
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
                                ? 'bg-brand-primary border-brand-primary text-white shadow-md shadow-brand-primary/20' 
                                : 'bg-bg-surface border-bdr-base text-txt-muted hover:border-brand-primary/50 hover:text-brand-primary'
                            }`}
                          >
                            {timeLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Generated Schedule String */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                    Horario resultante
                  </label>
                  <input
                    type="text"
                    readOnly
                    required
                    value={scheduleString}
                    placeholder="Selecciona horas en el selector de arriba..."
                    className="w-full bg-bg-surface/50 border border-bdr-base text-txt-muted rounded-xl px-4 py-2.5 outline-none text-xs theme-transition font-mono cursor-not-allowed"
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {isPastCycle ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Ciclo escolar cerrado (solo lectura).</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={saving || !selectedGroupId || !selectedMateriaId || !selectedDocenteId || !scheduleString}
                    className="w-full bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none active:scale-95"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Guardando Asignación...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Asignar Materia a Grupo</span>
                      </>
                    )}
                  </button>
                )}
              </form>
            </div>

            {/* Right Column: Weekly Schedule Matrix for the Group (8 cols) */}
            <div className="lg:col-span-8 bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4">
              
              {/* Header of the Schedule Visualizer */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-bdr-base/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-lg text-txt-base">
                      {selectedGroupObj ? `Horario Semanal — Grupo ${selectedGroupObj.clave}` : 'Cuadrícula Semanal del Grupo'}
                    </h4>
                    {selectedGroupObj && (
                      <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary font-bold text-xs rounded-md border border-brand-primary/20">
                        {selectedGroupObj.turno} • {selectedGroupObj.semestre}° Semestre
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-txt-muted mt-0.5">
                    {selectedGroupObj 
                      ? 'Visualiza la distribución de materias del grupo o haz clic en las celdas libres para seleccionar horarios.'
                      : 'Selecciona un grupo en el formulario izquierdo para cargar su calendario semanal de clases.'}
                  </p>
                </div>

                {/* Academic Load Badges */}
                {groupMetrics && (
                  <div className="flex items-center gap-3 bg-bg-surface border border-bdr-base px-3.5 py-2 rounded-xl">
                    <div className="text-center border-r border-bdr-base pr-3">
                      <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider block">Materias</span>
                      <span className="text-sm font-extrabold text-txt-base">{groupMetrics.subjectsCount}</span>
                    </div>
                    <div className="text-center border-r border-bdr-base pr-3">
                      <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider block">Carga Horaria</span>
                      <span className="text-sm font-extrabold text-brand-primary">{groupMetrics.totalHours} hrs/sem</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-txt-muted uppercase tracking-wider block">Cupo</span>
                      <span className="text-sm font-extrabold text-txt-base">{groupMetrics.cupo}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Calendar CSS Grid Container */}
              {!selectedGroupId ? (
                <div className="py-16 text-center text-txt-muted flex flex-col items-center justify-center space-y-3 bg-bg-surface/30 rounded-2xl border border-dashed border-bdr-base">
                  <Layers className="w-10 h-10 text-txt-muted/40 stroke-1" />
                  <div className="max-w-xs">
                    <p className="font-bold text-sm text-txt-base">Ningún grupo seleccionado</p>
                    <p className="text-xs text-txt-muted mt-1">
                      Elige un grupo en el panel izquierdo para consultar su horario completo de clases y huecos libres disponibles.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-bdr-base rounded-2xl overflow-x-auto bg-bg-surface/30 theme-transition select-none">
                  <div 
                    className="grid grid-cols-6 relative min-w-[640px]"
                    style={{ 
                      gridTemplateColumns: '70px repeat(5, minmax(110px, 1fr))',
                      gridTemplateRows: `36px repeat(${hoursToShow.length}, 64px)`
                    }}
                  >
                    {/* Header Row */}
                    <div className="text-[10px] font-bold text-txt-muted text-center py-2.5 bg-bg-surface border-b border-r border-bdr-base uppercase tracking-wider flex items-center justify-center">
                      Hora
                    </div>
                    {DAYS_OF_WEEK.map(d => (
                      <div 
                        key={d.key} 
                        className="text-[10px] font-bold text-txt-muted text-center py-2.5 bg-bg-surface border-b border-r border-bdr-base last:border-r-0 uppercase tracking-wider flex items-center justify-center gap-1"
                      >
                        <span>{d.label}</span>
                      </div>
                    ))}

                    {/* Grid Rows for Hours */}
                    {hoursToShow.map((h, rowIdx) => {
                      const minHour = hoursToShow[0];
                      const startRow = h - minHour + 2;
                      const timeLabel = `${String(h).padStart(2, '0')}:00`;

                      return (
                        <React.Fragment key={h}>
                          {/* Time Column */}
                          <div 
                            className="text-[10px] font-mono font-bold text-txt-muted flex items-center justify-center border-b border-r border-bdr-base bg-bg-surface/20 h-[64px]"
                            style={{ gridRow: startRow, gridColumn: 1 }}
                          >
                            {timeLabel}
                          </div>

                          {/* Day Columns */}
                          {DAYS_OF_WEEK.map(d => {
                            const isSlotSelected = selectedScheduleSlots.some(s => s.day === d.abbrev && s.hour === h);
                            const isSlotOccupied = groupCalendarBlocks.some(b => b.day === d.key && h >= b.startHour && h < b.endHour);
                            const teacherConflict = !isSlotOccupied && selectedDocenteId && conflictSlots.some(c => c.day === d.abbrev && c.hour === h);

                            return (
                              <div 
                                key={d.key}
                                onClick={() => {
                                  if (!isSlotOccupied) {
                                    toggleScheduleSlot(d.abbrev, h);
                                    setActiveScheduleDay(d.abbrev);
                                  }
                                }}
                                className={`border-b border-r border-bdr-base last:border-r-0 h-[64px] transition-all relative ${
                                  isSlotOccupied
                                    ? 'bg-transparent'
                                    : isSlotSelected
                                      ? 'bg-brand-primary/15 border-brand-primary/40 cursor-pointer'
                                      : teacherConflict
                                        ? 'bg-rose-500/5 hover:bg-rose-500/10 cursor-pointer'
                                        : 'hover:bg-brand-primary/5 cursor-pointer'
                                }`}
                                style={{ gridRow: startRow, gridColumn: d.colIndex }}
                              >
                                {!isSlotOccupied && isSlotSelected && (
                                  <div className="absolute inset-1 rounded-lg bg-brand-primary/20 border border-brand-primary flex items-center justify-center text-[10px] font-bold text-brand-primary animate-fadeIn">
                                    Seleccionado
                                  </div>
                                )}
                                {!isSlotOccupied && !isSlotSelected && teacherConflict && (
                                  <div className="absolute inset-1 rounded-lg border border-dashed border-rose-500/30 flex items-center justify-center text-[8px] font-bold text-rose-500">
                                    Docente Ocupado
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}

                    {/* Foreground Cards for Assigned Subjects */}
                    {groupCalendarBlocks.map((cls) => {
                      const dayObj = DAYS_OF_WEEK.find(d => d.key === cls.day);
                      if (!dayObj) return null;

                      const minHour = hoursToShow[0];
                      if (cls.startHour < minHour) return null;

                      const startRow = cls.startHour - minHour + 2;
                      const colorClass = subjectColorMap[cls.materiaId] || 'bg-brand-primary/10 border-brand-primary/30 text-brand-primary';

                      return (
                        <div
                          key={cls.blockId}
                          className={`group relative m-1 p-2 rounded-xl border flex flex-col justify-between shadow-sm transition-all overflow-hidden ${colorClass}`}
                          style={{
                            gridColumn: `${dayObj.colIndex} / span 1`,
                            gridRow: `${startRow} / span ${cls.duration}`,
                            zIndex: 10,
                            minHeight: `${cls.duration * 64 - 8}px`
                          }}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div className="leading-tight overflow-hidden">
                              <span className="font-extrabold text-[11px] block truncate" title={cls.materiaNombre}>
                                {cls.materiaNombre}
                              </span>
                              <span className="text-[9px] opacity-75 font-mono block">
                                {cls.materiaClave}
                              </span>
                            </div>

                            {!isPastCycle && (
                              <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const asg = groupAssignments.find(a => a.id === cls.assignmentId);
                                    if (asg) handleOpenEdit(asg);
                                  }}
                                  className="p-1 hover:bg-black/10 dark:hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                                  title="Editar Asignación"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const asg = groupAssignments.find(a => a.id === cls.assignmentId);
                                    if (asg) setAssignmentToDelete(asg);
                                  }}
                                  className="p-1 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-md transition-colors cursor-pointer"
                                  title="Eliminar Asignación"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="mt-1 pt-1 border-t border-current/10 flex justify-between items-center text-[9px] font-semibold">
                            <span className="truncate max-w-[90px]" title={cls.docenteNombre}>
                              {cls.docenteNombre}
                            </span>
                            <span className="font-mono text-[8px] opacity-80 shrink-0">
                              {String(cls.startHour).padStart(2, '0')}:00-{String(cls.endHour).padStart(2, '0')}:00
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Table: All Subjects Assigned in the Term */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm theme-transition flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="font-bold text-lg text-txt-base">Todas las Materias Asignadas en el Ciclo</h4>
                <p className="text-xs font-semibold text-txt-muted">
                  {filteredAssignments.length} asignaciones totales encontradas
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <select
                  value={tableSemesterFilter}
                  onChange={(e) => {
                    setTableSemesterFilter(e.target.value);
                    setTableGroupFilter('all');
                  }}
                  className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                >
                  <option value="all">Semestre: Todos</option>
                  {Array.from({ length: 9 }, (_, i) => String(i + 1)).map(sem => (
                    <option key={sem} value={sem}>{sem}° Semestre</option>
                  ))}
                </select>

                <select
                  value={tableGroupFilter}
                  onChange={(e) => setTableGroupFilter(e.target.value)}
                  className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-2.5 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                >
                  <option value="all">Grupo: Todos</option>
                  {tableGroupOptions.map(g => (
                    <option key={g.id} value={g.id}>{g.clave}</option>
                  ))}
                </select>

                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Buscar materia, docente..."
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl pl-8 pr-3 py-1.5 outline-none text-xs theme-transition"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4 text-center">Semestre</th>
                    <th className="py-3 px-4">Grupo Clave</th>
                    <th className="py-3 px-4">Asignatura (Clave)</th>
                    <th className="py-3 px-4">Docente Titular</th>
                    <th className="py-3 px-4">Horario Semanal</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-base/40 text-xs">
                  {filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-txt-muted italic">
                        No se encontraron materias vinculadas con los filtros seleccionados.
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
                        <td className="py-3.5 px-4 text-txt-muted font-semibold font-mono text-[11px]">{asg.horario || 'Sin horario'}</td>
                        <td className="py-3.5 px-4 text-center">
                          {!isPastCycle ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(asg)}
                                className="p-1.5 hover:bg-brand-primary/10 text-txt-muted hover:text-brand-primary rounded-lg transition-all cursor-pointer"
                                title="Editar docente o horario"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setAssignmentToDelete(asg)}
                                className="p-1.5 hover:bg-rose-500/10 text-txt-muted hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                                title="Eliminar asignación"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-txt-muted/30 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============================================================= */}
      {/* SUB-TAB 2: CATÁLOGO DE MATERIAS (CRUD)                        */}
      {/* ============================================================= */}
      {subTab === 'catalogo' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Stat Cards */}
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                <BookMarked className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-txt-muted uppercase tracking-wider block">Total Catálogo</span>
                <span className="text-2xl font-extrabold text-txt-base">{materiasStats.total}</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-txt-muted uppercase tracking-wider block">Materias Activas</span>
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{materiasStats.activeCount}</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <CalendarRange className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-txt-muted uppercase tracking-wider block">Con Clases (Ciclo Actual)</span>
                <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{materiasStats.withClassesCurrentCycle}</span>
              </div>
            </div>

            <div className="bg-bg-card border border-bdr-base p-5 rounded-2xl shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-txt-muted uppercase tracking-wider block">Dadas de Baja</span>
                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{materiasStats.inactiveCount}</span>
              </div>
            </div>
          </div>

          {/* Materias Table Card */}
          <div className="bg-bg-card border border-bdr-base p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h4 className="font-bold text-lg text-txt-base">Plan de Estudios Registrado</h4>
                <p className="text-xs font-semibold text-txt-muted">
                  {filteredMaterias.length} materias listadas {materiaStatusFilter !== 'all' ? `(${materiaStatusFilter === 'active' ? 'solo activas' : 'dadas de baja'})` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                {/* Status Segmented Pills */}
                <div className="flex bg-bg-surface border border-bdr-base rounded-xl p-1 theme-transition text-xs">
                  <button
                    type="button"
                    onClick={() => setMateriaStatusFilter('all')}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      materiaStatusFilter === 'all'
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-txt-muted hover:text-brand-primary'
                    }`}
                  >
                    Todas ({materiasStats.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMateriaStatusFilter('active')}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      materiaStatusFilter === 'active'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-txt-muted hover:text-emerald-600'
                    }`}
                  >
                    Activas ({materiasStats.activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMateriaStatusFilter('inactive')}
                    className={`px-3 py-1 font-bold rounded-lg transition-all cursor-pointer ${
                      materiaStatusFilter === 'inactive'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-txt-muted hover:text-amber-600'
                    }`}
                  >
                    Bajas ({materiasStats.inactiveCount})
                  </button>
                </div>

                <select
                  value={materiaCreditFilter}
                  onChange={(e) => setMateriaCreditFilter(e.target.value)}
                  className="bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-1.5 outline-none text-xs theme-transition cursor-pointer"
                >
                  <option value="all">Créditos: Todos</option>
                  <option value="4">4 Créditos</option>
                  <option value="5">5 Créditos</option>
                  <option value="6">6 Créditos</option>
                </select>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                  <input
                    type="text"
                    value={materiaSearchQuery}
                    onChange={(e) => setMateriaSearchQuery(e.target.value)}
                    placeholder="Buscar clave o nombre..."
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl pl-8 pr-3 py-1.5 outline-none text-xs theme-transition"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4">Clave Oficial</th>
                    <th className="py-3 px-4">Nombre de la Asignatura</th>
                    <th className="py-3 px-4 text-center">Créditos</th>
                    <th className="py-3 px-4 text-center">Estado (Ciclo Actual)</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr-base/40 text-xs">
                  {loadingMaterias ? (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-txt-muted">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-primary" />
                        <span>Cargando catálogo de materias...</span>
                      </td>
                    </tr>
                  ) : filteredMaterias.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-txt-muted italic">
                        No se encontraron materias con el filtro aplicado.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterias.map(mat => (
                      <tr key={mat.materia_id} className={`hover:bg-bg-surface/30 theme-transition ${mat.activo === false ? 'opacity-70 bg-bg-surface/20' : ''}`}>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded-md border ${
                            mat.activo === false
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                          }`}>
                            {mat.clave}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-txt-base">
                          <div className="flex items-center gap-2">
                            <span>{mat.nombre}</span>
                            {mat.activo === false && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                Baja
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-bg-surface border border-bdr-base font-bold text-[11px] text-txt-subtle">
                            {mat.creditos} cr
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {mat.activo === false ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] border border-amber-500/20">
                              <Archive className="w-3 h-3" />
                              <span>Dada de baja del plan</span>
                            </span>
                          ) : mat.asignaciones_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                              {mat.asignaciones_count} grupo(s) asignado(s)
                            </span>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2.5 py-0.5 rounded-full bg-txt-muted/10 text-txt-muted font-bold text-[10px]">
                                Sin asignar
                              </span>
                              {mat.total_historico_count > 0 && (
                                <span className="text-[9px] text-txt-muted/60 font-medium mt-0.5">
                                  ({mat.total_historico_count} en ciclos pasados)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {!isPastCycle ? (
                            <div className="flex items-center justify-center gap-1.5">
                              {mat.activo === false ? (
                                <button
                                  onClick={() => handleReactivateMateria(mat)}
                                  disabled={reactivatingMateriaId === mat.materia_id}
                                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-500/20 shadow-xs active:scale-95"
                                  title="Reactivar e incorporar de nuevo al plan de estudios"
                                >
                                  {reactivatingMateriaId === mat.materia_id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  )}
                                  <span>Reactivar</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleOpenEditMateria(mat)}
                                    className="p-1.5 hover:bg-brand-primary/10 text-txt-muted hover:text-brand-primary rounded-lg transition-all cursor-pointer"
                                    title="Editar Materia"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMateriaToDelete(mat);
                                      setDeleteMateriaError('');
                                    }}
                                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                      mat.total_historico_count > 0
                                        ? 'hover:bg-amber-500/10 text-txt-muted hover:text-amber-600'
                                        : 'hover:bg-rose-500/10 text-txt-muted hover:text-rose-500'
                                    }`}
                                    title={mat.total_historico_count > 0 ? "Dar de baja del plan de estudios" : "Eliminar definitivamente del catálogo"}
                                  >
                                    {mat.total_historico_count > 0 ? (
                                      <Archive className="w-4 h-4" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-txt-muted/30 text-xs">-</span>
                          )}
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

      {/* ============================================================= */}
      {/* MODAL: EDIT ASSIGNMENT (Change Teacher or Schedule)          */}
      {/* ============================================================= */}
      {editingAssignment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl max-w-md w-full shadow-2xl p-6 relative theme-transition animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-brand-primary" />
                <h4 className="font-extrabold text-base text-txt-base">Editar Asignación</h4>
              </div>
              <button 
                onClick={() => setEditingAssignment(null)} 
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="p-3 bg-bg-surface border border-bdr-base rounded-xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-brand-primary">{editingAssignment.grupo_clave}</span>
                  <span className="text-[10px] font-bold text-txt-muted">{editingAssignment.semestre}° Semestre</span>
                </div>
                <p className="font-extrabold text-sm text-txt-base">{editingAssignment.materia_nombre}</p>
                <p className="text-[10px] text-txt-muted font-mono">{editingAssignment.materia_clave}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                  Docente Titular
                </label>
                <select
                  value={editDocenteId}
                  onChange={(e) => setEditDocenteId(e.target.value)}
                  required
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                >
                  <option value="">Selecciona docente...</option>
                  {assignmentOptions?.docentes?.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                  Horario de la Clase
                </label>
                <input
                  type="text"
                  required
                  value={editScheduleString}
                  onChange={(e) => setEditScheduleString(e.target.value)}
                  placeholder="Ej: Lu 07-09, Mi 07-09"
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-xs font-mono theme-transition"
                />
                <span className="text-[10px] text-txt-muted block">
                  Formato: <code className="text-brand-primary">Lu 07-09, Mi 07-09</code>
                </span>
              </div>

              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-bdr-base">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: DELETE ASSIGNMENT CONFIRMATION                         */}
      {/* ============================================================= */}
      {assignmentToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl max-w-sm w-full shadow-2xl p-6 relative theme-transition animate-in fade-in zoom-in-95 duration-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="font-extrabold text-base text-txt-base">¿Eliminar Asignación?</h4>
              <p className="text-xs text-txt-muted mt-1.5">
                Se desvinculará la materia <strong>{assignmentToDelete.materia_nombre}</strong> del grupo <strong>{assignmentToDelete.grupo_clave}</strong> y los alumnos inscritos perderán esta clase.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignmentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: CREATE / EDIT MATERIA (CATÁLOGO)                       */}
      {/* ============================================================= */}
      {materiaModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl max-w-md w-full shadow-2xl p-6 relative theme-transition animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3 mb-4">
              <div className="flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-brand-primary" />
                <h4 className="font-extrabold text-base text-txt-base">
                  {materiaModal.mode === 'create' ? 'Nueva Materia del Plan de Estudios' : 'Editar Materia'}
                </h4>
              </div>
              <button 
                onClick={() => setMateriaModal(prev => ({ ...prev, isOpen: false }))} 
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMateria} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                  Clave Oficial de la Materia *
                </label>
                <input
                  type="text"
                  required
                  value={materiaModal.clave}
                  onChange={(e) => setMateriaModal(prev => ({ ...prev, clave: e.target.value }))}
                  placeholder="Ej: SCD-1021 o ACF-0902"
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-xs font-mono uppercase theme-transition"
                />
                <span className="text-[10px] text-txt-muted block">
                  La clave debe ser única para cada asignatura.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                  Nombre Completo de la Asignatura *
                </label>
                <input
                  type="text"
                  required
                  value={materiaModal.nombre}
                  onChange={(e) => setMateriaModal(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Cálculo Integral, Redes de Computadoras..."
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-xs theme-transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-txt-muted uppercase tracking-widest block">
                  Número de Créditos *
                </label>
                <select
                  value={materiaModal.creditos}
                  onChange={(e) => setMateriaModal(prev => ({ ...prev, creditos: parseInt(e.target.value, 10) }))}
                  className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base rounded-xl px-3 py-2.5 outline-none text-xs theme-transition cursor-pointer"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(c => (
                    <option key={c} value={c}>{c} Créditos</option>
                  ))}
                </select>
              </div>

              {materiaModalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{materiaModalError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-bdr-base">
                <button
                  type="button"
                  onClick={() => setMateriaModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMateria}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {savingMateria ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{materiaModal.mode === 'create' ? 'Crear Materia' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: DELETE / ARCHIVE MATERIA CONFIRMATION                  */}
      {/* ============================================================= */}
      {materiaToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl max-w-sm w-full shadow-2xl p-6 relative theme-transition animate-in fade-in zoom-in-95 duration-200 text-center space-y-4">
            <div className={`w-12 h-12 rounded-full border flex items-center justify-center mx-auto ${
              materiaToDelete.asignaciones_count > 0
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                : materiaToDelete.total_historico_count > 0
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
            }`}>
              {materiaToDelete.asignaciones_count > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : materiaToDelete.total_historico_count > 0 ? (
                <Archive className="w-6 h-6" />
              ) : (
                <Trash2 className="w-6 h-6" />
              )}
            </div>

            <div>
              <h4 className="font-extrabold text-base text-txt-base">
                {materiaToDelete.asignaciones_count > 0
                  ? 'Materia Asignada en Ciclo Actual'
                  : materiaToDelete.total_historico_count > 0
                    ? '¿Dar de Baja del Plan de Estudios?'
                    : '¿Eliminar Definitivamente?'}
              </h4>
              <p className="text-xs text-txt-muted mt-1.5">
                Materia: <strong className="text-txt-base">{materiaToDelete.nombre}</strong> ({materiaToDelete.clave})
              </p>

              {materiaToDelete.asignaciones_count > 0 ? (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-start gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Tiene {materiaToDelete.asignaciones_count} clase(s) activas este semestre. Primero debes desvincular sus horarios en la pestaña "Asignar Horarios" para poder retirarla.</span>
                </div>
              ) : materiaToDelete.total_historico_count > 0 ? (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-left space-y-1.5 text-txt-muted">
                  <p className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 shrink-0" />
                    <span>Se archivará del catálogo activo:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li>Ya <strong>no aparecerá</strong> en la lista para asignar nuevos grupos.</li>
                    <li>Las asistencias y reportes del <strong>semestre pasado se conservan intactos</strong> ({materiaToDelete.total_historico_count} asignaciones previas).</li>
                    <li>Podrás <strong>reactivarla en cualquier momento</strong> con un solo clic si deciden ofertarla de nuevo.</li>
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-txt-muted/80 mt-2 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-rose-500 font-medium">
                  Esta materia nunca tuvo clases asignadas. Se eliminará por completo de la base de datos sin afectar ningún registro.
                </p>
              )}
            </div>

            {deleteMateriaError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2 text-left">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{deleteMateriaError}</span>
              </div>
            )}

            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMateriaToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer"
              >
                Cancelar
              </button>
              {materiaToDelete.asignaciones_count === 0 && (
                <button
                  type="button"
                  onClick={handleConfirmDeleteMateria}
                  disabled={deletingMateria}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 transition-all ${
                    materiaToDelete.total_historico_count > 0
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {deletingMateria ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : materiaToDelete.total_historico_count > 0 ? (
                    <Archive className="w-3.5 h-3.5" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {materiaToDelete.total_historico_count > 0
                      ? 'Dar de Baja del Plan'
                      : 'Eliminar Definitivamente'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
