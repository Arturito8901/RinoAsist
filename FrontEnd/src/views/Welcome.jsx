import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, QrCode, ArrowRight, Activity, Layers, Leaf, Zap, ChevronDown } from 'lucide-react';
import { getSchoolCycle } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import rhinoMascot from '../assets/rhino_mascot.png';
import { useTheme } from '../context/ThemeContext';
import rinoasistBanner from '../assets/rinoasist_banner.png';
import rinoasistBannerDark from '../assets/rinoasist_banner_dark.png';

export default function Welcome() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [welcomeTime, setWelcomeTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setWelcomeTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Rino Mascot Dialogues Cycling
  const rinoQuotes = [
    "¡Hola! Soy Rino. ¡Explora las preguntas frecuentes para conocer más de mí! 🦏",
    "¿Sabías que puedes descargar reportes de asistencia en Excel y PDF en un clic? 📊",
    "¡RinoAsist genera alertas de tendencia si un alumno falta seguido! 📉",
    "Los estudiantes pueden registrar su entrada usando códigos QR dinámicos. 📱",
    "¡Evita el papeleo y ahorra árboles! RinoAsist es 100% ecológico. 🍃",
    "¿Sabías que mi materia favorita es Programación Web? 💻"
  ];
  const [rinoQuoteIdx, setRinoQuoteIdx] = useState(0);
  const [faqMode, setFaqMode] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  const faqList = [
    {
      q: "¿Cómo funciona el auto-registro QR?",
      a: "¡Es muy simple! El docente proyecta un código QR dinámico que rota cada 15 segundos en el pizarrón. El alumno lo escanea con la cámara de su celular y el pase de lista se registra en la base de datos de inmediato."
    },
    {
      q: "¿Qué pasa si llego tarde?",
      a: "El sistema calcula las tolerancias automáticamente: hasta 10 min es Asistencia, entre 10 y 20 min es Retardo, y después de los 20 min se registra como Falta."
    },
    {
      q: "¿Cómo se justifica una falta?",
      a: "En el panel del Alumno, en la pestaña 'Justificantes', puedes solicitar un justificante indicando motivos y fechas, y subir un comprobante. El docente o el administrador lo aprueban para quitar la falta."
    },
    {
      q: "¿Qué es el semáforo de deserción?",
      a: "Es una herramienta que ayuda a tutores y administradores a detectar alumnos en riesgo de reprobación o abandono por inasistencias acumuladas (menos del 80% de asistencia real) y enviarles alertas preventivas."
    },
    {
      q: "¿Cómo descargo los reportes?",
      a: "Tanto docentes como administradores pueden exportar reportes de asistencia y bitácoras completas en formato PDF oficial de tutoría o planillas de Excel automatizadas con un solo clic."
    }
  ];

  const cycleRinoQuote = () => {
    if (faqMode) return;
    setRinoQuoteIdx(prev => (prev + 1) % rinoQuotes.length);
  };

  // Auto-play Rino quotes every 6 seconds, but only if not in FAQ mode
  useEffect(() => {
    if (faqMode) return;
    const timer = setInterval(() => {
      setRinoQuoteIdx(prev => (prev + 1) % rinoQuotes.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [rinoQuotes.length, faqMode]);

  return (
    <div className="min-h-screen bg-bg-base text-txt-base flex flex-col justify-between theme-transition selection:bg-brand-primary selection:text-white relative overflow-hidden">
      {/* Decorative Floating Background Auroras */}
      <div className="absolute top-20 right-[-10%] w-[450px] h-[450px] bg-brand-primary/10 dark:bg-brand-primary/5 rounded-full blur-[100px] -z-10 animate-float-slow"></div>
      <div className="absolute bottom-20 left-[-10%] w-[400px] h-[400px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[90px] -z-10 animate-float-reverse"></div>
      <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-blue-400/5 dark:bg-blue-400/2 rounded-full blur-[85px] -z-10"></div>

      {/* Header / Navbar */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-bdr-base backdrop-blur-md sticky top-0 z-50 bg-bg-base/80 theme-transition">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate('/')}>
          <img src={isDark ? rinoasistBannerDark : rinoasistBanner} alt="RinoAsist Logo" className="h-10 w-auto object-contain" />
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button 
            onClick={() => navigate('/login')}
            className="relative group overflow-hidden bg-brand-primary hover:bg-brand-hover text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-350 shadow-md hover:shadow-xl hover:shadow-brand-primary/20 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              Iniciar Sesión
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-12 md:py-24 flex flex-col lg:flex-row items-center justify-between gap-12 flex-grow relative z-10">
        {/* Left column */}
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="flex flex-wrap justify-center lg:justify-start gap-2.5">
            <div className="inline-flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 px-4 py-1.5 rounded-full text-brand-primary text-sm font-semibold">
              <Activity className="w-4 h-4 text-brand-primary animate-pulse" />
              Control de Asistencia Inteligente v2.0
            </div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-600 dark:text-emerald-450 text-sm font-semibold">
              <Layers className="w-4 h-4 text-emerald-500" />
              Ciclo Escolar: {getSchoolCycle()}
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Digitaliza el control de{' '}
            <span className="bg-gradient-to-r from-brand-primary to-blue-500 bg-clip-text text-transparent">
              asistencias
            </span>{' '}
            en tu aula.
          </h1>

          <p className="text-txt-muted text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Una plataforma moderna, rápida y segura diseñada para docentes y administradores. Realiza pases de lista digitales, genera reportes instantáneos y conecta con tus alumnos.
          </p>

          <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-4">
            <button
              onClick={() => navigate('/login')}
              className="bg-brand-primary hover:bg-brand-hover text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
            >
              Comenzar ahora
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="#caracteristicas"
              className="bg-bg-surface hover:bg-bg-surface/80 border border-bdr-base text-txt-base font-semibold px-8 py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300"
            >
              Conocer más
            </a>
          </div>

          {/* Micro stats banner */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-bdr-base max-w-lg mx-auto lg:mx-0 theme-transition">
            <div className="bg-bg-surface/50 border border-bdr-base/50 p-3 rounded-2xl flex flex-col items-center lg:items-start gap-1 hover:border-brand-primary/30 hover:scale-[1.02] transition-all duration-300">
              <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg w-fit">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xl font-bold mt-1 text-txt-base">99.8%</div>
              <div className="text-[10px] font-extrabold text-txt-subtle uppercase tracking-wider">Fiabilidad</div>
            </div>

            <div className="bg-emerald-500/5 dark:bg-emerald-500/2 border border-emerald-500/10 dark:border-emerald-500/5 p-3 rounded-2xl flex flex-col items-center lg:items-start gap-1 hover:border-emerald-500/35 hover:scale-[1.02] transition-all duration-300 group/stat">
              <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 p-1.5 rounded-lg w-fit group-hover/stat:bg-emerald-500 group-hover/stat:text-white transition-colors duration-300">
                <Leaf className="w-4 h-4" />
              </div>
              <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">0 Papel</div>
              <div className="text-[10px] font-extrabold text-txt-subtle uppercase tracking-wider">Ecológico</div>
            </div>

            <div className="bg-bg-surface/50 border border-bdr-base/50 p-3 rounded-2xl flex flex-col items-center lg:items-start gap-1 hover:border-brand-primary/30 hover:scale-[1.02] transition-all duration-300">
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg w-fit">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-xl font-bold mt-1 text-txt-base">&lt; 1s</div>
              <div className="text-[10px] font-extrabold text-txt-subtle uppercase tracking-wider">Pase Rápido</div>
            </div>
          </div>
        </div>

        {/* Right column (Interactive Mock UI Graphic) */}
        <div className="flex-1 w-full max-w-lg mx-auto relative group">
          {/* Decorative glowing gradient behind the image card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-emerald-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>

          {/* Premium Glassmorphic App Mockup */}
          <div className="relative bg-bg-card/75 dark:bg-bg-card/60 backdrop-blur-xl border border-bdr-base/80 rounded-2xl p-6 shadow-2xl theme-transition">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-bdr-base theme-transition">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="text-xs text-txt-muted bg-bg-surface/80 border border-bdr-base px-3 py-1 rounded-full font-mono theme-transition">
                rinoasist.app/security-center
              </div>
            </div>

            <div className="space-y-4 text-left">
              {/* Header with connection badge */}
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/15 p-3.5 rounded-xl theme-transition select-none">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Seguridad de Asistencia Activa
                  </span>
                </div>
                <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  EN PRODUCCIÓN
                </span>
              </div>

              {/* GPS Geofence details */}
              <div className="bg-bg-surface/50 border border-bdr-base/60 p-4 rounded-xl space-y-2 theme-transition">
                <div className="text-[10px] text-brand-primary font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping"></span>
                  Monitoreo de Geocercas (TESCI)
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-txt-subtle uppercase block">Ubicación Campus</span>
                    <span className="text-txt-base">19.645391, -99.216391</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-txt-subtle uppercase block">Radio Permitido</span>
                    <span className="text-txt-base">150 metros</span>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-500 font-bold mt-1 flex items-center gap-1">
                  ✓ Validación de coordenadas GPS requerida obligatoriamente en el servidor.
                </div>
              </div>

              {/* QR Code Security Dynamics */}
              <div className="bg-bg-surface/50 border border-bdr-base/60 p-4 rounded-xl space-y-2.5 theme-transition">
                <div className="text-[10px] text-brand-primary font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 bg-brand-primary rounded-full"></span>
                  Pase de Lista Dinámico & Anti-Screenshot
                </div>
                
                <div className="flex items-center justify-between border-b border-bdr-base/40 pb-2">
                  <div className="space-y-0.5 text-xs font-semibold">
                    <span className="text-[9px] text-txt-subtle uppercase block">Reloj de Sincronía en Vivo</span>
                    <span className="font-mono text-sm tracking-wider font-extrabold text-txt-base">{welcomeTime}</span>
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border border-emerald-500/15 text-[9px] font-extrabold px-2.5 py-1 rounded-lg uppercase select-none tracking-widest animate-pulse">
                    ● En Vivo
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-txt-muted">
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-500">✓</span> Rotación QR: 15s
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-500">✓</span> Tolerancia: 20 min
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-500">✓</span> Encriptación: SHA-256
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-500">✓</span> Sesiones: JWT Token
                  </div>
                </div>
              </div>

              {/* Database Connection Status */}
              <div className="bg-bg-surface/50 border border-bdr-base/60 p-4 rounded-xl flex items-center justify-between theme-transition text-xs font-semibold">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-txt-subtle uppercase block">Base de Datos Principal</span>
                  <span className="text-txt-base">dbo.RegistrosAsistencia</span>
                </div>
                <div className="bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] px-2.5 py-1 rounded-lg font-bold">
                  SQL Server Activo
                </div>
              </div>
            </div>
          </div>

          {/* Mascot Integration */}
          <div 
            className="absolute -bottom-8 -left-6 sm:-left-12 flex items-end gap-2.5 z-20 transition-all duration-300 select-none group/mascot"
          >
            <img 
              src={rhinoMascot} 
              alt="Rino" 
              onClick={cycleRinoQuote}
              className={`w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-xl hover:scale-[1.04] transition-transform duration-300 ${faqMode ? 'cursor-default' : 'cursor-pointer active:scale-95'}`} 
            />
            <div className={`bg-bg-card/95 backdrop-blur-md border border-bdr-base/80 px-4 py-3.5 rounded-2xl rounded-bl-none shadow-2xl relative theme-transition transition-all duration-300 ${
              faqMode 
                ? 'w-[280px] sm:w-[340px]' 
                : 'w-[150px] sm:w-[200px]'
            }`}>
              
              {!faqMode ? (
                <>
                  <p className="font-semibold text-txt-base text-[10px] sm:text-xs leading-normal">{rinoQuotes[rinoQuoteIdx]}</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFaqMode(true);
                      setActiveFaq(null);
                    }}
                    className="block text-[8px] sm:text-[9px] text-brand-primary mt-1.5 font-extrabold hover:underline animate-pulse cursor-pointer"
                  >
                    💬 Preguntas Frecuentes
                  </button>
                </>
              ) : !activeFaq ? (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center border-b border-bdr-base/60 pb-1.5">
                    <span className="font-bold text-[9px] sm:text-[10px] text-brand-primary uppercase tracking-wider">
                      Preguntas Frecuentes
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFaqMode(false);
                      }}
                      className="text-[9px] text-txt-subtle hover:text-brand-primary font-bold cursor-pointer hover:underline"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {faqList.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFaq(item);
                        }}
                        className="w-full text-left bg-bg-surface hover:bg-brand-primary/5 hover:text-brand-primary text-[10px] sm:text-[11px] font-semibold py-1.5 px-2.5 rounded-xl border border-bdr-base/40 hover:border-brand-primary/30 transition-all duration-200 block cursor-pointer"
                      >
                        {item.q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="border-b border-bdr-base/60 pb-1.5 flex justify-between items-center">
                    <span className="font-bold text-[9px] sm:text-[10px] text-brand-primary uppercase tracking-wider">Rino responde:</span>
                  </div>
                  <p className="font-semibold text-[11px] sm:text-xs leading-relaxed text-txt-base">{activeFaq.a}</p>
                  <div className="flex justify-between items-center pt-2 border-t border-bdr-base/60">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFaq(null);
                      }}
                      className="text-[9px] sm:text-[10px] text-brand-primary hover:underline font-extrabold cursor-pointer"
                    >
                      ← Volver a preguntas
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFaqMode(false);
                        setActiveFaq(null);
                      }}
                      className="text-[9px] sm:text-[10px] text-txt-subtle hover:text-brand-primary font-bold cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
              
              <div className="absolute left-0 bottom-0 w-2 h-2 bg-bg-card border-l border-b border-bdr-base transform -translate-x-1/2 rotate-45"></div>
            </div>
          </div>
        </div>

        {/* Scroll Down Indicator */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 hidden md:flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity duration-300 pointer-events-none select-none z-30">
          <span className="text-[9px] font-extrabold tracking-widest uppercase text-txt-subtle animate-pulse">Deslizar</span>
          <ChevronDown className="w-5 h-5 text-brand-primary animate-bounce" />
        </div>
      </main>

      {/* Section Transition Wave */}
      <div className="w-full overflow-hidden leading-[0] bg-bg-base theme-transition">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[50px] fill-current text-bg-surface theme-transition">
          <path d="M0,0 C150,90 350,90 500,60 C650,30 850,30 1000,60 C1150,90 1200,60 1200,0 L1200,120 L0,120 Z"></path>
        </svg>
      </div>

      {/* Features Grid */}
      <section id="caracteristicas" className="bg-bg-surface pb-20 pt-10 theme-transition relative z-10">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">Todo lo que necesitas en un solo lugar</h2>
            <p className="text-txt-muted">Olvídate del papel y de las hojas de Excel obsoletas. Gestiona tu escuela con eficiencia digital.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-bg-card border border-bdr-base hover:border-brand-primary/45 p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand-primary/5 group transition-all duration-300 theme-transition">
              <div className="bg-brand-primary/10 text-brand-primary w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-primary group-hover:text-white transition-all duration-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Pase de Lista Ágil</h3>
              <p className="text-txt-muted text-sm leading-relaxed">Pasa lista de todo tu grupo con un par de clics o mediante atajos rápidos de teclado. Organizado por colores interactivos.</p>
            </div>

            <div className="bg-bg-card border border-bdr-base hover:border-brand-primary/45 p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand-primary/5 group transition-all duration-300 theme-transition">
              <div className="bg-brand-primary/10 text-brand-primary w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-primary group-hover:text-white transition-all duration-300">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Escáner QR Escolar</h3>
              <p className="text-txt-muted text-sm leading-relaxed">Genera códigos QR únicos para que tus alumnos registren su asistencia mediante sus propios dispositivos móviles.</p>
            </div>

            <div className="bg-bg-card border border-bdr-base hover:border-brand-primary/45 p-6 rounded-2xl hover:-translate-y-1.5 hover:shadow-xl hover:shadow-brand-primary/5 group transition-all duration-300 theme-transition">
              <div className="bg-brand-primary/10 text-brand-primary w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-primary group-hover:text-white transition-all duration-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-2">Reportes en Tiempo Real</h3>
              <p className="text-txt-muted text-sm leading-relaxed">Visualiza KPIs de asistencia, alumnos en riesgo académico y exporta reportes detallados en PDF o Excel en segundos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bg-base py-8 border-t border-bdr-base text-center text-sm text-txt-subtle theme-transition">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 RinoAsist. Desarrollado con Vite + React & Tailwind CSS.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-brand-primary transition-colors">Términos de servicio</a>
            <a href="#" className="hover:text-brand-primary transition-colors">Política de privacidad</a>
            <a href="#" className="hover:text-brand-primary transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
