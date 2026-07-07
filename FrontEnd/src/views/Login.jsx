import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getSchoolCycle } from '../services/api';
import { Calendar, Lock, Mail, AlertCircle, ArrowRight, Loader2, Info, Layers, QrCode, Eye, EyeOff, Check, X, Users, CheckCircle2, TrendingUp, BookOpen, Clock, FileText, Award, ShieldAlert, Bell, UserCheck } from 'lucide-react';


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
  { Icon: TrendingUp, label: "Deserción", color: "text-rose-500", animateClass: "animate-float-reverse" },
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


export default function Login() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');
  
  // Link Institutional Email Modal States
  const [showLinkEmailModal, setShowLinkEmailModal] = useState(false);
  const [linkCurrentEmail, setLinkCurrentEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkInstitutionalEmail, setLinkInstitutionalEmail] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkError, setLinkError] = useState('');



  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Por favor, ingresa tu correo.');
      return;
    }
    
    setForgotLoading(true);
    setForgotError('');
    
    try {
      await api.forgotPassword(forgotEmail);
      setForgotSuccess(true);
    } catch (err) {
      setForgotError(err.message || 'Error al enviar el enlace de recuperación.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotSuccess(false);
    setForgotError('');
  };

  const handleLinkEmail = async (e) => {
    e.preventDefault();
    if (!linkCurrentEmail || !linkPassword || !linkInstitutionalEmail) {
      setLinkError('Por favor, completa todos los campos.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkInstitutionalEmail)) {
      setLinkError('Ingresa un correo institucional válido.');
      return;
    }

    setLinkLoading(true);
    setLinkError('');

    try {
      await api.linkInstitutionalEmail(linkCurrentEmail, linkPassword, linkInstitutionalEmail);
      setLinkSuccess(true);
    } catch (err) {
      setLinkError(err.message || 'Error al vincular el correo institucional.');
    } finally {
      setLinkLoading(false);
    }
  };

  const closeLinkEmailModal = () => {
    setShowLinkEmailModal(false);
    setLinkCurrentEmail('');
    setLinkPassword('');
    setLinkInstitutionalEmail('');
    setLinkSuccess(false);
    setLinkError('');
  };

  const isForgotEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail);

  // Prefill email if previously remembered
  useEffect(() => {
    const savedEmail = localStorage.getItem('remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handlePasswordKeyDown = (e) => {
    const isCaps = e.getModifierState('CapsLock');
    setCapsLockActive(isCaps);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.login(email, password);
      // Persist email if rememberMe is checked
      if (rememberMe) {
        localStorage.setItem('remember_email', email);
      } else {
        localStorage.removeItem('remember_email');
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="min-h-screen bg-bg-base text-txt-base flex flex-col justify-center items-center p-6 relative overflow-hidden theme-transition isolate">
      {/* Absolute Theme Toggle at top right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -z-10 animate-float-slow"></div>

      {/* Grayscale Rhino Watermark on the right side */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[85vw] h-[85vh] lg:w-[48vw] lg:h-[95vh] opacity-[0.16] dark:opacity-[0.06] pointer-events-none select-none -z-20 grayscale contrast-75 mix-blend-multiply dark:mix-blend-screen dark:invert transition-opacity duration-300">
        <img 
          src={rhinoSilhouette} 
          alt="Rino Marca de Agua" 
          className="w-full h-full object-contain object-right"
        />
      </div>

      {/* Floating Decorative Elements with staggered fade-in-out loops (Alternating Icons in Background) */}
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





      {/* Centered Login Form */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="flex justify-center mb-3 cursor-pointer hover:scale-102 transition-transform" onClick={() => navigate('/')}>
            <img src={isDark ? rinoasistBannerDark : rinoasistBanner} alt="RinoAsist Logo" className="h-11 w-auto object-contain" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-txt-base">
            Bienvenido a RinoAsist
          </h2>
          <p className="text-txt-muted mt-1 text-xs lg:text-sm">
            Ingresa tus credenciales para acceder al control de asistencias.
          </p>
          <div className="flex justify-center gap-2.5 mt-2.5">
            <span className="inline-flex items-center gap-1.5 text-[9px] text-brand-primary font-bold bg-brand-primary/10 border border-brand-primary/15 px-2.5 py-0.5 rounded-full select-none">
              <Layers className="w-3 h-3 text-brand-primary" />
              Ciclo Escolar: {getSchoolCycle()}
            </span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-bg-card/75 dark:bg-bg-card/65 backdrop-blur-xl border border-bdr-base/80 p-8 rounded-3xl shadow-2xl theme-transition relative">
          <div className={`absolute -inset-[1px] bg-gradient-to-r transition-all duration-500 rounded-3xl -z-10 pointer-events-none ${
            focusedField === 'email' ? 'from-brand-primary/45 to-blue-400/35 blur-[2px]' :
            focusedField === 'password' ? 'from-indigo-500/45 to-brand-primary/35 blur-[2px]' :
            'from-brand-primary/20 to-blue-500/20'
          }`}></div>

          <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Error Notification */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-455 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                  Correo Electrónico
                </label>
                <div className="relative group">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center transition-all duration-300 ${
                    focusedField === 'email' ? 'text-brand-primary scale-110' : 'text-txt-subtle'
                  }`}>
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField('')}
                    placeholder="nombre@escuela.com"
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-3 pl-12 pr-10 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 focus:ring-brand-primary/10 hover:border-bdr-base/80 theme-transition"
                  />
                  {isEmailValid && (
                    <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-emerald-500 transition-all duration-300">
                      <Check className="w-5 h-5 animate-pulse" />
                    </span>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                  Contraseña
                </label>
                <div className="relative group">
                  <span className={`absolute inset-y-0 left-0 pl-4 flex items-center transition-all duration-300 ${
                    focusedField === 'password' ? 'text-brand-primary scale-110' : 'text-txt-subtle'
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
                    className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-3 pl-12 pr-12 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 focus:ring-brand-primary/10 hover:border-bdr-base/80 theme-transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-txt-subtle hover:text-brand-primary transition-colors duration-250 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Caps Lock Alert */}
                {capsLockActive && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-semibold animate-pulse mt-1 pl-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Bloqueo de Mayúsculas activado</span>
                  </div>
                )}

                {/* Remember Me and Forgot Password */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-300 ${
                      rememberMe 
                        ? 'bg-brand-primary border-brand-primary text-white scale-105 shadow-md shadow-brand-primary/20' 
                        : 'border-bdr-base bg-bg-surface group-hover:border-txt-subtle'
                    }`}>
                      {rememberMe && (
                        <svg className="w-3.5 h-3.5 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-txt-muted group-hover:text-txt-base transition-colors">
                      Recordarme
                    </span>
                  </label>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-brand-primary hover:text-brand-hover transition-colors font-semibold cursor-pointer bg-transparent border-none p-0 outline-none"
                    >
                      ¿La olvidaste?
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLinkEmailModal(true)}
                      className="text-[11px] text-brand-primary/95 hover:text-brand-hover transition-colors font-semibold cursor-pointer bg-transparent border-none p-0 outline-none"
                    >
                      ¿Vincular correo institucional?
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-hover disabled:bg-brand-primary/80 disabled:opacity-60 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-txt-subtle hover:text-brand-primary transition-colors font-semibold cursor-pointer"
          >
            ← Volver a la página de bienvenida
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-bg-card/95 backdrop-blur-xl border border-bdr-base max-w-md w-full p-8 rounded-3xl shadow-2xl relative animate-scale-in theme-transition">
            {/* Close Button */}
            <button
              onClick={closeForgotModal}
              className="absolute top-5 right-5 text-txt-subtle hover:text-brand-primary transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {forgotSuccess ? (
              // Success State
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-txt-base">¡Enlace enviado!</h3>
                <p className="text-sm text-txt-muted">
                  Hemos enviado las instrucciones para restablecer tu contraseña al correo: <br />
                  <strong className="text-brand-primary">{forgotEmail}</strong>
                </p>
                <button
                  onClick={closeForgotModal}
                  className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-3.5 rounded-xl transition-all duration-300 cursor-pointer mt-4"
                >
                  Entendido
                </button>
              </div>
            ) : (
              // Form State
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-3">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-txt-base">Recuperar Contraseña</h3>
                  <p className="text-xs text-txt-muted mt-1">
                    Ingresa tu correo registrado y te enviaremos un enlace para restablecer tu cuenta.
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4 mt-2">
                  {/* Error Notification */}
                  {forgotError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-450 px-4 py-3 rounded-xl flex items-center gap-3 text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <p>{forgotError}</p>
                    </div>
                  )}

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                      Correo Electrónico
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-txt-subtle">
                        <Mail className="w-5 h-5" />
                      </span>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="nombre@escuela.com"
                        className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-3 pl-12 pr-10 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 focus:ring-brand-primary/10 theme-transition"
                      />
                      {isForgotEmailValid && (
                        <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-emerald-500 transition-all duration-300">
                          <Check className="w-5 h-5 animate-pulse" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-brand-primary hover:bg-brand-hover disabled:bg-brand-primary/80 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-primary/10 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar enlace
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Institutional Email Modal */}
      {showLinkEmailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-bg-card/95 backdrop-blur-xl border border-bdr-base max-w-md w-full p-8 rounded-3xl shadow-2xl relative animate-scale-in theme-transition">
            {/* Close Button */}
            <button
              onClick={closeLinkEmailModal}
              className="absolute top-5 right-5 text-txt-subtle hover:text-brand-primary transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {linkSuccess ? (
              // Success State
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-txt-base">¡Vinculación Exitosa!</h3>
                <p className="text-sm text-txt-muted">
                  Tu cuenta ha sido actualizada con éxito. A partir de ahora deberás iniciar sesión con tu correo institucional: <br />
                  <strong className="text-brand-primary">{linkInstitutionalEmail}</strong>
                </p>
                <button
                  onClick={closeLinkEmailModal}
                  className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-3.5 rounded-xl transition-all duration-300 cursor-pointer mt-4"
                >
                  Entendido
                </button>
              </div>
            ) : (
              // Form State
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-3">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-txt-base">Vincular Correo Institucional</h3>
                  <p className="text-xs text-txt-muted mt-1">
                    Ingresa tus credenciales actuales (con el correo generado) y escribe tu correo institucional oficial.
                  </p>
                </div>

                <form onSubmit={handleLinkEmail} className="space-y-4 mt-2">
                  {/* Error Notification */}
                  {linkError && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-450 px-4 py-3 rounded-xl flex items-center gap-3 text-xs">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <p>{linkError}</p>
                    </div>
                  )}

                  {/* Current Generated Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                      Correo Temporal (ej: nombre.apellido)
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-txt-subtle">
                        <Mail className="w-5 h-5" />
                      </span>
                      <input
                        type="email"
                        value={linkCurrentEmail}
                        onChange={(e) => setLinkCurrentEmail(e.target.value)}
                        placeholder="nombre.apellido@tesci.edu.mx"
                        className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-3 pl-12 pr-10 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 focus:ring-brand-primary/10 theme-transition"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                      Contraseña Actual
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-txt-subtle">
                        <Lock className="w-5 h-5" />
                      </span>
                      <input
                        type="password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-3 pl-12 pr-10 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 focus:ring-brand-primary/10 theme-transition"
                      />
                    </div>
                  </div>

                  {/* New Institutional Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-txt-muted uppercase tracking-wider block">
                      Nuevo Correo Institucional
                    </label>
                    <div className="relative group">
                      <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-txt-subtle">
                        <UserCheck className="w-5 h-5" />
                      </span>
                      <input
                        type="email"
                        value={linkInstitutionalEmail}
                        onChange={(e) => setLinkInstitutionalEmail(e.target.value)}
                        placeholder="ejemplo@tesci.edu.mx"
                        className="w-full bg-bg-surface border border-bdr-base focus:border-brand-primary rounded-xl py-3 pl-12 pr-10 text-txt-base placeholder-txt-subtle/50 outline-none transition-all duration-300 focus:ring-4 focus:ring-brand-primary/10 theme-transition"
                      />
                    </div>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={linkLoading}
                    className="w-full bg-brand-primary hover:bg-brand-hover disabled:bg-brand-primary/80 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-primary/10 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {linkLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Vinculando correo...
                      </>
                    ) : (
                      <>
                        Vincular Correo Oficial
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
