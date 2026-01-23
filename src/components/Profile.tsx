import { X, Trophy, MapPin, Route, Trash2, Edit2, Upload, User, Award, LogOut, TrendingUp, Info, FileUp, ShieldHalf, ShieldCheck, Loader2, Shield, Ruler, HelpCircle, Settings, Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useCallback, memo } from 'react';
import { Run, Territory } from '@/types/territory';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAchievements } from '@/hooks/useAchievements';
import Achievements from './Achievements';
import Tutorial from './Tutorial';
import { calculateLevel, getLevelTitle, getLevelColor } from '@/utils/levelSystem';
import { TerritoryInfoTooltip } from './TerritoryInfoTooltip';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import { Switch } from '@/components/ui/switch';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';

const profileSchema = z.object({
  username: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(20, 'El nombre no puede tener más de 20 caracteres'),
  bio: z.string().max(200, 'La biografía no puede tener más de 200 caracteres').optional(),
  height: z.number().min(100).max(250).optional().nullable(),
  gender: z.string().optional().nullable(),
});

interface ProfileProps {
  onClose: () => void;
  isMobileFullPage?: boolean;
  onImportClick?: () => void;
}

type ProfileFormData = z.infer<typeof profileSchema>;

type DefenseTerritory = Pick<Territory, 'id' | 'tags' | 'poiSummary' | 'coordinates' | 'area'> & {
  createdAt?: string | null;
};

const SHIELD_DURATION_HOURS = 12;
const SHIELD_COST = 150;

const formatArea = (area?: number | null) => {
  if (!area) return 'Área desconocida';
  return `${Math.round(area).toLocaleString('es-ES')} m²`;
};

const getTerritoryLabel = (territory: DefenseTerritory) => {
  if (territory.poiSummary) return territory.poiSummary;
  if (territory.tags && territory.tags.length) return territory.tags[0].name;
  return formatArea(territory.area);
};

const getTerritoryLocation = (territory: DefenseTerritory) => {
  if (!territory.coordinates || territory.coordinates.length === 0) return null;
  const centroid = territory.coordinates.reduce(
    (acc, coord) => ({
      lat: acc.lat + coord.lat / territory.coordinates.length,
      lng: acc.lng + coord.lng / territory.coordinates.length,
    }),
    { lat: 0, lng: 0 }
  );
  return `${centroid.lat.toFixed(3)}, ${centroid.lng.toFixed(3)}`;
};

const Profile = ({ onClose, isMobileFullPage = false, onImportClick }: ProfileProps) => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [bestSeasonResult, setBestSeasonResult] = useState<{
    seasonName?: string | null;
    finalPoints: number;
    finalLeague: string;
    finalRank: number;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [defenseLoading, setDefenseLoading] = useState(false);
  const [defenseTerritories, setDefenseTerritories] = useState<DefenseTerritory[]>([]);
  const [userShields, setUserShields] = useState<{ consumable: number; challenge: number }>({ consumable: 0, challenge: 0 });
  const [activeShields, setActiveShields] = useState<Record<string, string>>({});
  const [applyingShield, setApplyingShield] = useState<string | null>(null);
  const [buyingShield, setBuyingShield] = useState(false);
  const [userClan, setUserClan] = useState<{ id: string; name: string; description: string | null; banner_color?: string | null } | null>(null);
  const { unlockedAchievements } = useAchievements();
  const levelInfo = profile ? calculateLevel(profile.total_points) : null;
  const { settings: playerSettings, updateSettings } = usePlayerSettings();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (user) {
      loadProfile();
      loadRuns();
      loadDefenseData();
      loadUserClan();
      loadBestSeasonResult();
    }
  }, [user]);


  const loadProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      toast.error('Error al cargar perfil');
      return;
    }
    
    setProfile(data);
    setAvatarUrl(data.avatar_url);
    setValue('username', data.username);
    setValue('bio', data.bio || '');
    setValue('height', data.height || null);
    setValue('gender', data.gender || null);
  };

  const loadUserClan = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('clan_members')
      .select('clan:clans (id, name, description, banner_color)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error) {
      setUserClan(data?.clan || null);
    }
  };

  const loadBestSeasonResult = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('season_results')
      .select('final_points, final_league, final_rank, season:seasons(name)')
      .eq('user_id', user.id)
      .order('final_points', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setBestSeasonResult({
        finalPoints: data.final_points,
        finalLeague: data.final_league,
        finalRank: data.final_rank,
        seasonName: (data.season as any)?.name || null,
      });
    }
  };

  const leagueLabel = (league: string | null | undefined) => {
    const labels: Record<string, string> = {
      bronze: 'Bronce',
      silver: 'Plata',
      gold: 'Oro',
      platinum: 'Platino',
      diamond: 'Diamante',
      legend: 'Leyenda',
    };
    return labels[league || ''] || 'Sin liga';
  };

  const loadRuns = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Error al cargar carreras');
      return;
    }
    
    // Mapear datos de Supabase al tipo Run
    const mappedRuns: Run[] = (data || []).map(run => ({
      id: run.id,
      userId: run.user_id,
      distance: run.distance,
      duration: run.duration,
      avgPace: run.avg_pace,
      path: run.path as any,
      territoriesConquered: run.territories_conquered,
      territoriesStolen: run.territories_stolen,
      territoriesLost: run.territories_lost,
      pointsGained: run.points_gained,
      timestamp: new Date(run.created_at).getTime(),
    }));
    
    setRuns(mappedRuns);
  };

  const loadDefenseData = async () => {
    if (!user) return;
    setDefenseLoading(true);
    try {
      const [{ data: userShieldRows }, { data: territoryRows }, { data: shieldRows }] = await Promise.all([
        supabase.from('user_shields').select('*').eq('user_id', user.id),
        supabase
          .from('territories')
          .select('id, tags, poi_summary, coordinates, area, created_at')
          .eq('user_id', user.id)
          .limit(50),
        supabase
          .from('territory_shields')
          .select('territory_id, expires_at')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString()),
      ]);

      const shieldMap = { consumable: 0, challenge: 0 };
      (userShieldRows || []).forEach((row) => {
        if (row.source === 'consumable') shieldMap.consumable += row.charges;
        if (row.source === 'challenge') shieldMap.challenge += row.charges;
      });
      setUserShields(shieldMap);

      const mappedTerritories: DefenseTerritory[] = (territoryRows || []).map((territory: any) => ({
        id: territory.id,
        tags: territory.tags || [],
        poiSummary: territory.poi_summary || null,
        coordinates: territory.coordinates || [],
        area: territory.area,
        createdAt: territory.created_at,
      }));
      setDefenseTerritories(mappedTerritories);

      const activeMap: Record<string, string> = {};
      (shieldRows || []).forEach((row) => {
        activeMap[row.territory_id] = row.expires_at;
      });
      setActiveShields(activeMap);
    } catch (error) {
      console.error('Defense center load error', error);
      toast.error('No se pudieron cargar tus escudos');
    } finally {
      setDefenseLoading(false);
    }
  };

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await loadProfile();
      await loadRuns();
      await loadDefenseData();
      await loadUserClan();
    },
    enabled: isMobileFullPage,
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;
    
    const file = e.target.files[0];
    
    // Validar tamaño (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 2MB');
      return;
    }
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    
    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Subir archivo
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // Actualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setAvatarUrl(publicUrl);
      toast.success('Imagen de perfil actualizada');
    } catch (error: any) {
      toast.error('Error al subir imagen: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const buyShield = async () => {
    if (!user || !profile) return;
    if ((profile.total_points || 0) < SHIELD_COST) {
      toast.error('Necesitas más puntos para comprar un escudo');
      return;
    }
    setBuyingShield(true);
    try {
      const updatedPoints = (profile.total_points || 0) - SHIELD_COST;
      const { error } = await supabase
        .from('profiles')
        .update({ total_points: updatedPoints })
        .eq('id', user.id);
      if (error) throw error;

      await supabase
        .from('user_shields')
        .insert({ user_id: user.id, source: 'consumable', charges: 1 });

      setProfile((prev: any) => prev ? { ...prev, total_points: updatedPoints } : prev);
      setUserShields((prev) => ({ ...prev, consumable: prev.consumable + 1 }));
      toast.success('Escudo adquirido');
    } catch (error) {
      console.error('Error comprando escudo', error);
      toast.error('No se pudo comprar el escudo');
    } finally {
      setBuyingShield(false);
    }
  };

  const applyShield = async (territoryId: string, source: 'consumable' | 'challenge') => {
    if (!user) return;
    if (userShields[source] <= 0) {
      toast.error('No tienes escudos de este tipo');
      return;
    }
    const applyingKey = `${territoryId}-${source}`;
    setApplyingShield(applyingKey);
    try {
      await supabase
        .from('territory_shields')
        .delete()
        .eq('territory_id', territoryId);

      const expires = new Date(Date.now() + SHIELD_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      await supabase
        .from('territory_shields')
        .insert({ territory_id: territoryId, user_id: user.id, shield_type: source, expires_at: expires });

      const { data } = await supabase
        .from('user_shields')
        .select('id, charges')
        .eq('user_id', user.id)
        .eq('source', source)
        .order('created_at', { ascending: true })
        .limit(1);

      if (data && data[0]) {
        const newCharges = Math.max(0, data[0].charges - 1);
        await supabase
          .from('user_shields')
          .update({ charges: newCharges })
          .eq('id', data[0].id);
      }

      setUserShields((prev) => ({ ...prev, [source]: Math.max(0, prev[source] - 1) }));
      setActiveShields((prev) => ({ ...prev, [territoryId]: expires }));
      toast.success('Escudo activado');
    } catch (error) {
      console.error('Error aplicando escudo', error);
      toast.error('No se pudo activar el escudo');
    } finally {
      setApplyingShield(null);
    }
  };

  const formatShieldExpiry = (iso: string) => {
    const expires = new Date(iso);
    return expires.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    
    try {
      // Verificar si el username ya existe (excepto el propio)
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', data.username)
        .neq('id', user.id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingUser) {
        toast.error('Este nombre de usuario ya está en uso');
        return;
      }
      
      // Actualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          bio: data.bio || null,
          height: data.height || null,
          gender: data.gender || null,
        })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      await loadProfile();
      setIsEditing(false);
      toast.success('Perfil actualizado correctamente');
    } catch (error: any) {
      toast.error('Error al actualizar perfil: ' + error.message);
    }
  };

  const handleDeleteTerritories = async () => {
    if (!profile || !user) return;
    
    if (window.confirm('⚠️ ¿Estás seguro de eliminar todos tus territorios? Esta acción no se puede deshacer.')) {
      const { error } = await supabase
        .from('territories')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        toast.error('Error al eliminar territorios');
        return;
      }
      
      await loadProfile();
      toast.success('Territorios eliminados correctamente');
    }
  };

  if (!profile) return null;

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getWeeklyData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayRuns = runs.filter(run => 
        new Date(run.timestamp).toISOString().split('T')[0] === date
      );
      return {
        day: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
        distance: Math.round(dayRuns.reduce((sum, run) => sum + run.distance, 0) / 1000 * 100) / 100,
        points: dayRuns.reduce((sum, run) => sum + run.pointsGained, 0),
      };
    });
  };

  if (isMobileFullPage) {
    return (
      <div className="w-full h-full flex flex-col bg-background">
        <div ref={containerRef} className="container mx-auto px-4 py-6 space-y-4 flex-1 overflow-y-auto pb-24 relative">
          <PullToRefreshIndicator
            isRefreshing={isRefreshing}
            pullDistance={pullDistance}
            progress={progress}
          />
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold glow-primary">
            Perfil
          </h2>
          <div className="flex items-center gap-1">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle>Configuración de juego</SheetTitle>
                  <SheetDescription>
                    Ajusta cómo quieres competir en Urbanz
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Modo explorador</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Guarda rutas personales sin disputar territorios. Ideal para entrenar sin afectar el mapa.
                      </p>
                    </div>
                    <Switch
                      checked={playerSettings.explorerMode}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSettings({ explorerMode: checked });
                          toast.success(checked ? 'Modo explorador activado' : 'Modo competitivo activado');
                        } catch (error) {
                          toast.error('No se pudo actualizar el modo');
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Liga social</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Colabora con otros runners. Tus territorios no pueden ser robados por otros jugadores.
                      </p>
                    </div>
                    <Switch
                      checked={playerSettings.socialLeague}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSettings({ socialLeague: checked });
                          toast.success(checked ? 'Liga social activada' : 'Liga social desactivada');
                        } catch (error) {
                          toast.error('No se pudo actualizar la liga social');
                        }
                      }}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Información del Usuario */}
        {!isEditing ? (
          <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>
              {levelInfo && (
                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-background border-2 border-primary shadow-lg ${getLevelColor(levelInfo.level)}`}>
                  <span className="font-display font-bold text-xs">Nv. {levelInfo.level}</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-display font-bold">{profile?.username}</h3>
              {levelInfo && (
                <p className={`text-xs font-semibold mt-0.5 ${getLevelColor(levelInfo.level)}`}>
                  {getLevelTitle(levelInfo.level)}
                </p>
              )}
              {profile?.bio && (
                <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {profile?.gender && profile.gender !== 'prefer_not_to_say' && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {profile.gender === 'male' ? 'Hombre' : profile.gender === 'female' ? 'Mujer' : 'Otro'}
                  </span>
                )}
                {profile?.height && (
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3 h-3" />
                    {profile.height} cm
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback>
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center gap-2">
                <Label 
                  htmlFor="avatar-upload" 
                  className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Subiendo...' : 'Cambiar imagen'}
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">Máximo 2MB</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de usuario</Label>
              <Input
                id="username"
                {...register('username')}
                placeholder="Tu nombre de usuario"
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">Biografía</Label>
              <Textarea
                id="bio"
                {...register('bio')}
                placeholder="Cuéntanos sobre ti..."
                rows={3}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {watch('bio')?.length || 0}/200 caracteres
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="gender">Género</Label>
                <Select 
                  value={watch('gender') || ''} 
                  onValueChange={(value) => setValue('gender', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Hombre</SelectItem>
                    <SelectItem value="female">Mujer</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefiero no decirlo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Altura (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  min={100}
                  max={250}
                  {...register('height', { valueAsNumber: true })}
                  placeholder="175"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Guardar cambios
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Progreso de Nivel */}
        {levelInfo && (
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">Nivel {levelInfo.level}</div>
                  <div className="text-xs text-muted-foreground">{profile?.total_points} puntos totales</div>
                </div>
                <TerritoryInfoTooltip userLevel={levelInfo.level} />
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-primary">{levelInfo.pointsToNextLevel}</div>
                <div className="text-xs text-muted-foreground">para nivel {levelInfo.level + 1}</div>
              </div>
            </div>
            <Progress value={levelInfo.progressPercentage} className="h-2" />
          </div>
        )}
        {/* Liga actual + mejor temporada */}
        <Card className="p-4 bg-muted/30 border-border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Liga actual</p>
              <p className="text-lg font-display font-bold text-primary">{leagueLabel(profile?.current_league)}</p>
              <p className="text-xs text-muted-foreground">Shard: {profile?.league_shard || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Mejor temporada</p>
              {bestSeasonResult ? (
                <div>
                  <p className="text-lg font-display font-bold">{bestSeasonResult.finalPoints} pts</p>
                  <p className="text-xs text-muted-foreground">
                    {leagueLabel(bestSeasonResult.finalLeague)} · #{bestSeasonResult.finalRank}
                    {bestSeasonResult.seasonName ? ` · ${bestSeasonResult.seasonName}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aún sin temporadas</p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="space-y-4">

          {/* Puntos separados: Competitivo vs Social */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 text-center">
              <div className="flex justify-center mb-2">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div className="text-2xl font-display font-bold text-primary">
                {profile?.season_points || 0}
              </div>
              <div className="text-xs text-muted-foreground">Pts Competitivo</div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 text-center">
              <div className="flex justify-center mb-2">
                <Trophy className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="text-2xl font-display font-bold text-emerald-500">
                {profile?.social_points || 0}
              </div>
              <div className="text-xs text-muted-foreground">Pts Social</div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-muted/30 border-border text-center">
              <div className="flex justify-center mb-2">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <div className="text-2xl font-display font-bold text-primary">
                {profile?.total_points || 0}
              </div>
              <div className="text-xs text-muted-foreground">Puntos totales</div>
            </Card>
            
            <Card className="p-4 bg-muted/30 border-border text-center">
              <div className="flex justify-center mb-2">
                <MapPin className="w-6 h-6 text-secondary" />
              </div>
              <div className="text-2xl font-display font-bold text-secondary">
                {profile?.total_territories || 0}
              </div>
              <div className="text-xs text-muted-foreground">Territorios</div>
            </Card>
            
            <Card className="p-4 bg-muted/30 border-border text-center">
              <div className="flex justify-center mb-2">
                <Route className="w-6 h-6 text-accent" />
              </div>
              <div className="text-2xl font-display font-bold text-accent">
                {formatDistance(profile?.total_distance || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Distancia</div>
            </Card>

            <Card className="p-4 bg-muted/30 border-border text-center">
              <div className="text-2xl font-display font-bold">
                {profile?.current_streak || 0}🔥
              </div>
              <div className="text-xs text-muted-foreground">Días seguidos</div>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAchievements(true)}
            >
              <Award className="w-4 h-4 mr-2" />
              Logros ({unlockedAchievements.length})
            </Button>
            {onImportClick && (
              <Button
                variant="outline"
                onClick={onImportClick}
              >
                <FileUp className="w-4 h-4 mr-2" />
                Importar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowTutorial(true)}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Tutorial
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Centro de defensa</p>
              <h3 className="text-lg font-display font-bold">Escudos y territorios</h3>
            </div>
            <Button size="sm" variant="ghost" disabled={defenseLoading} onClick={loadDefenseData}>
              {defenseLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Actualizar
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4 bg-card/40 border-border text-center">
              <ShieldHalf className="w-5 h-5 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Escudos comprados</p>
              <p className="text-2xl font-display font-bold">{userShields.consumable}</p>
            </Card>
            <Card className="p-4 bg-card/40 border-border text-center">
              <ShieldCheck className="w-5 h-5 mx-auto mb-2 text-secondary" />
              <p className="text-sm text-muted-foreground">Escudos por logros</p>
              <p className="text-2xl font-display font-bold">{userShields.challenge}</p>
            </Card>
            <Card className="p-4 bg-card/40 border-border text-center">
              <p className="text-sm text-muted-foreground">Puntos disponibles</p>
              <p className="text-2xl font-display font-bold">{profile.total_points || 0}</p>
              <Button className="mt-2" size="sm" disabled={buyingShield} onClick={buyShield}>
                {buyingShield && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Comprar escudo ({SHIELD_COST})
              </Button>
            </Card>
          </div>
          {defenseLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Preparando tus territorios...
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {defenseTerritories.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aún no tienes territorios para proteger.</p>
                ) : (
                  defenseTerritories.map((territory) => {
                    const hasShield = Boolean(activeShields[territory.id]);
                    const label = getTerritoryLabel(territory);
                    const locationHint = getTerritoryLocation(territory);
                    return (
                      <Card key={territory.id} className="p-3 bg-card/40 border-border">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: profile?.color || 'hsl(var(--primary))' }}
                              />
                              <p className="text-sm font-semibold">{label}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              ID {territory.id.slice(0, 6)} · {formatArea(territory.area)}
                              {locationHint ? ` · ${locationHint}` : ''}
                            </p>
                            {territory.tags && territory.tags.length > 1 && (
                              <div className="flex flex-wrap gap-1">
                                {territory.tags.slice(0, 3).map(tag => (
                                  <span
                                    key={`${territory.id}-${tag.name}`}
                                    className="text-[10px] uppercase tracking-wide bg-muted px-2 py-0.5 rounded-full"
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {hasShield && (
                              <p className="text-xs text-emerald-400">
                                Escudo activo hasta {formatShieldExpiry(activeShields[territory.id])}
                              </p>
                            )}
                          </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={userShields.challenge <= 0 || hasShield || applyingShield === `${territory.id}-challenge`}
                            onClick={() => applyShield(territory.id, 'challenge')}
                          >
                            {applyingShield === `${territory.id}-challenge` && (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            )}
                            Escudo logros
                          </Button>
                          <Button
                            size="sm"
                            disabled={userShields.consumable <= 0 || hasShield || applyingShield === `${territory.id}-consumable`}
                            onClick={() => applyShield(territory.id, 'consumable')}
                          >
                            {applyingShield === `${territory.id}-consumable` && (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            )}
                            Escudo 12h
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Récords Personales */}
        {runs.length > 0 && (
          <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-display font-bold">Récords Personales</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="p-3 bg-card/50 border-accent/30">
                <div className="text-xs text-muted-foreground mb-1">Mejor Ritmo</div>
                <div className="text-2xl font-display font-bold text-accent">
                  {Math.min(...runs.map(r => r.avgPace)).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">min/km</div>
              </Card>
              <Card className="p-3 bg-card/50 border-accent/30">
                <div className="text-xs text-muted-foreground mb-1">Carrera Más Larga</div>
                <div className="text-2xl font-display font-bold text-accent">
                  {formatDistance(Math.max(...runs.map(r => r.distance)))}
                </div>
                <div className="text-xs text-muted-foreground">distancia</div>
              </Card>
              <Card className="p-3 bg-card/50 border-accent/30">
                <div className="text-xs text-muted-foreground mb-1">Más Territorios</div>
                <div className="text-2xl font-display font-bold text-accent">
                  {Math.max(...runs.map(r => r.territoriesConquered + r.territoriesStolen))}
                </div>
                <div className="text-xs text-muted-foreground">en una carrera</div>
              </Card>
            </div>
          </div>
        )}

        {/* Gráficos de Progreso Semanal */}
        {runs.length > 0 && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-display font-bold">Progreso Semanal</h3>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getWeeklyData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="day" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="distance" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="km" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="points" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    name="pts" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Botones de acciones */}
        <div className="flex gap-2">
          <Button
            onClick={handleDeleteTerritories}
            variant="destructive"
            className="flex-1"
            disabled={!profile || profile.total_territories === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar territorios
          </Button>
          
          <Button
            onClick={async () => {
              await signOut();
              toast.success('Sesión cerrada correctamente');
            }}
            variant="outline"
            className="flex-1"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>

        {showAchievements && (
          <Achievements onClose={() => setShowAchievements(false)} />
        )}

        {showTutorial && (
          <Tutorial onClose={() => setShowTutorial(false)} />
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4">
      <Card className="w-full max-w-2xl bg-card border-glow p-4 md:p-6 space-y-4 md:space-y-6 max-h-[90vh] md:max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold glow-primary">
            Perfil
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Card className="p-4 border border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Modo explorador</p>
              <p className="text-xs text-muted-foreground">Guarda rutas personales sin disputar territorios</p>
            </div>
            <Switch
              checked={playerSettings.explorerMode}
              onCheckedChange={async (checked) => {
                try {
                  await updateSettings({ explorerMode: checked });
                  toast.success(checked ? 'Modo explorador activado' : 'Modo competitivo activado');
                } catch (error) {
                  toast.error('No se pudo actualizar el modo');
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Liga social</p>
              <p className="text-xs text-muted-foreground">Colabora con otros runners sin perder territorios</p>
            </div>
            <Switch
              checked={playerSettings.socialLeague}
              onCheckedChange={async (checked) => {
                try {
                  await updateSettings({ socialLeague: checked });
                  toast.success(checked ? 'Liga social activada' : 'Liga social desactivada');
                } catch (error) {
                  toast.error('No se pudo actualizar la liga social');
                }
              }}
            />
          </div>
        </Card>

        {userClan && (
          <Card className="p-3 border border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground tracking-widest">Clan</p>
                <p className="text-lg font-semibold">{userClan.name}</p>
                <p className="text-xs text-muted-foreground">
                  {userClan.description || 'Coordinando ofensivas urbanas.'}
                </p>
              </div>
              <Shield className="w-6 h-6 text-primary" />
            </div>
          </Card>
        )}

        {/* Puntos separados: Competitivo vs Social */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 text-center">
            <div className="flex justify-center mb-2">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div className="text-2xl font-display font-bold text-primary">
              {profile?.season_points || 0}
            </div>
            <div className="text-xs text-muted-foreground">Pts Competitivo</div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 text-center">
            <div className="flex justify-center mb-2">
              <Trophy className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-2xl font-display font-bold text-emerald-500">
              {profile?.social_points || 0}
            </div>
            <div className="text-xs text-muted-foreground">Pts Social</div>
          </Card>
        </div>

        <Card className="p-4 bg-muted/30 border-border">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Liga actual</p>
              <p className="text-lg font-display font-bold text-primary">{leagueLabel(profile?.current_league)}</p>
              <p className="text-xs text-muted-foreground">Shard: {profile?.league_shard || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Mejor temporada</p>
              {bestSeasonResult ? (
                <div>
                  <p className="text-lg font-display font-bold">{bestSeasonResult.finalPoints} pts</p>
                  <p className="text-xs text-muted-foreground">
                    {leagueLabel(bestSeasonResult.finalLeague)} · #{bestSeasonResult.finalRank}
                    {bestSeasonResult.seasonName ? ` · ${bestSeasonResult.seasonName}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aún sin temporadas</p>
              )}
            </div>
          </div>
        </Card>

        {/* ... keep existing code (all profile content) */}


        {showAchievements && (
          <Achievements onClose={() => setShowAchievements(false)} />
        )}

        {showTutorial && (
          <Tutorial onClose={() => setShowTutorial(false)} />
        )}
      </Card>
    </div>
  );
};

export default Profile;
