import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../services/api';
import { ArrowLeft, Camera, QrCode, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import rhinoMascot from '../assets/rhino_mascot.png';
import { useTheme } from '../context/ThemeContext';
import rinoasistBanner from '../assets/rinoasist_banner.png';
import rinoasistBannerDark from '../assets/rinoasist_banner_dark.png';

const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La geolocalización no está soportada por tu navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        let msg = 'Error al obtener la ubicación GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Acceso de geolocalización denegado. Es obligatorio permitir la localización para verificar que estás dentro del aula.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'La ubicación no está disponible. Asegúrate de tener activado el GPS.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tiempo de espera agotado al obtener la ubicación.';
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
};

export default function ScanAttendance() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [user] = useState(() => api.getCurrentUser());
  const [status, setStatus] = useState({ type: '', message: '' }); // 'success' | 'error' | 'loading'
  const [manualToken, setManualToken] = useState('');
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef(null);
  const containerId = 'qr-reader-container';
  const [confettiParticles, setConfettiParticles] = useState([]);

  const triggerConfetti = () => {
    const particles = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100, // percentage
      delay: Math.random() * 1.5, // seconds
      duration: 2.5 + Math.random() * 2, // seconds
      size: 6 + Math.random() * 10, // px
      color: ['#0052cc', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
      angle: Math.random() * 360
    }));
    setConfettiParticles(particles);
  };

  useEffect(() => {
    // 1. Intercept URL token on mount
    const queryParams = new URLSearchParams(window.location.search);
    const urlToken = queryParams.get('token');
    if (urlToken) {
      localStorage.setItem('pending_scan_token', urlToken);
      // Clean query parameters from address bar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // If not logged in and we have a token (either just scanned or pending), go to login
      const hasPending = localStorage.getItem('pending_scan_token');
      if (hasPending) {
        navigate('/login');
      }
      return;
    }

    const tokenToRegister = localStorage.getItem('pending_scan_token');
    if (tokenToRegister) {
      // Automatically register attendance using GPS without turning on the camera
      setScanning(false);
      
      const autoRegister = async () => {
        try {
          setStatus({ type: 'loading', message: 'Obteniendo tu ubicación GPS...' });
          const coords = await getCurrentLocation();
          
          setStatus({ type: 'loading', message: 'Registrando tu asistencia de forma automática...' });
          const res = await api.scanAttendance(tokenToRegister, coords.lat, coords.lon);
          
          setStatus({ type: 'success', message: res.message || '¡Asistencia registrada correctamente!' });
          localStorage.removeItem('pending_scan_token');
          triggerConfetti();
        } catch (err) {
          setStatus({ type: 'error', message: err.message || 'No se pudo registrar asistencia.' });
          localStorage.removeItem('pending_scan_token'); // Clear so it doesn't loop on refresh
        }
      };

      autoRegister();
      return; // Skip mounting camera scanner
    }

    // Initialize regular camera scanner
    const scanner = new Html5QrcodeScanner(containerId, {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      aspectRatio: 1.0
    });

    scanner.render(
      async (decodedText) => {
        // Parse token if student scanned the full URL inside the app
        let finalToken = decodedText;
        if (decodedText.includes('/scan?token=')) {
          try {
            const urlObj = new URL(decodedText);
            finalToken = urlObj.searchParams.get('token') || decodedText;
          } catch {
            // fallback if URL constructor fails on relative paths
            const match = decodedText.match(/[?&]token=([^&]+)/);
            if (match) finalToken = match[1];
          }
        }

        setScanning(false);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.warn(err));
        }

        try {
          setStatus({ type: 'loading', message: 'Obteniendo ubicación GPS...' });
          const coords = await getCurrentLocation();
          
          setStatus({ type: 'loading', message: 'Registrando asistencia...' });
          const res = await api.scanAttendance(finalToken, coords.lat, coords.lon);
          setStatus({ type: 'success', message: res.message || '¡Asistencia registrada correctamente!' });
          triggerConfetti();
        } catch (err) {
          setStatus({ type: 'error', message: err.message || 'No se pudo registrar asistencia.' });
        }
      },
      () => {
        // Silent error
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.log('Clean up scanner error:', err));
      }
    };
  }, [user, navigate]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualToken.trim()) {
      setStatus({ type: 'error', message: 'Por favor, introduce un código válido.' });
      return;
    }

    // Deactivate scanning immediately on submission
    setScanning(false);
    if (scannerRef.current) {
      scannerRef.current.clear().catch(err => console.warn(err));
    }

    try {
      setStatus({ type: 'loading', message: 'Obteniendo ubicación GPS...' });
      const coords = await getCurrentLocation();

      setStatus({ type: 'loading', message: 'Registrando asistencia con código manual...' });
      const res = await api.scanAttendance(manualToken.trim(), coords.lat, coords.lon);
      setStatus({ type: 'success', message: res.message || '¡Asistencia registrada correctamente!' });
      setManualToken('');
      triggerConfetti();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'No se pudo registrar asistencia con este código.' });
    }
  };

  const handleRetry = () => {
    setStatus({ type: '', message: '' });
    setScanning(true);
    setConfettiParticles([]); // Clear old confetti
    // Restart scanner
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(containerId, {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
      });
      scanner.render(
        async (decodedText) => {
          // Deactivate scanner immediately on read to prevent duplicate scans
          setScanning(false);
          scanner.clear().catch(err => console.warn(err));

          try {
            setStatus({ type: 'loading', message: 'Obteniendo ubicación GPS...' });
            const coords = await getCurrentLocation();

            setStatus({ type: 'loading', message: 'Registrando asistencia...' });
            const res = await api.scanAttendance(decodedText, coords.lat, coords.lon);
            setStatus({ type: 'success', message: res.message || '¡Asistencia registrada correctamente!' });
            triggerConfetti();
          } catch (err) {
            setStatus({ type: 'error', message: err.message || 'No se pudo registrar asistencia.' });
          }
        },
        () => {}
      );
      scannerRef.current = scanner;
    }, 100);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-base text-txt-base flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-10 h-10 text-brand-primary animate-spin" />
        <span className="font-semibold text-txt-muted">Cargando escáner...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-txt-base flex flex-col justify-between theme-transition selection:bg-brand-primary selection:text-white pb-10">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-bdr-base backdrop-blur-md sticky top-0 z-50 bg-bg-base/80 theme-transition">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-txt-muted hover:text-brand-primary font-semibold text-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al panel</span>
        </button>

        <div className="flex items-center gap-4">
          <img src={isDark ? rinoasistBannerDark : rinoasistBanner} alt="RinoAsist Logo" className="h-9 w-auto object-contain" />
          <span className="text-[9px] bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
            Alumno
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-6 py-10 flex-grow flex flex-col items-center justify-center max-w-xl">
        <div className="text-center space-y-3 mb-8">
          <span className="inline-flex items-center gap-1.5 bg-brand-primary/10 border border-brand-primary/20 px-3.5 py-1 rounded-full text-brand-primary text-xs font-semibold uppercase tracking-wider">
            <Camera className="w-3.5 h-3.5" />
            Escanear Asistencia
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight">Registro Automatizado</h2>
          <p className="text-txt-muted text-sm max-w-md mx-auto leading-relaxed">
            Permite el uso de tu cámara para leer el código QR que se proyecta en el pizarrón del aula.
          </p>
        </div>

        {/* Mascot Helper Banner */}
        <div className="w-full max-w-md bg-brand-primary/5 border border-brand-primary/10 rounded-2xl p-4 mb-6 flex items-center gap-4 theme-transition hover:border-brand-primary/30">
          <img src={rhinoMascot} alt="Rino" className="w-14 h-14 object-contain shrink-0 drop-shadow-md animate-pulse" />
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Consejo de Rino</h4>
            <p className="text-xs text-txt-muted leading-relaxed">
              Alinea el código QR del pizarrón dentro del recuadro. ¡Mantén tu dispositivo estable para registrarte!
            </p>
          </div>
        </div>

        {/* Status Alerts */}
        {status.message && (
          <div className={`w-full max-w-md p-4 mb-6 rounded-2xl border flex items-start gap-3.5 text-sm animate-fadeIn ${
            status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
            status.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' :
            'bg-brand-primary/10 border-brand-primary/20 text-brand-primary animate-pulse'
          }`}>
            {status.type === 'success' && <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />}
            {status.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />}
            {status.type === 'loading' && <RefreshCw className="w-5 h-5 shrink-0 text-brand-primary animate-spin" />}
            <div className="space-y-1">
              <p className="font-semibold leading-tight">
                {status.type === 'success' ? '¡Operación Exitosa!' :
                 status.type === 'error' ? 'Error Detectado' :
                 'Procesando...'}
              </p>
              <p className="text-xs opacity-90">{status.message}</p>
            </div>
          </div>
        )}

        {/* Scanner Container */}
        {scanning ? (
          <div className="w-full max-w-md bg-bg-card border border-bdr-base rounded-3xl p-6 shadow-xl relative theme-transition overflow-hidden group">
            {/* Camera mounting target */}
            <div id={containerId} className="w-full rounded-2xl overflow-hidden bg-bg-surface border border-bdr-base shadow-inner aspect-square [&_video]:object-cover [&_a]:hidden [&_button]:bg-brand-primary [&_button]:text-white [&_button]:px-4 [&_button]:py-2 [&_button]:rounded-xl [&_button]:font-semibold [&_button]:cursor-pointer [&_select]:bg-bg-card [&_select]:border [&_select]:border-bdr-base [&_select]:rounded-xl [&_select]:py-2 [&_select]:px-3"></div>
            
            {/* Overlay indicators */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-48 h-48 border border-brand-primary/20 rounded-2xl flex items-center justify-center transition-all duration-300">
              <div className="w-5 h-5 border-t-4 border-l-4 border-brand-primary absolute top-0 left-0 rounded-tl-lg"></div>
              <div className="w-5 h-5 border-t-4 border-r-4 border-brand-primary absolute top-0 right-0 rounded-tr-lg"></div>
              <div className="w-5 h-5 border-b-4 border-l-4 border-brand-primary absolute bottom-0 left-0 rounded-bl-lg"></div>
              <div className="w-5 h-5 border-b-4 border-r-4 border-brand-primary absolute bottom-0 right-0 rounded-br-lg"></div>
              
              {/* Holographic matrix scanning grid overlay */}
              <div className="absolute inset-2 bg-[linear-gradient(to_bottom,rgba(0,82,204,0.03)_1px,transparent_1px),linear-gradient(to_right,rgba(0,82,204,0.03)_1px,transparent_1px)] bg-[size:14px_14px] rounded-lg"></div>
              
              {/* Scanning neon laser line animation */}
              <div className="w-full h-[3px] bg-brand-primary shadow-[0_0_12px_#3b82f6,0_0_4px_#3b82f6] absolute animate-laser-scan"></div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md bg-bg-card border border-bdr-base rounded-3xl p-8 shadow-xl text-center space-y-6 theme-transition animate-fadeIn">
            <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto text-brand-primary border border-brand-primary/20">
              <QrCode className="w-10 h-10" />
            </div>
            <div>
              <h4 className="font-bold text-lg">¿Quieres escanear de nuevo?</h4>
              <p className="text-xs text-txt-muted mt-1 leading-relaxed">
                Si deseas escanear otro pase de lista o tuviste algún problema, puedes reiniciar la cámara.
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full bg-brand-primary hover:bg-brand-hover text-white font-bold py-3.5 rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.02] cursor-pointer"
            >
              Reiniciar Cámara
            </button>
          </div>
        )}



        {/* Manual Input Section */}
        {scanning && (
          <div className="w-full max-w-md mt-8 border-t border-bdr-base pt-8 space-y-4 theme-transition">
            <div className="space-y-1">
              <h3 className="font-bold text-sm">¿Falla en la cámara?</h3>
              <p className="text-xs text-txt-subtle leading-relaxed">
                Introduce el código de texto alfanumérico que se muestra debajo del código QR del profesor.
              </p>
            </div>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Ej. mock-qr-token-for-101-12345"
                className="flex-grow bg-bg-surface border border-bdr-base rounded-xl px-4 py-3 text-sm focus:border-brand-primary outline-none theme-transition"
              />
              <button
                type="submit"
                className="bg-brand-primary hover:bg-brand-hover text-white px-5 rounded-xl text-sm font-semibold shadow shadow-brand-primary/10 hover:scale-[1.02] cursor-pointer"
              >
                Registrar
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Confetti Overlay */}
      {confettiParticles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[999]">
          {confettiParticles.map(p => (
            <div
              key={p.id}
              className="absolute rounded-sm animate-confetti-fall"
              style={{
                left: `${p.left}%`,
                top: `-20px`,
                width: `${p.size}px`,
                height: `${p.size * 0.6}px`,
                backgroundColor: p.color,
                transform: `rotate(${p.angle}deg)`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                opacity: 0.8
              }}
            />
          ))}
        </div>
      )}

      {/* Custom Confetti Animation Style */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti-fall {
          animation-name: confetti-fall;
          animation-timing-function: ease-out;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
