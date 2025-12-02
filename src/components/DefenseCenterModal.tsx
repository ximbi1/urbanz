import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Territory } from '@/types/territory';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldHalf, X } from 'lucide-react';

interface DefenseCenterModalProps {
  onClose: () => void;
}

const SHIELD_DURATION_HOURS = 12;
const SHIELD_COST = 150;

export const DefenseCenterModal = ({ onClose }: DefenseCenterModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [userShields, setUserShields] = useState<{ consumable: number; challenge: number }>({ consumable: 0, challenge: 0 });
  const [points, setPoints] = useState(0);
  const [applying, setApplying] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [activeShields, setActiveShields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const [{ data: profile }, { data: userShieldRows }, { data: territoryRows }, { data: shieldRows }] = await Promise.all([
          supabase.from('profiles').select('total_points').eq('id', user.id).maybeSingle(),
          supabase.from('user_shields').select('*').eq('user_id', user.id),
          supabase
            .from('territories')
            .select('id, coordinates, area, tags, poi_summary')
            .eq('user_id', user.id)
            .limit(50),
          supabase
            .from('territory_shields')
            .select('territory_id, expires_at')
            .eq('user_id', user.id)
            .gt('expires_at', new Date().toISOString()),
        ]);

        if (profile) {
          setPoints(profile.total_points || 0);
        }

        const shieldMap = { consumable: 0, challenge: 0 };
        (userShieldRows || []).forEach((row) => {
          if (row.source === 'consumable') shieldMap.consumable += row.charges;
          if (row.source === 'challenge') shieldMap.challenge += row.charges;
        });
        setUserShields(shieldMap);

        setTerritories((territoryRows || []) as Territory[]);

        const activeMap: Record<string, string> = {};
        (shieldRows || []).forEach((row) => {
          activeMap[row.territory_id] = new Date(row.expires_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          });
        });
        setActiveShields(activeMap);
      } catch (error) {
        console.error('DefenseCenter load error', error);
        toast.error('No se pudieron cargar tus escudos');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const buyShield = async () => {
    if (!user) return;
    if (points < SHIELD_COST) {
      toast.error('Necesitas más puntos para comprar un escudo');
      return;
    }
    setBuying(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ total_points: points - SHIELD_COST })
        .eq('id', user.id);
      if (profileError) throw profileError;

      await supabase
        .from('user_shields')
        .insert({ user_id: user.id, source: 'consumable', charges: 1 });

      setPoints(points - SHIELD_COST);
      setUserShields((prev) => ({ ...prev, consumable: prev.consumable + 1 }));
      toast.success('Escudo adquirido');
    } catch (error) {
      console.error('Error comprando escudo', error);
      toast.error('No se pudo comprar el escudo');
    } finally {
      setBuying(false);
    }
  };

  const applyShield = async (territoryId: string, source: 'consumable' | 'challenge') => {
    if (!user) return;
    if (userShields[source] <= 0) {
      toast.error('No tienes escudos disponibles de este tipo');
      return;
    }
    setApplying(territoryId + source);
    try {
      await supabase
        .from('territory_shields')
        .delete()
        .eq('territory_id', territoryId);
      const expires = new Date(Date.now() + SHIELD_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      await supabase
        .from('territory_shields')
        .insert({ territory_id: territoryId, user_id: user.id, shield_type: source, expires_at: expires });

      const row = userShields[source];
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
      setActiveShields((prev) => ({ ...prev, [territoryId]: new Date(expires).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }));
      toast.success('Escudo activado');
    } catch (error) {
      console.error('Error aplicando escudo', error);
      toast.error('No se pudo activar el escudo');
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="p-6 bg-card text-center border-glow">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Cargando defensa...
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-3xl bg-card border-glow p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Centro de defensa</p>
            <h3 className="text-2xl font-display font-bold">Escudos y territorios</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="p-4 bg-muted/30 border-border text-center">
            <ShieldHalf className="h-5 w-5 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Escudos comprados</p>
            <p className="text-2xl font-display font-bold">{userShields.consumable}</p>
          </Card>
          <Card className="p-4 bg-muted/30 border-border text-center">
            <ShieldCheck className="h-5 w-5 mx-auto mb-2 text-secondary" />
            <p className="text-sm text-muted-foreground">Escudos por logros</p>
            <p className="text-2xl font-display font-bold">{userShields.challenge}</p>
          </Card>
          <Card className="p-4 bg-muted/30 border-border text-center">
            <p className="text-sm text-muted-foreground">Puntos disponibles</p>
            <p className="text-2xl font-display font-bold">{points}</p>
            <Button className="mt-2" size="sm" disabled={buying} onClick={buyShield}>
              Comprar escudo (150)
            </Button>
          </Card>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Territorios</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {territories.map((territory) => (
              <Card key={territory.id} className="p-3 flex flex-col gap-2 bg-muted/20 border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Territorio {territory.id.slice(0, 6)}</p>
                    {territory.poiSummary && (
                      <p className="text-xs text-primary">{territory.poiSummary}</p>
                    )}
                    {activeShields[territory.id] && (
                      <p className="text-xs text-emerald-400">Escudo activo hasta {activeShields[territory.id]}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={userShields.challenge <= 0 || !!activeShields[territory.id] || applying === territory.id + 'challenge'}
                      onClick={() => applyShield(territory.id, 'challenge')}
                    >
                      Escudo logros
                    </Button>
                    <Button
                      size="sm"
                      disabled={userShields.consumable <= 0 || !!activeShields[territory.id] || applying === territory.id + 'consumable'}
                      onClick={() => applyShield(territory.id, 'consumable')}
                    >
                      Escudo 12h
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {territories.length === 0 && (
              <p className="text-xs text-muted-foreground">No tienes territorios para proteger aún.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
