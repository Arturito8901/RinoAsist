import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Calendar, Lock, AlertCircle, ArrowRight, Loader2, QrCode, Eye, EyeOff, CheckCircle2, Check, X, Users, TrendingUp, BookOpen, Clock, FileText, Award, ShieldAlert, Bell, UserCheck, Mail } from 'lucide-react';

import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import rinoasistBanner from '../assets/rinoasist_banner.png';
import rinoasistBannerDark from '../assets/rinoasist_banner_dark.png';
import rhinoSilhouette from '../assets/rhino_silhouette.png';

const floatingPool = [
  { Icon: Calendar, label: "Bitácora", color: "text-brand-primary", animateClass: "animate-float" },
  { Icon: QrCode, label: "Módulo QR", color: "text-emerald-555 dark:text-emerald-400", animateClass: "animate-float-reverse" },
  { Icon: Users, label: "Alumnos", color: "text-indigo-500", animateClass: "animate-float" },
  { Icon: CheckCircle2, label: "Asistencias", color: "text-sky-500", animateClass: "animate-float-reverse" },
  { Icon: TrendingUp, label: "Deserción", color: "text-rose-550 dark:text-rose-450", animateClass: "animate-float-reverse" },
  { Icon: BookOpen, label: "Materias", color: "text-amber-500", animateClass: "animate-float" },
  { Icon: Clock, label: "Horarios", color: "text-cyan-500", animateClass: "animate-float-reverse" },
  { Icon: FileText, label: "Reportes", color: "text-teal-500", animateClass: "animate-float" },
  { Icon: Award, label: "Desempeño", color: "text-yellow-500", animateClass: "animate-float-reverse" },
  { Icon: ShieldAlert, label: "Alertas", color: "text-orange-500", animateClass: "animate-float" },
  { Icon: Bell, label: "Avisos", color: "text-purple-500", animateClass: "animate-float-reverse" },
  { Icon: UserCheck, label: "Pase Lista", color: "text-lime-500", animateClass: "animate-float" },
];

function FloatingWidget({ positionClass, delay, initialIndex }) {
  const [index, setIndex] = useState(initialIndex);
  
  const handleAnimationIteration = () => {
    setIndex((prevIndex) => (prevIndex + 1) % floatingPool.length);
  };

  const item = floatingPool[index];
  const { Icon, label, color, animateClass } = item;

  return (
    <div 
      className={`absolute ${positionClass} hidden md:block z-0 animate-fade-in-out select-none`}
      style={{ animationDelay: delay, animationDuration: '12s' }}
      onAnimationIteration={handleAnimationIteration}
    >
      <div className={`flex flex-col items-center bg-bg-card/40 backdrop-blur-md border border-bdr-base/60 p-4 rounded-2xl shadow-xl ${animateClass} ${color} hover:border-brand-primary/20 transition-colors w-24`}>
        <Icon className="w-8 h-8" />
        <span className="text-[9px] font-extrabold mt-2 text-txt-muted uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [groupClave, setGroupClave] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [validating, setValidating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [capsLockActive, setCapsLockActive] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Enlace de invitación inválido: falta el token de seguridad.');
      setValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const data = await api.validateInvite(token);
        setEmail(data.correo);
        setGroupClave(data.grupo_clave);
      } catch (err) {
        setError(err.message || 'La invitación es inválida o ha expirado.');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handlePasswordKeyDown = (e) => {
    const isCaps = e.getModifierState('CapsLock');
    setCapsLockActive(isCaps);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('No se puede registrar sin una invitación válida.');
      return;
    }
    if (!nombre || !password || !confirmPassword) {
      setError('Por favor, completa todos los campos.');
      return;
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    const hasSpec = /[^A-Za-z0-9]/.test(password);

    if (password.length < 6 || !hasUpper || !hasNum || !hasSpec) {
      setError('La contraseña no cumple con todos los requisitos de seguridad.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.acceptInvite(token, nombre, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 4000);
    } catch (err) {
      setError(err.message || 'Error al completar el registro.');
    } finally {
      setLoading(false);
    }
  };

  // Basic password strength checker
  const getPasswordStrength = () => {
    if (!password) return { label: '', color: '', percent: 0 };
    if (password.length < 6) return { label: 'Débil', color: 'bg-rose-500', percent: 33 };
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (hasLetters && hasNumbers && hasSpecial) return { label: 'Fuerte', color: 'bg-emerald-500', percent: 100 };
    if (hasLetters && hasNumbers) return { label: 'Media', color: 'bg-amber-500', percent: 66 };
    return { label: 'Débil', color: 'bg-rose-500', percent: 33 };
  };

  const strength = getPasswordStrength();

  const renderChecklistItem = (label, isMet) => {
    return (
      <div className={`flex items-center gap-1.5 transition-all duration-300 ${isMet ? 'text-emerald-500 dark:text-emerald-400' : 'text-txt-subtle'}`}>
        <span className={`p-0.5 rounded-full transition-all duration-300 flex items-center justify-center ${
          isMet 
            ? 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20' 
            : 'bg-bg-surface text-txt-subtle/70 border border-bdr-base'
        }`}>
          {isMet ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
        </span>
        <span className="text-[11px] font-semibold">{label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg-base text-txt-base flex flex-col justify-center items-center p-6 relative overflow-hidden theme-transition isolate">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -z-10 animate-float-slow"></div>

      {/* Watermark */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[85vw] h-[85vh] lg:w-[48vw] lg:h-[95vh] opacity-[0.16] dark:opacity-[0.06] pointer-events-none select-none -z-20 grayscale contrast-75 mix-blend-multiply dark:mix-blend-screen dark:invert transition-opacity duration-300">
        <img 
          src={rhinoSilhouette} 
          alt="Rino Marca de Agua" 
          className="w-full h-full object-contain object-right"
        />
      </div>

      {/* Floating Decorative Elements */}
      <FloatingWidget positionClass="left-[5%] top-[10%]" delay="0s" initialIndex={0} />
      <FloatingWidget positionClass="left-[25%] top-[8%]" delay="1s" initialIndex={1} />
      <FloatingWidget positionClass="left-[55%] top-[6%]" delay="2s" initialIndex={2} />
      <FloatingWidget positionClass="right-[15%] top-[12%]" delay="3s" initialIndex={3} />
      <FloatingWidget positionClass="left-[8%] top-[38%]" delay="4s" initialIndex={4} />
      <FloatingWidget positionClass="left-[22%] top-[45%]" delay="5s" initialIndex={5} />
      <FloatingWidget positionClass="right-[20%] top-[40%]" delay="6s" initialIndex={6} />
      <FloatingWidget positionClass="right-[8%] top-[35%]" delay="7s" initialIndex={7} />
      <FloatingWidget positionClass="left-[12%] bottom-[12%]" delay="8s" initialIndex={8} />
      <FloatingWidget positionClass="left-[35%] bottom-[8%]" delay="9s" initialIndex={9} />
      <FloatingWidget positionClass="right-[30%] bottom-[10%]" delay="10s" initialIndex={10} />
      <FloatingWidget positionClass="right-[10%] bottom-[15%]" delay="11s" initialIndex={11} />

      {/* Card Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="flex justify-center mb-3 cursor-pointer hover:scale-102 transition-transform" onClick={() => navigate('/')}>
            <img src={isDark ? rinoasistBannerDark : rinoasistBanner} alt="RinoAsist Logo" className="h-11 w-auto object-contain" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-txt-base">
            Registro de Alumno
          </h2>
          <p className="text-txt-muted mt-1 text-xs lg:text-sm">
            Completa tus datos para unirte al grupo asignado.
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-card/75 dark:bg-bg-card/65 backdrop-blur-xl border border-bdr-base/80 p-8 rounded-3xl shadow-2xl theme-transition relative">
          <div className={`absolute -inset-[1px] bg-gradient-to-r transition-all duration-500 rounded-3xl -z-10 pointer-events-none ${
            focusedField ? 'from-brand-primary/45 to-blue-400/35 blur-[2px]' : 'from-brand-primary/20 to-blue-500/20'
          }`}></div>

          {validating ? (
            // Validation State
            <div className="text-center space-y-4 py-8">
              <Loader2 className="w-10 h-10 animate-spin text-brand-primary mx-auto" />
              <h3 className="text-lg font-bold text-txt-base">Validando invitación...</h3>
              <p className="text-xs text-txt-muted">Por favor, espera mientras verificamos el token de seguridad.</p>
            </div>
          ) : success ? (
            // Success State
            <div className="text-center space-y-4 py-4 animate-scale-in">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-txt-base">Registro Completado</h3>
              <p className="text-sm text-txt-muted">
                Tu cuenta ha sido creada y vinculada con éxito. Redireccionando al inicio de sesión...
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                Iniciar Sesión ahora
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : error ? (
            // Error State
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-txt-base">Error de Validación</h3>
              <p className="text-sm text-txt-muted">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-bg-surface hover:bg-bg-surface-hover text-txt-base border border-bdr-base font-bold py-3.5 rounded-xl transition-all duration-300 cursor-pointer mt-4"
              >
                Volver al Login
              </button>
            </div>
          ) : (
            // Registration Form
            <form onSubmit={handleRegister} className="space-y-5">
              
              {/* Pre-assigned Email Badge */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-brand-primary/5 border border-brand-primary/10">
                <div className="flex items-center gap-2 text-brand-primary font-bold text-xs uppercase tracking-wider">
                  <Mail className="w-4 h-4" />
                  <span>Correo Institucional</span>
                </div>
                <p className="text-sm font-semibold text-txt-base select-all break-all">{email}</p>
                
                <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-wider mt-2.5 pt-2 border-t border-bdr-base/20">
                  <Users className="w-4 h-4" />
                  <span>Grupo Asignado</span>
                </div>
                <p className="text-sm font-semibold text-txt-base">{groupClave}</p>
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                  Nombre Completo
                </label>
                <div className="relative group">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center transition-all duration-300 ${
                    focusedField === 'nombre' ? 'text-brand-primary scale-110' : 'text-txt-subtle'
                  }`}>
                    <Users className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    onFocus={() => setFocusedField('nombre')}
                    onBlur={() => setFocusedField('')}
                    placeholder="Arturo Villegas Padilla"
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-3 pl-12 pr-10 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 focus:ring-brand-primary/10 hover:border-bdr-base/80 theme-transition"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                  Nueva Contraseña
                </label>
                <div className="relative group">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center transition-all duration-300 ${
                    focusedField === 'password'
                      ? password && (password.length >= 6 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password))
                        ? 'text-emerald-500 scale-110'
                        : 'text-brand-primary scale-110'
                      : password && (password.length >= 6 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password))
                        ? 'text-emerald-500'
                        : 'text-txt-subtle'
                  }`}>
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => {
                      setFocusedField('');
                      setCapsLockActive(false);
                    }}
                    onKeyDown={handlePasswordKeyDown}
                    onKeyUp={handlePasswordKeyDown}
                    placeholder="••••••••"
                    className={`w-full bg-bg-surface border rounded-xl py-3 pl-12 pr-12 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 hover:border-bdr-base/80 theme-transition ${
                      password
                        ? (password.length >= 6 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password))
                          ? 'border-emerald-500/40 focus:border-emerald-500 focus:ring-emerald-500/10'
                          : 'border-bdr-base focus:border-brand-primary focus:ring-brand-primary/10'
                        : 'border-bdr-base focus:border-brand-primary focus:ring-brand-primary/10'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-txt-subtle hover:text-brand-primary transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-1.5 pt-1 animate-fade-in">
                    <div className="flex justify-between text-[10px] font-bold text-txt-muted">
                      <span>Fortaleza: {strength.label}</span>
                      <span>{strength.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-bg-surface border border-bdr-base rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all duration-500`} style={{ width: `${strength.percent}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Password Requirements Checklist */}
                <div className="space-y-2 pt-2 border-t border-bdr-base/40 mt-1">
                  <span className="text-[10px] font-bold text-txt-subtle uppercase tracking-wider block">
                    Requisitos de la contraseña:
                  </span>
                  <div className="grid grid-cols-2 gap-2 pl-0.5">
                    {renderChecklistItem('Min. 6 caracteres', password.length >= 6)}
                    {renderChecklistItem('1 Mayúscula', /[A-Z]/.test(password))}
                    {renderChecklistItem('1 Número', /[0-9]/.test(password))}
                    {renderChecklistItem('1 Símbolo', /[^A-Za-z0-9]/.test(password))}
                  </div>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                  Confirmar Contraseña
                </label>
                <div className="relative group">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center transition-all duration-300 ${
                    focusedField === 'confirm'
                      ? confirmPassword
                        ? password === confirmPassword
                          ? 'text-emerald-500 scale-110'
                          : 'text-rose-500 scale-110'
                        : 'text-brand-primary scale-110'
                      : confirmPassword
                        ? password === confirmPassword
                          ? 'text-emerald-500'
                          : 'text-rose-500'
                        : 'text-txt-subtle'
                  }`}>
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => {
                      setFocusedField('');
                      setCapsLockActive(false);
                    }}
                    onKeyDown={handlePasswordKeyDown}
                    onKeyUp={handlePasswordKeyDown}
                    placeholder="••••••••"
                    className={`w-full bg-bg-surface border rounded-xl py-3 pl-12 pr-12 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 hover:border-bdr-base/80 theme-transition ${
                      confirmPassword
                        ? password === confirmPassword
                          ? 'border-emerald-500/40 focus:border-emerald-500 focus:ring-emerald-500/10'
                          : 'border-rose-500/40 focus:border-rose-500 focus:ring-rose-500/10'
                        : 'border-bdr-base focus:border-brand-primary focus:ring-brand-primary/10'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-txt-subtle hover:text-brand-primary transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password Match Status */}
                {confirmPassword && (
                  <div className={`mt-2 p-2.5 rounded-xl border flex items-center gap-2 transition-all duration-300 ${
                    password === confirmPassword 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-455 animate-pulse'
                  }`}>
                    {password === confirmPassword ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span className="text-xs font-semibold">
                      {password === confirmPassword ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                    </span>
                  </div>
                )}
              </div>

              {/* Caps Lock Alert */}
              {capsLockActive && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-semibold animate-pulse mt-1 pl-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Bloqueo de Mayúsculas activado</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-hover disabled:bg-brand-primary/80 disabled:opacity-60 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    Completar Registro
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-txt-subtle hover:text-brand-primary transition-colors font-semibold cursor-pointer"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
}
