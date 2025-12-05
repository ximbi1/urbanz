import { cn } from '@/lib/utils';
import { MapPin, Users, Bell, Calendar, Trophy, Target, Swords } from 'lucide-react';
import { Button } from './button';

type EmptyStateType = 'runs' | 'territories' | 'friends' | 'notifications' | 'challenges' | 'achievements' | 'duels';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const emptyStateConfig: Record<EmptyStateType, {
  icon: React.ElementType;
  defaultTitle: string;
  defaultDescription: string;
  iconColor: string;
  bgGradient: string;
}> = {
  runs: {
    icon: Calendar,
    defaultTitle: 'Sin carreras todavía',
    defaultDescription: 'Sal a correr y conquista tu primer territorio. Cada paso cuenta.',
    iconColor: 'text-primary',
    bgGradient: 'from-primary/20 via-primary/5 to-transparent',
  },
  territories: {
    icon: MapPin,
    defaultTitle: 'Sin territorios conquistados',
    defaultDescription: 'Corre por tu zona para reclamar territorios y ganar puntos.',
    iconColor: 'text-secondary',
    bgGradient: 'from-secondary/20 via-secondary/5 to-transparent',
  },
  friends: {
    icon: Users,
    defaultTitle: 'Sin amigos todavía',
    defaultDescription: 'Busca a otros corredores y añádelos para competir juntos.',
    iconColor: 'text-accent',
    bgGradient: 'from-accent/20 via-accent/5 to-transparent',
  },
  notifications: {
    icon: Bell,
    defaultTitle: 'Sin notificaciones',
    defaultDescription: 'Aquí aparecerán las alertas de territorios, amigos y logros.',
    iconColor: 'text-primary',
    bgGradient: 'from-primary/20 via-primary/5 to-transparent',
  },
  challenges: {
    icon: Target,
    defaultTitle: 'Sin desafíos activos',
    defaultDescription: 'Los desafíos semanales aparecerán aquí. ¡Vuelve pronto!',
    iconColor: 'text-warning',
    bgGradient: 'from-[hsl(var(--warning))]/20 via-[hsl(var(--warning))]/5 to-transparent',
  },
  achievements: {
    icon: Trophy,
    defaultTitle: 'Sin logros desbloqueados',
    defaultDescription: 'Corre más, conquista territorios y desbloquea logros épicos.',
    iconColor: 'text-[hsl(var(--warning))]',
    bgGradient: 'from-[hsl(var(--warning))]/20 via-[hsl(var(--warning))]/5 to-transparent',
  },
  duels: {
    icon: Swords,
    defaultTitle: 'Sin duelos activos',
    defaultDescription: 'Reta a tus amigos a duelos 1v1 para ver quién es el mejor.',
    iconColor: 'text-destructive',
    bgGradient: 'from-destructive/20 via-destructive/5 to-transparent',
  },
};

export const EmptyState = ({ 
  type, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) => {
  const config = emptyStateConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-6 text-center',
      className
    )}>
      {/* Animated icon container */}
      <div className={cn(
        'relative w-24 h-24 mb-6 rounded-full flex items-center justify-center',
        'bg-gradient-to-br',
        config.bgGradient,
        'animate-pulse'
      )}>
        {/* Decorative rings */}
        <div className="absolute inset-0 rounded-full border border-border/30 animate-[ping_3s_ease-in-out_infinite]" />
        <div className="absolute inset-2 rounded-full border border-border/20" />
        
        {/* Icon */}
        <Icon className={cn('w-10 h-10', config.iconColor)} strokeWidth={1.5} />
      </div>

      {/* Text content */}
      <h3 className="text-lg font-display font-semibold text-foreground mb-2">
        {title || config.defaultTitle}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">
        {description || config.defaultDescription}
      </p>

      {/* Action button */}
      {action && (
        <Button 
          onClick={action.onClick}
          className="mt-6"
          variant="outline"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};
