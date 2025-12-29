import { ArrowLeft, MapPin, Heart, Users, Trophy, Zap, Target, HelpCircle, Shield, FileText, ChevronDown, Mail, Globe, Smartphone, Map, Timer, Swords, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate, Link } from 'react-router-dom';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const About = () => {
  const navigate = useNavigate();

  const faqs = [
    {
      question: "¿Qué es URBANZ exactamente?",
      answer: "URBANZ es una aplicación de gamificación para corredores que convierte tus rutas en territorios. Cuando corres y cierras un polígono con tu recorrido, ese área se convierte en tu territorio. Puedes defender tus zonas, robar las de otros y competir en ligas semanales."
    },
    {
      question: "¿Cómo funciona la conquista de territorios?",
      answer: "Para conquistar un territorio debes correr formando un polígono cerrado. El área mínima es de 10.000 m² y el sistema registra tu ritmo promedio. Si otro corredor quiere robar tu territorio, debe superar tu ritmo en esa misma zona. Tras conquistar, tu territorio tiene 24 horas de protección."
    },
    {
      question: "¿Qué son los escudos y cómo los consigo?",
      answer: "Los escudos son protecciones especiales para tus territorios que duran 48 horas adicionales. Puedes obtenerlos completando misiones diarias/semanales, retos de mapa, o consiguiendo logros. Son recursos valiosos para defender zonas estratégicas."
    },
    {
      question: "¿Cómo funcionan las ligas?",
      answer: "Cada semana compites en una liga con ~50 corredores de nivel similar. Los puntos se ganan conquistando territorios, completando misiones y retos. Al final de la semana, los mejores ascienden a ligas superiores (Bronce → Plata → Oro → Platino → Diamante → Élite) y los últimos descienden."
    },
    {
      question: "¿Puedo jugar sin conexión?",
      answer: "Sí, URBANZ funciona offline. Tu carrera se graba localmente y se sincroniza cuando recuperas conexión. Los territorios y conquistas se procesan una vez que el servidor recibe los datos."
    },
    {
      question: "¿Por qué necesita acceso al GPS?",
      answer: "El GPS es esencial para registrar tu ruta con precisión. URBANZ solo accede a tu ubicación durante las carreras activas y nunca comparte datos de localización con terceros. Puedes ver más detalles en nuestra política de privacidad."
    },
    {
      question: "¿Qué son los clanes?",
      answer: "Los clanes son grupos de corredores que comparten territorios y misiones colectivas. Puedes crear o unirte a un clan para competir en eventos grupales, compartir logros y ver la actividad de tu equipo en el feed del clan."
    },
    {
      question: "¿Cómo se evitan las trampas?",
      answer: "URBANZ tiene múltiples validaciones: verificación de velocidad máxima realista, detección de saltos GPS imposibles, validación de área mínima, y análisis de patrones de movimiento. Las carreras sospechosas se rechazan automáticamente."
    },
    {
      question: "¿La app consume mucha batería?",
      answer: "El uso de GPS durante carreras consume batería, pero URBANZ está optimizada para minimizar el impacto. Recomendamos llevar el móvil cargado para carreras largas. La app no consume batería cuando no estás corriendo."
    },
    {
      question: "¿Puedo importar carreras de otras apps?",
      answer: "Sí, puedes importar archivos GPX de apps como Strava, Garmin, etc. Las carreras importadas se procesan igual que las nativas, con las mismas validaciones y reglas de conquista."
    }
  ];

  const features = [
    {
      icon: Map,
      title: "Mapa en tiempo real",
      description: "Visualiza todos los territorios conquistados en tu ciudad, con colores de cada jugador y filtros por liga."
    },
    {
      icon: Target,
      title: "Conquista territorial",
      description: "Cierra polígonos corriendo para reclamar zonas. Cuanto mayor el área y mejor tu ritmo, más puntos."
    },
    {
      icon: Swords,
      title: "Robos y defensas",
      description: "Supera el ritmo del dueño para robar su territorio. Los escudos y cooldowns equilibran la competición."
    },
    {
      icon: Crown,
      title: "Sistema de ligas",
      description: "Compite semanalmente contra corredores de tu nivel. Asciende a ligas superiores demostrando constancia."
    },
    {
      icon: Timer,
      title: "Misiones y retos",
      description: "Objetivos diarios, semanales y retos de mapa que te dan puntos extra y escudos."
    },
    {
      icon: Users,
      title: "Clanes",
      description: "Únete o crea grupos de corredores para misiones colectivas y ver el progreso de tu equipo."
    },
    {
      icon: Trophy,
      title: "Logros",
      description: "Desbloquea medallas por hitos de distancia, territorios conquistados y rachas de actividad."
    },
    {
      icon: Smartphone,
      title: "Modo offline",
      description: "Corre sin conexión y sincroniza después. Tu carrera nunca se pierde."
    }
  ];

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

      <main className="pt-20 pb-8 px-4 container mx-auto max-w-2xl space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25">
            <MapPin className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-4xl font-display font-bold glow-primary">URBANZ</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            La app que convierte cada carrera en una batalla por tu ciudad. Conquista territorios, defiende tus zonas y compite contra otros runners.
          </p>
        </div>

        {/* Qué es URBANZ */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">¿Qué es URBANZ?</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            URBANZ es una Progressive Web App (PWA) que gamifica tus carreras convirtiéndolas en conquistas territoriales. Cada vez que corres y cierras un polígono con tu ruta, ese área se convierte en tu territorio. Otros corredores pueden intentar robártelo, pero solo si superan tu ritmo.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            La app funciona como una aplicación nativa en iOS y Android, con notificaciones push, modo offline y acceso completo al GPS. No necesitas descargar nada de las tiendas: simplemente añádela a tu pantalla de inicio desde el navegador.
          </p>
        </Card>

        {/* Cómo empezó */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-xl font-bold">Cómo empezó</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Soy un runner y desarrollador que se hartó de salir a trotar sin motivación. Quise mezclar la emoción de conquistar zonas en juegos de estrategia con el esfuerzo real de correr por mi ciudad. Así nació URBANZ: dibujar polígonos con tus rutas y convertirlos en territorios reales que puedes defender.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Todo el diseño, código y backend los he levantado en solitario, iterando constantemente con feedback de otros corredores. Cada pantalla, mecánica y validación viene de probar qué motiva más a seguir corriendo y salir a conquistar.
          </p>
        </Card>

        {/* Desarrollo en solitario */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-bold">Desarrollo indie</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Empecé trazando parques y barrios de Barcelona para darle contexto real a cada conquista. El stack tecnológico incluye React + TypeScript para el frontend, Supabase para autenticación y base de datos, Edge Functions para la lógica del servidor, Mapbox para renderizado de mapas y Capacitor para el empaquetado nativo.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Lo que ves es fruto de muchas madrugadas afinando validaciones de ritmo, protecciones, misiones, retos de mapa y duelos 1v1. Todo centrado en que cada carrera cuente y puedas ver tu progreso pintado en el mapa de tu ciudad.
          </p>
        </Card>

        {/* Características principales */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Características principales</h3>
          </div>
          
          <div className="grid gap-3">
            {features.map((feature, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{feature.title}</p>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Fair Play */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-xl font-bold">Competición justa</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            El fair play es fundamental en URBANZ. El sistema incluye múltiples capas de validación para garantizar que solo las carreras legítimas cuenten:
          </p>
          <ul className="text-muted-foreground space-y-2 list-disc list-inside">
            <li>Verificación de velocidad máxima realista (no puedes correr a 60 km/h)</li>
            <li>Detección de saltos GPS imposibles entre puntos consecutivos</li>
            <li>Área mínima de 10.000 m² para evitar micro-territorios</li>
            <li>Análisis de patrones de movimiento para detectar GPS spoofing</li>
            <li>Cooldowns de ataque para evitar el spam de robos</li>
            <li>Protección post-conquista de 24 horas</li>
          </ul>
        </Card>

        {/* Comunidad */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-bold">Comunidad</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Aunque URBANZ es un proyecto indie desarrollado por una sola persona, la comunidad es el motor de su evolución. Cada feature nueva nace del feedback real de corredores: los clanes, los retos de mapa, el sistema de misiones, los replays de carrera... todo salió de sugerencias y necesidades reales.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Si tienes ideas, encuentras bugs o quieres colaborar, puedes contactar directamente. URBANZ crece contigo.
          </p>
        </Card>

        {/* FAQs */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Preguntas frecuentes</h3>
          </div>
          
          <Card className="p-4">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-border">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <span className="text-sm font-medium">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>

        {/* Legal Links */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold">Información legal</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            Al usar URBANZ aceptas nuestros términos de servicio y política de privacidad. Te recomendamos leerlos para entender cómo protegemos tus datos y qué se espera de los usuarios.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/terms">
                <FileText className="w-4 h-4 mr-2" />
                Términos de Servicio
              </Link>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/privacy">
                <Shield className="w-4 h-4 mr-2" />
                Política de Privacidad
              </Link>
            </Button>
          </div>
        </Card>

        {/* Contacto */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">Contacto</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            ¿Tienes dudas, sugerencias o has encontrado un bug? Puedes escribir a:
          </p>
          <a 
            href="mailto:soporte@urbanz.app" 
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <Mail className="w-4 h-4" />
            soporte@urbanz.app
          </a>
        </Card>

        {/* Footer */}
        <div className="text-center py-6 space-y-3">
          <p className="text-muted-foreground text-sm">
            Hecho con ❤️ para la comunidad runner
          </p>
          <p className="text-xs text-muted-foreground">
            Versión 1.0.0 · Barcelona, España
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Términos
            </Link>
            <span className="text-xs text-muted-foreground">·</span>
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Privacidad
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;
