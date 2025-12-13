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
            Conquista territorios mientras corres. Compite, socializa y domina tu ciudad.
          </p>
        </div>

        {/* La Idea */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">¿Cómo surgió la idea?</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            URBANZ nació de la pasión por correr y la gamificación. Queríamos crear algo más 
            que una simple app de running: buscábamos una experiencia que transformara cada 
            carrera en una aventura urbana. La idea era simple pero poderosa: ¿y si cada vez 
            que corres pudieras conquistar territorios reales de tu ciudad?
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Inspirados en juegos de estrategia territorial y en la comunidad runner, 
            diseñamos un sistema donde cada paso cuenta, donde puedes robar territorios 
            a otros corredores y defender los tuyos con tu rendimiento. No se trata solo 
            de correr más, sino de correr mejor.
          </p>
        </Card>

        {/* Los Inicios */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-xl font-bold">Los inicios</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            El proyecto comenzó en Barcelona, ciudad de runners por excelencia. 
            Empezamos mapeando parques, barrios y fuentes de agua para crear un 
            ecosistema de puntos de interés que enriquecieran la experiencia.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Poco a poco fuimos añadiendo características: el sistema de ligas para 
            competir semanalmente, los clanes para colaborar con amigos, las misiones 
            diarias para mantener la motivación, y los escudos para proteger tus 
            territorios más preciados.
          </p>
        </Card>

        {/* Características */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-bold">¿Qué hace especial a URBANZ?</h3>
          </div>
          
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Territorios reales</p>
                <p className="text-sm text-muted-foreground">
                  Cada carrera dibuja un polígono en el mapa que se convierte en tu territorio.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-secondary mt-0.5" />
              <div>
                <p className="font-semibold">Competición justa</p>
                <p className="text-sm text-muted-foreground">
                  Para robar un territorio, debes correr más rápido que el dueño actual.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-accent mt-0.5" />
              <div>
                <p className="font-semibold">Comunidad activa</p>
                <p className="text-sm text-muted-foreground">
                  Únete a clanes, completa misiones colaborativas y sube en las ligas.
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
