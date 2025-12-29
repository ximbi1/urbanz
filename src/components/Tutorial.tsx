import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Trophy, MapPin, Zap, Target, Users, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import TerritoryDiagram from './TerritoryDiagram';

interface TutorialProps {
  onClose: () => void;
  autoShow?: boolean;
}

const tutorialSteps = [
  {
    title: '¡Bienvenido a URBANZ!',
    description: 'Traza tus carreras y convierte la ciudad en tu tablero. Conquista, defiende y desafía a tus amigos mientras sumas puntos.',
    icon: Trophy,
    image: '🏃‍♂️',
  },
  {
    title: 'Forma polígonos',
    description: 'Mientras corres, traza un camino que forme un polígono cerrado. Cuando completes el círculo, ¡conquistarás ese territorio!',
    icon: MapPin,
    image: '🔷',
    highlight: 'El polígono debe cerrarse para ser válido',
  },
  {
    title: 'Conquista y superpón',
    description: 'Si corres por dentro de un territorio ajeno (sin escudo), solo te quedas con la porción que recorriste. Pero si rodeas completamente un territorio más pequeño, ¡te lo quedas entero!',
    icon: Zap,
    image: '🔥',
    highlight: 'Superponer > robar parcial. Ritmo rápido = bonificación',
    hasDiagram: true,
  },
  {
    title: 'Gana puntos y sube de nivel',
    description: 'Cada territorio conquistado te da puntos según su área. Acumula puntos para subir de nivel y desbloquear logros especiales.',
    icon: Trophy,
    image: '⭐',
    highlight: 'Consulta tu progreso en el perfil',
  },
  {
    title: 'Sistema de ligas',
    description: '¡Compite con otros runners en tu liga! Acumula puntos para subir de Bronce a Leyenda y enfrentarte a los mejores.',
    icon: Users,
    image: '🏆',
    highlight: 'Accede a las ligas desde el icono del trofeo',
  },
  {
    title: 'Liga Social',
    description: 'Activa el modo Liga Social desde tu perfil para correr en grupo. Los territorios conquistados se comparten con tus compañeros de liga.',
    icon: Users,
    image: '👥',
    highlight: 'Perfil → Liga Social (switch)',
  },
  {
    title: 'Misiones rotativas',
    description: 'Cada 2 días cambian las misiones disponibles (ciclo de 10 días). Los fines de semana aparecen misiones especiales con +50% de recompensas y escudos extra.',
    icon: Target,
    image: '🎯',
    highlight: 'Revisa Retos para ver las misiones activas',
  },
  {
    title: 'Escudos y centro de defensa',
    description: 'Compra escudos y aplícalos a tus territorios desde tu perfil. En el mapa verás un halo dorado en las zonas protegidas.',
    icon: Target,
    image: '🛡️',
    highlight: 'Perfil → Centro de defensa',
  },
  {
    title: 'Duelos 1v1',
    description: 'Reta a tus amigos desde la sección "Amigos". El progreso de distancia, puntos o territorios se actualiza automáticamente.',
    icon: Users,
    image: '⚔️',
    highlight: 'Pestaña Amigos → Duelos activos',
  },
  {
    title: 'Modo offline + sync',
    description: 'Sin conexión, seguimos guardando tus carreras. Cuando vuelvas a estar online se sincronizan solas o desde el banner de estado.',
    icon: HelpCircle,
    image: '📶',
    highlight: 'Mira el banner offline en la pantalla principal',
  },
  {
    title: 'Importa y revive tus runs',
    description: 'Sube archivos GPX/TCX desde el perfil y actívalos en 3D con el "Run Replay". Perfecto para revivir conquistas o analizar rutas.',
    icon: MapPin,
    image: '🎬',
    highlight: 'Perfil → Importar carrera',
  },
];

const Tutorial = ({ onClose, autoShow = false }: TutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoShow) {
      const hasSeenTutorial = localStorage.getItem('urbanz-tutorial-seen');
      if (hasSeenTutorial) {
        setIsVisible(false);
        onClose();
      }
    }
  }, [autoShow, onClose]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('urbanz-tutorial-seen', 'true');
    setIsVisible(false);
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('urbanz-tutorial-seen', 'true');
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md z-[70] flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-2xl bg-gradient-to-br from-card to-card/80 border-2 border-primary/30 p-6 md:p-8 space-y-6 animate-scale-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-sm text-muted-foreground">
                Paso {currentStep + 1} de {tutorialSteps.length}
              </h2>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress Bar */}
        <Progress value={progress} className="h-2" />

        {/* Content */}
        <div className="space-y-4 text-center py-4">
          {!step.hasDiagram && (
            <div className="text-7xl mb-4 animate-scale-in" style={{ animationDelay: '0.1s' }}>
              {step.image}
            </div>
          )}
          
          <div className="space-y-2">
            <h3 className="text-2xl md:text-3xl font-display font-bold glow-primary animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {step.title}
            </h3>
            <p className="text-base text-muted-foreground max-w-xl mx-auto animate-fade-in" style={{ animationDelay: '0.3s' }}>
              {step.description}
            </p>
          </div>

          {/* Territory Diagram for conquest step */}
          {step.hasDiagram && (
            <div className="animate-fade-in mt-2" style={{ animationDelay: '0.35s' }}>
              <TerritoryDiagram />
            </div>
          )}

          {step.highlight && (
            <div className="inline-block mt-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <p className="text-sm font-semibold text-primary flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                {step.highlight}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-4 pt-4 border-t border-border">
          <div className="flex justify-center">
            <div className="flex gap-2">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-primary'
                      : index < currentStep
                      ? 'w-2 bg-primary/50'
                      : 'w-2 bg-border'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>

            {currentStep === tutorialSteps.length - 1 ? (
              <Button onClick={handleFinish} className="gap-2">
                ¡Empezar!
                <Trophy className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleNext} className="gap-2">
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Skip Button */}
        <div className="text-center pt-2">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Saltar tutorial
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Tutorial;
