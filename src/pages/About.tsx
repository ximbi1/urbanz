import { ArrowLeft, MapPin, Heart, Users, Trophy, Zap, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-display font-bold">Sobre URBANZ</h1>
        </div>
      </header>

      <main className="pt-20 pb-8 px-4 container mx-auto max-w-2xl space-y-6">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25">
            <MapPin className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-4xl font-display font-bold glow-primary">URBANZ</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Una PWA creada por un solo dev para gamificar tus carreras y reclamar tu ciudad a base de sudor.
          </p>
        </div>

        {/* La Idea */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Cómo empezó</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Soy un runner y desarrollador que se hartó de salir a trotar sin chispa. Quise mezclar la emoción de conquistar zonas en juegos de estrategia con el esfuerzo real de correr por mi ciudad. Así nació URBANZ: dibujar polígonos con tus rutas y convertirlos en territorios reales.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Todo el diseño, código y backend los he levantado en solitario, iterando con feedback de otros corredores. Cada pantalla, escudo y validación viene de probar qué motiva más a seguir corriendo.
          </p>
        </Card>

        {/* Los Inicios */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-xl font-bold">Iterando en solitario</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Empecé trazando parques y barrios de Barcelona para darle contexto real a cada conquista. Después añadí Supabase para auth y funciones edge, Mapbox para el mapa, Capacitor para usarla como app nativa y React + Tailwind para una UI rápida y pulida.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Lo que ves es fruto de muchas madrugadas afinando validaciones de ritmo, protecciones, misiones, retos de mapa y duelos 1v1. Todo centrado en que cada carrera cuente y puedas ver tu progreso en el mapa.
          </p>
        </Card>

        {/* Características */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-bold">Qué hace único a URBANZ</h3>
          </div>
          
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Conquista con tus pasos</p>
                <p className="text-sm text-muted-foreground">
                  Cada polígono que cierras corriendo es territorio real, con protección, cooldowns y escudos para defenderlo.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="font-semibold">Competición limpia</p>
                <p className="text-sm text-muted-foreground">
                  Para robar debes superar el ritmo del dueño. Validaciones de GPS, área y velocidad mantienen el juego justo.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-accent mt-0.5" />
              <div>
                <p className="font-semibold">Un solo dev, comunidad real</p>
                <p className="text-sm text-muted-foreground">
                  Aunque construyo solo, cada feature nace del feedback de la comunidad: clanes, retos de mapa, misiones y replays salieron de sus ideas.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 space-y-2">
          <p className="text-muted-foreground text-sm">
            Hecho con ❤️ para la comunidad runner
          </p>
          <p className="text-xs text-muted-foreground">
            Versión 1.0.0
          </p>
        </div>
      </main>
    </div>
  );
};

export default About;
