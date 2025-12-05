import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, Trophy, Users, Loader2 } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success('¡Bienvenido de vuelta!');
      } else {
        await signUp(email, password, username);
        toast.success('¡Cuenta creada exitosamente!', {
          description: '📧 Revisa tu correo electrónico para verificar tu cuenta antes de iniciar sesión.',
          duration: 7000,
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        
        {/* Animated grid */}
        <div className="absolute inset-0 opacity-20">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
              animation: 'gridMove 20s linear infinite',
            }}
          />
        </div>

        {/* Floating icons */}
        <div className="absolute top-1/4 left-1/4 animate-[float_6s_ease-in-out_infinite]">
          <div className="p-4 rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="absolute top-1/3 right-1/4 animate-[float_8s_ease-in-out_infinite_1s]">
          <div className="p-4 rounded-2xl bg-secondary/10 backdrop-blur-sm border border-secondary/20">
            <Trophy className="w-8 h-8 text-secondary" />
          </div>
        </div>
        <div className="absolute bottom-1/3 left-1/3 animate-[float_7s_ease-in-out_infinite_0.5s]">
          <div className="p-4 rounded-2xl bg-accent/10 backdrop-blur-sm border border-accent/20">
            <Users className="w-8 h-8 text-accent" />
          </div>
        </div>

        {/* Glowing orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      {/* Main content */}
      <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo and title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 shadow-lg shadow-primary/25">
            <MapPin className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-display font-bold glow-primary tracking-wider">
            URBANZ
          </h1>
          <p className="text-muted-foreground text-lg">
            Conquista territorios mientras corres
          </p>
        </div>

        {/* Form card */}
        <div className="relative">
          {/* Card glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 rounded-2xl blur-lg opacity-75" />
          
          <form 
            onSubmit={handleSubmit} 
            className="relative space-y-5 bg-card/80 backdrop-blur-xl p-8 rounded-xl border border-border/50 shadow-2xl"
          >
            {/* Tab switcher */}
            <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                  isLogin 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                  !isLogin 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Email input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="bg-background/50 border-border/50 focus:border-primary transition-colors"
              />
            </div>

            {/* Username input (only for signup) */}
            <div className={`space-y-2 overflow-hidden transition-all duration-300 ${
              !isLogin ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <label className="text-sm font-medium text-foreground">Nombre de usuario</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="runner123"
                required={!isLogin}
                className="bg-background/50 border-border/50 focus:border-primary transition-colors"
              />
            </div>

            {/* Password input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-background/50 border-border/50 focus:border-primary transition-colors"
              />
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                'Entrar'
              ) : (
                'Crear cuenta'
              )}
            </Button>

            {/* Features list */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center mb-3">
                ¿Qué podrás hacer?
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/30">
                  <MapPin className="w-4 h-4 mx-auto text-primary mb-1" />
                  <p className="text-xs text-muted-foreground">Conquistar</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <Trophy className="w-4 h-4 mx-auto text-secondary mb-1" />
                  <p className="text-xs text-muted-foreground">Competir</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <Users className="w-4 h-4 mx-auto text-accent mb-1" />
                  <p className="text-xs text-muted-foreground">Socializar</p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes gridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(60px, 60px);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }
      `}</style>
    </div>
  );
};

export default Auth;
