import { Bell, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { calculateLevel, getLevelTitle } from '@/utils/levelSystem';

interface HeaderProps {
  onShowNotifications: () => void;
}

const Header = ({ onShowNotifications }: HeaderProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (user) {
      loadProfile();
      loadUnreadCount();
      const cleanup = subscribeToNotifications();
      return cleanup;
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('total_points, current_streak')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const subscribeToNotifications = () => {
    if (!user?.id) return () => {};
    
    const channel = supabase
      .channel('notifications-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const levelInfo = profile ? calculateLevel(profile.total_points) : null;
  const levelTitle = levelInfo ? getLevelTitle(levelInfo.level) : '';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center border-glow">
              <span className="text-xl font-display font-bold">U</span>
            </div>
            <h1 className="text-2xl font-display font-bold glow-primary">
              URBANZ
            </h1>
          </div>
          
          {profile && levelInfo && (
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
              <div className="flex items-center gap-2">
                <div className="text-sm">
                  <div className="font-semibold">Nivel {levelInfo.level}</div>
                  <div className="text-xs text-muted-foreground">{levelTitle}</div>
                </div>
              </div>
              
              {profile.current_streak > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500">
                  <Flame className="h-4 w-4" />
                  <span className="font-semibold text-sm">{profile.current_streak}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative hover:bg-primary/20"
              onClick={onShowNotifications}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </div>
      </div>
    </header>
  );
};

export default Header;
