import { X } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { EmptyState } from './ui/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAchievements } from '@/hooks/useAchievements';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AchievementsProps {
  onClose: () => void;
}

const Achievements = ({ onClose }: AchievementsProps) => {
  const { achievements, unlockedAchievements, loading } = useAchievements();
  const [filter, setFilter] = useState<'all' | 'distance' | 'territories' | 'streak'>('all');
  const [profile, setProfile] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('total_distance, total_territories, current_streak')
      .eq('id', user.id)
      .single();

    setProfile(data);
  };

  const isUnlocked = (achievementId: string) => {
    return unlockedAchievements.some(ua => ua.achievement.id === achievementId);
  };

  const getProgress = (achievement: any): number => {
    if (!profile) return 0;
    if (isUnlocked(achievement.id)) return 100;

    let current = 0;
    switch (achievement.type) {
      case 'distance':
        current = profile.total_distance;
        break;
      case 'territories':
        current = profile.total_territories;
        break;
      case 'streak':
        current = profile.current_streak;
        break;
    }

    return Math.min((current / achievement.requirement) * 100, 100);
  };

  const getProgressText = (achievement: any): string => {
    if (!profile) return '';
    if (isUnlocked(achievement.id)) return 'Desbloqueado';

    let current = 0;
    let unit = '';
    
    switch (achievement.type) {
      case 'distance':
        current = Math.floor(profile.total_distance / 1000);
        unit = 'km';
        break;
      case 'territories':
        current = profile.total_territories;
        unit = 'territorios';
        break;
      case 'streak':
        current = profile.current_streak;
        unit = 'días';
        break;
    }

    const required = achievement.type === 'distance' 
      ? achievement.requirement / 1000 
      : achievement.requirement;

    return `${current}/${required} ${unit}`;
  };

  const filteredAchievements = achievements.filter(
    a => filter === 'all' || a.type === filter
  );

  const totalUnlocked = unlockedAchievements.length;
  const totalAchievements = achievements.length;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card border-glow p-6 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-display font-bold glow-primary">
              Logros
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {totalUnlocked} de {totalAchievements} desbloqueados
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="distance">🏃 Distancia</TabsTrigger>
            <TabsTrigger value="territories">🚩 Territorios</TabsTrigger>
            <TabsTrigger value="streak">🔥 Rachas</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-3 mt-4 overflow-y-auto flex-1 pr-2">
            {loading ? (
              <ContentSkeleton type="achievements" count={5} />
            ) : filteredAchievements.length === 0 ? (
              <EmptyState type="achievements" className="py-6" />
            ) : (
              filteredAchievements.map((achievement) => {
                const unlocked = isUnlocked(achievement.id);
                const progress = getProgress(achievement);

                return (
                  <div
                    key={achievement.id}
                    className={`p-4 rounded-lg border transition-all ${
                      unlocked
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-muted/30 opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`text-4xl ${unlocked ? '' : 'grayscale opacity-50'}`}>
                        {achievement.icon}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{achievement.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {achievement.description}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-display font-bold text-primary">
                              +{achievement.points}
                            </div>
                            <div className="text-xs text-muted-foreground">puntos</div>
                          </div>
                        </div>

                        {!unlocked && (
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{getProgressText(achievement)}</span>
                              <span>{Math.floor(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}

                        {unlocked && (
                          <div className="mt-2 text-xs text-primary font-semibold">
                            ✓ Desbloqueado
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Achievements;
