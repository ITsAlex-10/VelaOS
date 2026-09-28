import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { googleSignIn, logout } from '../lib/firebase';
import { VelaLogo } from '../components/VelaLogo';

interface LoginPageProps {
  onLogin: (token?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('vela_remember_me') === 'true';
  });
  
  const spotlightX = useMotionValue(0);
  const spotlightY = useMotionValue(0);
  const springX = useSpring(spotlightX, { stiffness: 150, damping: 30 });
  const springY = useSpring(spotlightY, { stiffness: 150, damping: 30 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      spotlightX.set(e.clientX);
      spotlightY.set(e.clientY);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [spotlightX, spotlightY]);

  const allowedEmails = [
    'alexandrecpsousa@gmail.com', 
    'vela.web.team@gmail.com',
    'andreafonso082@gmail.com'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (email) {
      const normalized = email.toLowerCase().trim();
      const isAllowed = allowedEmails.some(ae => ae.toLowerCase().trim() === normalized);
      if (!isAllowed) {
        setErrorMessage(`Acesso negado (${email}). E-mail não autorizado pela equipa Vela.`);
        return;
      }
    }
    
    if (rememberMe) {
      localStorage.setItem('vela_access_token', 'DEMO_USER');
    } else {
      sessionStorage.setItem('vela_access_token', 'DEMO_USER');
    }
    onLogin('DEMO_USER');
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        const userEmail = result.user.email?.toLowerCase().trim();
        if (userEmail && !allowedEmails.some(ae => ae.toLowerCase().trim() === userEmail)) {
          setErrorMessage(`Acesso negado (${userEmail}). E-mail não autorizado pela equipa Vela.`);
          await logout();
          return;
        }
        
        if (rememberMe) {
          localStorage.setItem('vela_access_token', result.accessToken);
        } else {
          sessionStorage.setItem('vela_access_token', result.accessToken);
        }
        
        onLogin(result.accessToken);
      }
    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação foi fechada antes de completar.');
      } else {
        setErrorMessage('Ocorreu um erro na autenticação. Tente novamente.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen w-full cinematic-bg flex flex-col items-center justify-center p-6 md:p-0 overflow-hidden relative font-sans">
      {/* Ambient Lighting Effects */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: useTransform(
            [springX, springY],
            ([x, y]) => `radial-gradient(1200px circle at ${x}px ${y}px, rgba(255, 180, 169, 0.02), transparent 70%)`
          )
        }}
      />
      
      <main className="relative z-10 w-full max-w-[440px]">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-12"
        >
          <div className="flex items-center justify-center mb-8">
            <VelaLogo 
              variant="stacked"
              className="w-[200px] h-[200px] transition-transform duration-300 hover:scale-105"
              style={{ width: '200px', height: '200px' }}
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold text-white tracking-tight leading-tight mb-3 px-6">Trabalha de forma inteligente com a Vela OS.</h1>
            <p className="text-zinc-500 text-sm">Integração nativa com Google Workspace</p>
          </div>
        </motion.div>

        {/* Login Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card inner-glow rounded-xl p-10 md:p-12"
        >
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-8 p-4 rounded-xl bg-vela-red/10 border border-vela-red/20 text-vela-red text-[10px] font-black uppercase tracking-widest text-center font-sans"
            >
              {errorMessage}
            </motion.div>
          )}

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Social Login */}
            <button 
              type="button"
              disabled={isLoggingIn}
              onClick={handleGoogleLogin}
              className="group w-full flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 py-3.5 px-4 rounded-xl transition-all duration-300 shadow-sm disabled:opacity-50"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.53l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"></path>
                </svg>
              )}
              <span className="text-xs font-normal text-white uppercase tracking-widest">{isLoggingIn ? 'A autenticar...' : 'Continuar com o Google'}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="w-full h-px bg-white/5"></div>
              <span className="absolute bg-[#0D0D0F] px-4 text-[9px] text-zinc-700 font-black tracking-[0.3em] uppercase font-sans">OU</span>
            </div>

            {/* Credentials Form */}
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] font-sans block ml-1">Endereço de E-mail</label>
                <input 
                  className="w-full bg-[#0D0D0F]/50 border border-white/5 focus:border-vela-red/30 focus:ring-0 rounded-xl py-4 px-5 text-white placeholder:text-zinc-700 transition-all text-sm font-sans" 
                  placeholder="name@agency.com" 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] font-sans block">Palavra-passe</label>
                  <a className="text-[10px] text-vela-red font-black uppercase tracking-widest hover:underline" href="#">Esqueceste-te da palavra-passe?</a>
                </div>
                <div className="relative">
                  <input 
                    className="w-full bg-[#0D0D0F]/50 border border-white/5 focus:border-vela-red/30 focus:ring-0 rounded-xl py-4 px-5 text-white placeholder:text-zinc-700 transition-all text-sm font-sans tracking-widest" 
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center gap-3 select-none ml-1 py-1">
              <label className="relative flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberMe(checked);
                    localStorage.setItem('vela_remember_me', checked ? 'true' : 'false');
                  }}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 rounded-lg border border-white/5 bg-[#0D0D0F]/50 flex items-center justify-center transition-all peer-checked:bg-vela-red/20 peer-checked:border-vela-red/45 peer-focus-visible:ring-1 peer-focus-visible:ring-vela-red/30">
                  <div className={`w-2.5 h-2.5 rounded-md bg-vela-red transition-all scale-0 ${rememberMe ? 'scale-100' : ''}`} />
                </div>
              </label>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest font-sans">Manter sessão iniciada</span>
            </div>

            <motion.button 
              whileTap={{ scale: 0.98 }}
              className="w-full bg-vela-red hover:bg-vela-red/90 text-white font-normal py-4.5 rounded-xl transition-all shadow-2xl shadow-vela-red/20 text-xs uppercase tracking-[0.2em]" 
              type="submit"
            >
              Iniciar Sessão
            </motion.button>

            <button 
              type="button"
              onClick={() => {
                if (rememberMe) {
                  localStorage.setItem('vela_access_token', 'GUEST_TOKEN');
                } else {
                  sessionStorage.setItem('vela_access_token', 'GUEST_TOKEN');
                }
                onLogin('GUEST_TOKEN');
              }}
              className="w-full mt-4 text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] hover:text-white transition-all py-2 font-sans"
            >
              — Entrar sem sessão —
            </button>
          </form>

          <p className="mt-10 text-center text-[11px] text-zinc-500 uppercase tracking-widest font-normal">
            Não tens uma conta? <a className="text-white hover:underline transition-colors ml-1" href="#">Contacta o teu agente</a>
          </p>
        </motion.div>

        {/* Footer Links */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-16 flex justify-center gap-10"
        >
          <a className="text-[10px] text-zinc-600 font-black uppercase tracking-widest hover:text-zinc-400 transition-colors" href="#">Política de Privacidade</a>
          <a className="text-[10px] text-zinc-600 font-black uppercase tracking-widest hover:text-zinc-400 transition-colors" href="#">Termos de Serviço</a>
          <a className="text-[10px] text-zinc-600 font-black uppercase tracking-widest hover:text-zinc-400 transition-colors" href="#">Suporte</a>
        </motion.div>
      </main>

      {/* Background Decoration */}
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-vela-red/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 -right-24 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
};
