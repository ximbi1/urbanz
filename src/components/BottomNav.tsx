import { Home, Activity, Trophy, Users, User } from 'lucide-react';

export type ActiveSection = 'home' | 'activity' | 'compete' | 'community' | 'you';

interface BottomNavProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
}

const navItems: { id: ActiveSection; icon: typeof Home; label: string }[] = [
  { id: 'home', icon: Home, label: 'Inicio' },
  { id: 'activity', icon: Activity, label: 'Actividad' },
  { id: 'compete', icon: Trophy, label: 'Competir' },
  { id: 'community', icon: Users, label: 'Social' },
  { id: 'you', icon: User, label: 'Perfil' },
];

const BottomNav = ({ activeSection, onNavigate }: BottomNavProps) => {
  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-card backdrop-blur-md border-t border-border/30 safe-area-bottom">
      <div className="flex items-center justify-around px-3 py-3 max-w-screen-md mx-auto gap-2">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-4 rounded-lg transition-all duration-200 min-w-[68px] ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
              <span className={`text-[11px] font-medium transition-colors ${isActive ? 'text-primary' : ''}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
