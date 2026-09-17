import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Layers, Search, Plus, Trash2, RefreshCw, AlertTriangle, 
  CheckCircle2, Users, BookOpen, Clock, 
  Filter, X, ShieldAlert, ChevronDown, ChevronUp, UserMinus, Mail, Hash, Lock
} from 'lucide-react';
import { api } from '../services/api';

export default function GruposTab({ assignmentOptions, onRefreshOptions, isPastCycle = false }) {
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters (Strictly ISC - no career filter needed)
  const [searchQuery, setSearchQuery] = useState('');
  const [semestreFilter, setSemestreFilter] = useState('all');
  const [turnoFilter, setTurnoFilter] = useState('all');

  // Modal Create Group
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newGroupClave, setNewGroupClave] = useState('');
  const [newGroupSemestre, setNewGroupSemestre] = useState(1);
  const [newGroupTurno, setNewGroupTurno] = useState('Matutino');
  const [newGroupCupo, setNewGroupCupo] = useState(30);

  // Modal Delete Confirmation
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Expandable group students
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [groupStudentsData, setGroupStudentsData] = useState({});

  // Modal Remove Student from Group
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [removingStudent, setRemovingStudent] = useState(false);
  const [removeStudentError, setRemoveStudentError] = useState('');

  const fetchGrupos = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getGroups();
      setGrupos(data || []);
    } catch (err) {
      console.error('Error cargando grupos:', err);
      setError(err.message || 'Error al obtener la lista de grupos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrupos();
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isCreateModalOpen || groupToDelete || studentToRemove) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCreateModalOpen, groupToDelete, studentToRemove]);

  // Fetch students for a specific group
  const fetchStudentsForGroup = async (groupId) => {
    setGroupStudentsData(prev => ({
      ...prev,
      [groupId]: { ...(prev[groupId] || {}), loading: true, error: '' }
    }));
    try {
      const data = await api.getGroupStudents(groupId);
      setGroupStudentsData(prev => ({
        ...prev,
        [groupId]: { loading: false, students: data || [], error: '' }
      }));
    } catch (err) {
      console.error('Error fetching group students:', err);
      setGroupStudentsData(prev => ({
        ...prev,
        [groupId]: { loading: false, students: [], error: err.message || 'Error al cargar alumnos' }
      }));
    }
  };

  // Toggle accordion expansion for a group
  const handleToggleExpand = (groupId) => {
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(groupId);
      if (!groupStudentsData[groupId]?.students) {
        fetchStudentsForGroup(groupId);
      }
    }
  };

  // Handle Remove Student Confirmation
  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    const { student, group } = studentToRemove;

    setRemovingStudent(true);
    setRemoveStudentError('');

    try {
      await api.removeStudentFromGroup(group.grupo_id, student.alumno_id);
      setSuccessMessage(`Alumno "${student.nombre_completo}" removido del grupo ${group.clave} exitosamente.`);
      setTimeout(() => setSuccessMessage(''), 4000);

      // Update groupStudentsData
      setGroupStudentsData(prev => {
        const currentList = prev[group.grupo_id]?.students || [];
        return {
          ...prev,
          [group.grupo_id]: {
            ...prev[group.grupo_id],
            students: currentList.filter(s => s.alumno_id !== student.alumno_id)
          }
        };
      });

      // Update local grupos count
      setGrupos(prev => prev.map(g => {
        if (g.grupo_id === group.grupo_id) {
          return {
            ...g,
            total_alumnos: Math.max(0, (g.total_alumnos || 1) - 1)
          };
        }
        return g;
      }));

      setStudentToRemove(null);
      if (onRefreshOptions) onRefreshOptions();
    } catch (err) {
      console.error('Error removing student:', err);
      setRemoveStudentError(err.message || 'No se pudo remover al alumno del grupo.');
    } finally {
      setRemovingStudent(false);
    }
  };

  // Filtered Groups
  const filteredGrupos = useMemo(() => {
    return grupos.filter(g => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || g.clave?.toLowerCase().includes(q);
      const matchesSemestre = semestreFilter === 'all' || String(g.semestre) === String(semestreFilter);
      const matchesTurno = turnoFilter === 'all' || g.turno?.toLowerCase() === turnoFilter.toLowerCase();

      return matchesSearch && matchesSemestre && matchesTurno;
    });
  }, [grupos, searchQuery, semestreFilter, turnoFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = grupos.length;
    const matutino = grupos.filter(g => g.turno?.toLowerCase() === 'matutino').length;
    const vespertino = grupos.filter(g => g.turno?.toLowerCase() === 'vespertino').length;
    const totalMaterias = grupos.reduce((acc, g) => acc + (g.total_materias || 0), 0);
    const totalAlumnos = grupos.reduce((acc, g) => acc + (g.total_alumnos || 0), 0);

    return { total, matutino, vespertino, totalMaterias, totalAlumnos };
  }, [grupos]);

  // Handle Create Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupClave.trim()) {
      setCreateError('La clave del grupo es obligatoria.');
      return;
    }

    setCreatingGroup(true);
    setCreateError('');

    try {
      await api.createGroup({
        clave: newGroupClave.trim(),
        semestre: parseInt(newGroupSemestre),
        turno: newGroupTurno,
        cupo: parseInt(newGroupCupo)
      });

      setSuccessMessage(`Grupo "${newGroupClave.trim()}" creado exitosamente para ISC.`);
      setTimeout(() => setSuccessMessage(''), 4000);

      setIsCreateModalOpen(false);
      setNewGroupClave('');
      setNewGroupSemestre(1);
      setNewGroupTurno('Matutino');
      setNewGroupCupo(30);

      await fetchGrupos();
      if (onRefreshOptions) onRefreshOptions();
    } catch (err) {
      console.error('Error creating group:', err);
      setCreateError(err.message || 'Error al crear el grupo.');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Handle Delete Group
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    setDeletingGroup(true);
    setDeleteError('');

    try {
      await api.deleteGroup(groupToDelete.grupo_id);
      setSuccessMessage(`El grupo "${groupToDelete.clave}" fue eliminado con éxito.`);
      setTimeout(() => setSuccessMessage(''), 4000);

      setGroupToDelete(null);
      await fetchGrupos();
      if (onRefreshOptions) onRefreshOptions();
    } catch (err) {
      console.error('Error deleting group:', err);
      setDeleteError(err.message || 'No se pudo eliminar el grupo.');
    } finally {
      setDeletingGroup(false);
    }
  };

  return (
    <div className="space-y-4 text-left animate-fadeIn">
      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3.5 rounded-2xl flex items-center gap-3 animate-fadeIn text-xs font-semibold">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3.5 rounded-2xl flex items-center gap-3 animate-fadeIn text-xs font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button 
            onClick={fetchGrupos}
            className="ml-auto underline hover:opacity-80 font-bold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {isPastCycle && (
        <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-2xl flex items-center gap-3 text-amber-300 text-xs font-semibold text-left">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
          <span>
            <strong>Modo Solo Lectura:</strong> Estás consultando un ciclo escolar histórico. No se pueden crear, eliminar ni modificar grupos ni asignaciones de alumnos.
          </span>
        </div>
      )}

      {/* Top Header & Action Bar */}
      <div className="bg-bg-card border border-bdr-base p-4 sm:p-5 rounded-2xl shadow-sm theme-transition">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Header Info */}
          <div className="flex items-center gap-3">
            <div className="bg-brand-primary/10 text-brand-primary p-2.5 rounded-xl shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-xl sm:text-2xl text-txt-base">Catálogo de Grupos</h3>
                <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border border-brand-primary/20">
                  Carrera ISC
                </span>
                {isPastCycle && (
                  <span className="bg-amber-500/15 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-500/25 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Solo Lectura
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-txt-muted mt-0.5">
                Ingeniería en Sistemas Computacionales · Haz clic en un grupo para desplegar sus alumnos y gestionarlos.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={fetchGrupos}
              disabled={loading}
              className="p-2.5 border border-bdr-base rounded-xl hover:bg-bg-surface text-txt-muted hover:text-brand-primary transition-all cursor-pointer"
              title="Recargar lista de grupos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
            </button>
            {!isPastCycle ? (
              <button
                type="button"
                onClick={() => {
                  setCreateError('');
                  setIsCreateModalOpen(true);
                }}
                className="bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 flex-1 md:flex-initial"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Grupo</span>
              </button>
            ) : (
              <span className="text-xs font-bold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Solo Lectura</span>
              </span>
            )}
          </div>
        </div>

        {/* Compact KPI Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-bdr-base">
          <div className="bg-bg-surface/60 border border-bdr-base/50 p-2.5 rounded-xl flex items-center gap-2.5">
            <span className="p-1.5 bg-brand-primary/10 text-brand-primary rounded-lg">
              <Layers className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="text-base font-extrabold text-txt-base leading-tight">{stats.total}</div>
              <div className="text-[10px] font-semibold text-txt-muted">Total Grupos</div>
            </div>
          </div>

          <div className="bg-bg-surface/60 border border-bdr-base/50 p-2.5 rounded-xl flex items-center gap-2.5">
            <span className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="text-base font-extrabold text-txt-base leading-tight">{stats.matutino}</div>
              <div className="text-[10px] font-semibold text-txt-muted">Turno Matutino</div>
            </div>
          </div>

          <div className="bg-bg-surface/60 border border-bdr-base/50 p-2.5 rounded-xl flex items-center gap-2.5">
            <span className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="text-base font-extrabold text-txt-base leading-tight">{stats.vespertino}</div>
              <div className="text-[10px] font-semibold text-txt-muted">Turno Vespertino</div>
            </div>
          </div>

          <div className="bg-bg-surface/60 border border-bdr-base/50 p-2.5 rounded-xl flex items-center gap-2.5">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Users className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="text-base font-extrabold text-txt-base leading-tight">{stats.totalAlumnos}</div>
              <div className="text-[10px] font-semibold text-txt-muted">Alumnos Inscritos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-bg-card border border-bdr-base p-3.5 rounded-2xl shadow-sm theme-transition flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-txt-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por clave (ej. 341-M, 362-V)..."
            className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary text-txt-base text-xs pl-9 pr-8 py-2 rounded-xl outline-none theme-transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-subtle hover:text-txt-base cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Semestre Filter */}
          <div className="flex items-center gap-1.5 bg-bg-surface dark:bg-slate-900 border border-bdr-base px-2.5 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-txt-subtle" />
            <select
              value={semestreFilter}
              onChange={(e) => setSemestreFilter(e.target.value)}
              className="bg-bg-surface dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none cursor-pointer border-none"
            >
              <option value="all" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                Todos los Semestres
              </option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(sem => (
                <option key={sem} value={sem} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                  {sem}° Semestre
                </option>
              ))}
            </select>
          </div>

          {/* Turno Filter */}
          <div className="flex items-center gap-1.5 bg-bg-surface dark:bg-slate-900 border border-bdr-base px-2.5 py-1.5 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-txt-subtle" />
            <select
              value={turnoFilter}
              onChange={(e) => setTurnoFilter(e.target.value)}
              className="bg-bg-surface dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-semibold outline-none cursor-pointer border-none"
            >
              <option value="all" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                Todos los Turnos
              </option>
              <option value="Matutino" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                Matutino
              </option>
              <option value="Vespertino" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                Vespertino
              </option>
              <option value="Mixto" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                Mixto
              </option>
            </select>
          </div>

          {(searchQuery || semestreFilter !== 'all' || turnoFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSemestreFilter('all');
                setTurnoFilter('all');
              }}
              className="text-txt-subtle hover:text-rose-500 text-[11px] font-bold px-2 py-1 transition-colors cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table of Groups */}
      <div className="bg-bg-card border border-bdr-base rounded-2xl shadow-sm overflow-hidden theme-transition">
        <div className="px-4 py-3 border-b border-bdr-base flex justify-between items-center bg-bg-surface/30">
          <span className="text-xs font-extrabold text-txt-muted uppercase tracking-wider">
            Mostrando {filteredGrupos.length} de {grupos.length} grupos
          </span>
          <span className="text-[11px] text-txt-subtle font-medium">
            Selecciona un grupo para desplegar sus alumnos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-bdr-base text-txt-muted text-[10px] font-extrabold uppercase tracking-wider bg-bg-surface/20">
                <th className="py-3 px-3 text-center w-10"></th>
                <th className="py-3 px-3 text-center">Semestre</th>
                <th className="py-3 px-4">Clave Grupo</th>
                <th className="py-3 px-4">Turno</th>
                <th className="py-3 px-4 text-center">Cupo</th>
                <th className="py-3 px-4 text-center">Materias</th>
                <th className="py-3 px-4 text-center">Alumnos Inscritos</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr-base/40 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-txt-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-primary" />
                    <span className="font-semibold">Cargando grupos...</span>
                  </td>
                </tr>
              ) : filteredGrupos.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-txt-muted italic">
                    No se encontraron grupos que coincidan con la búsqueda o filtros.
                  </td>
                </tr>
              ) : (
                filteredGrupos.map((g) => {
                  const isExpanded = expandedGroupId === g.grupo_id;
                  const groupStudentsState = groupStudentsData[g.grupo_id] || {};
                  const enrolledList = groupStudentsState.students || [];

                  return (
                    <React.Fragment key={g.grupo_id}>
                      <tr 
                        className={`hover:bg-bg-surface/40 theme-transition cursor-pointer ${
                          isExpanded ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : ''
                        }`}
                        onClick={() => handleToggleExpand(g.grupo_id)}
                      >
                        <td className="py-3.5 px-3 text-center text-txt-muted">
                          <button
                            type="button"
                            className="p-1 hover:bg-bg-surface rounded-lg transition-colors cursor-pointer text-txt-muted hover:text-brand-primary"
                            title={isExpanded ? "Ocultar alumnos" : "Ver alumnos"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-brand-primary" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-bold text-txt-subtle bg-bg-surface px-2.5 py-1 rounded-lg border border-bdr-base">
                            {g.semestre}°
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-brand-primary text-sm tracking-wide">
                            {g.clave}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            g.turno?.toLowerCase() === 'matutino'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : g.turno?.toLowerCase() === 'vespertino'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            <Clock className="w-3 h-3" />
                            {g.turno}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-txt-base">
                          {g.cupo || 30}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            g.total_materias > 0 
                              ? 'bg-brand-primary/10 text-brand-primary' 
                              : 'text-txt-subtle bg-bg-surface'
                          }`}>
                            {g.total_materias || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExpand(g.grupo_id);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              g.total_alumnos > 0 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' 
                                : 'text-txt-subtle bg-bg-surface hover:bg-bg-surface/80 border border-bdr-base'
                            }`}
                            title="Desplegar alumnos del grupo"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>{g.total_alumnos || 0} alumnos</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 ml-0.5" />
                            ) : (
                              <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {!isPastCycle ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError('');
                                setGroupToDelete(g);
                              }}
                              className="p-1.5 hover:bg-rose-500/10 text-txt-subtle hover:text-rose-500 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                              title="Eliminar grupo completo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-txt-muted/30 text-xs">-</span>
                          )}
                        </td>
                      </tr>

                      {/* EXPANDED ROW: ENROLLED STUDENTS */}
                      {isExpanded && (
                        <tr className="bg-bg-surface/50 border-y border-brand-primary/20 animate-fadeIn">
                          <td colSpan="8" className="p-4 sm:p-5">
                            <div className="bg-bg-card border border-bdr-base rounded-2xl p-4 shadow-sm space-y-3 theme-transition">
                              
                              {/* Subheader */}
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-bdr-base">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                    <Users className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-sm text-txt-base flex items-center gap-2">
                                      <span>Alumnos inscritos en el Grupo {g.clave}</span>
                                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        {enrolledList.length} alumno(s)
                                      </span>
                                    </h4>
                                    <p className="text-[11px] text-txt-muted">
                                      {g.semestre}° Semestre · Turno {g.turno} · Puedes remover a cualquier alumno si fue inscrito por error o cambió de grupo.
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => fetchStudentsForGroup(g.grupo_id)}
                                  disabled={groupStudentsState.loading}
                                  className="text-[11px] font-bold text-txt-muted hover:text-brand-primary flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-bdr-base hover:bg-bg-surface transition-all cursor-pointer"
                                  title="Actualizar lista de alumnos"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${groupStudentsState.loading ? 'animate-spin text-brand-primary' : ''}`} />
                                  <span>Actualizar</span>
                                </button>
                              </div>

                              {/* Student List Content */}
                              {groupStudentsState.loading ? (
                                <div className="py-8 text-center text-txt-muted">
                                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-primary" />
                                  <span className="text-xs font-semibold">Cargando alumnos inscritos...</span>
                                </div>
                              ) : groupStudentsState.error ? (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 flex items-center justify-between">
                                  <span>{groupStudentsState.error}</span>
                                  <button
                                    onClick={() => fetchStudentsForGroup(g.grupo_id)}
                                    className="font-bold underline cursor-pointer"
                                  >
                                    Reintentar
                                  </button>
                                </div>
                              ) : enrolledList.length === 0 ? (
                                <div className="py-6 text-center text-txt-muted text-xs italic bg-bg-surface/30 rounded-xl border border-dashed border-bdr-base">
                                  No hay alumnos registrados o activos en el grupo {g.clave}.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse text-left">
                                    <thead>
                                      <tr className="text-[10px] font-extrabold uppercase tracking-wider text-txt-muted border-b border-bdr-base/60">
                                        <th className="py-2.5 px-3">Matrícula</th>
                                        <th className="py-2.5 px-3">Nombre del Alumno</th>
                                        <th className="py-2.5 px-3">Correo Institucional</th>
                                        <th className="py-2.5 px-3 text-center">Materias</th>
                                        <th className="py-2.5 px-3 text-right">Acción</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-bdr-base/30 text-xs">
                                      {enrolledList.map((st) => (
                                        <tr key={st.alumno_id} className="hover:bg-bg-surface/50 theme-transition">
                                          <td className="py-2.5 px-3">
                                            <span className="font-mono font-bold text-txt-base bg-bg-surface px-2 py-0.5 rounded-md border border-bdr-base text-[11px]">
                                              {st.matricula || 'S/N'}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3">
                                            <div className="font-bold text-txt-base">
                                              {st.nombre_completo}
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-3 text-txt-muted font-medium text-[11px]">
                                            {st.correo || 'Sin correo registrado'}
                                          </td>
                                          <td className="py-2.5 px-3 text-center">
                                            <span className="font-bold text-txt-subtle bg-bg-surface px-2 py-0.5 rounded-lg border border-bdr-base text-[11px]">
                                              {st.total_materias_inscritas || 0}
                                            </span>
                                          </td>
                                          <td className="py-2.5 px-3 text-right">
                                            {!isPastCycle ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setRemoveStudentError('');
                                                  setStudentToRemove({ student: st, group: g });
                                                }}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                                                title="Remover alumno de este grupo"
                                              >
                                                <UserMinus className="w-3.5 h-3.5" />
                                                <span>Remover</span>
                                              </button>
                                            ) : (
                                              <span className="text-[10px] font-semibold text-txt-muted/60 italic">Solo lectura</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE GROUP */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-bdr-base pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-txt-base">Crear Nuevo Grupo</h3>
                  <span className="text-[11px] text-txt-muted font-medium">Asignado a: Ingeniería en Sistemas Computacionales</span>
                </div>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)} 
                className="text-txt-muted hover:text-txt-base cursor-pointer text-sm p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                  Clave del Grupo <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newGroupClave}
                  onChange={(e) => setNewGroupClave(e.target.value)}
                  placeholder="Ej. 341-M, 362-V, 181-M..."
                  required
                  className="w-full bg-bg-surface dark:bg-slate-900 border border-bdr-base focus:border-brand-primary text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
                <span className="text-[10px] text-txt-muted font-medium">
                  Identificador único del grupo (ej. 141-M, 242-V, 341-M).
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                    Semestre <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    value={newGroupSemestre} 
                    onChange={(e) => setNewGroupSemestre(parseInt(e.target.value))}
                    required
                    className="w-full bg-bg-surface dark:bg-slate-900 border border-bdr-base focus:border-brand-primary text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(sem => (
                      <option key={sem} value={sem} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                        {sem}° Semestre
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                    Turno <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    value={newGroupTurno} 
                    onChange={(e) => setNewGroupTurno(e.target.value)}
                    required
                    className="w-full bg-bg-surface dark:bg-slate-900 border border-bdr-base focus:border-brand-primary text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2.5 outline-none text-sm cursor-pointer theme-transition"
                  >
                    <option value="Matutino" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                      Matutino
                    </option>
                    <option value="Vespertino" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                      Vespertino
                    </option>
                    <option value="Mixto" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-medium">
                      Mixto
                    </option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                  Cupo Máximo
                </label>
                <input 
                  type="number" 
                  value={newGroupCupo}
                  onChange={(e) => setNewGroupCupo(parseInt(e.target.value))}
                  min="1"
                  max="100"
                  required
                  className="w-full bg-bg-surface dark:bg-slate-900 border border-bdr-base focus:border-brand-primary text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 outline-none text-sm theme-transition"
                />
              </div>

              {createError && (
                <div className="text-xs text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)} 
                  disabled={creatingGroup}
                  className="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creatingGroup} 
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-hover text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {creatingGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Guardar Grupo</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: DELETE GROUP CONFIRMATION */}
      {groupToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="bg-rose-500/10 text-rose-500 p-2.5 rounded-xl shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-txt-base">¿Eliminar Grupo?</h3>
                <p className="text-xs text-txt-muted mt-1">
                  Estás a punto de eliminar el grupo <strong className="text-txt-base">{groupToDelete.clave}</strong> ({groupToDelete.semestre}° Semestre - {groupToDelete.turno}).
                </p>
              </div>
            </div>

            {((groupToDelete.total_materias > 0) || (groupToDelete.total_alumnos > 0)) && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Atención: Este grupo tiene elementos asociados</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                  {groupToDelete.total_materias > 0 && (
                    <li>{groupToDelete.total_materias} materias/horarios asignados.</li>
                  )}
                  {groupToDelete.total_alumnos > 0 && (
                    <li>{groupToDelete.total_alumnos} alumnos con inscripciones activas.</li>
                  )}
                </ul>
                <p className="text-[10px] italic pt-1">
                  Al confirmar, se desvincularán de forma limpia y permanente las materias y registros correspondientes.
                </p>
              </div>
            )}

            {deleteError && (
              <div className="text-xs text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
              <button 
                type="button" 
                onClick={() => setGroupToDelete(null)} 
                disabled={deletingGroup}
                className="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleDeleteGroup}
                disabled={deletingGroup} 
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {deletingGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: REMOVE STUDENT FROM GROUP CONFIRMATION */}
      {studentToRemove && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-card border border-bdr-base rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 theme-transition relative my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="bg-rose-500/10 text-rose-500 p-2.5 rounded-xl shrink-0">
                <UserMinus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-txt-base">¿Remover Alumno del Grupo?</h3>
                <p className="text-xs text-txt-muted mt-1">
                  Estás a punto de remover a <strong className="text-txt-base">{studentToRemove.student.nombre_completo}</strong> ({studentToRemove.student.matricula}) del grupo <strong className="text-brand-primary">{studentToRemove.group.clave}</strong>.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-xl space-y-1.5 text-xs text-txt-muted">
              <p className="text-[11px]">
                El alumno será desvinculado de todas las materias asignadas a este grupo ({studentToRemove.student.total_materias_inscritas || 0} materias) y sus registros de asistencia para estas clases serán limpiados.
              </p>
            </div>

            {removeStudentError && (
              <div className="text-xs text-rose-500 font-semibold bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
                {removeStudentError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-bdr-base">
              <button 
                type="button" 
                onClick={() => setStudentToRemove(null)} 
                disabled={removingStudent}
                className="px-4 py-2 rounded-xl text-xs font-semibold btn-secondary cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleConfirmRemoveStudent}
                disabled={removingStudent} 
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {removingStudent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                <span>Remover del Grupo</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
