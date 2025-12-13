import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Globe, SlidersHorizontal, User, Users } from 'lucide-react';

type TerritoryFilter = 'all' | 'mine' | 'friends';

interface MapFiltersProps {
  open: boolean;
  onTogglePanel: () => void;
  territoryFilter: TerritoryFilter;
  onTerritoryFilterChange: (value: TerritoryFilter) => void;
  showChallenges: boolean;
  showParks: boolean;
  showFountains: boolean;
  showDistricts: boolean;
  onToggleChallenges: (value: boolean) => void;
  onToggleParks: (value: boolean) => void;
  onToggleFountains: (value: boolean) => void;
  onToggleDistricts: (value: boolean) => void;
}

export const MapFilters = ({
  open,
  onTogglePanel,
  territoryFilter,
  onTerritoryFilterChange,
  showChallenges,
  showParks,
  showFountains,
  showDistricts,
  onToggleChallenges,
  onToggleParks,
  onToggleFountains,
  onToggleDistricts,
}: MapFiltersProps) => {
  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant="secondary"
        size="sm"
        className="shadow-lg"
        onClick={onTogglePanel}
      >
        <SlidersHorizontal className="w-4 h-4 mr-2" />
        {open ? 'Ocultar filtros' : 'Filtros'}
      </Button>
      {open && (
        <Card className="w-64 p-3 space-y-3 border-glow bg-background/95">
          <div>
            <p className="text-xs uppercase text-muted-foreground mb-2">Territorios</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onTerritoryFilterChange('all')}
                variant={territoryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
              >
                <Globe className="w-4 h-4 mr-1" /> Todos
              </Button>
              <Button
                onClick={() => onTerritoryFilterChange('mine')}
                variant={territoryFilter === 'mine' ? 'default' : 'outline'}
                size="sm"
              >
                <User className="w-4 h-4 mr-1" /> Míos
              </Button>
              <Button
                onClick={() => onTerritoryFilterChange('friends')}
                variant={territoryFilter === 'friends' ? 'default' : 'outline'}
                size="sm"
              >
                <Users className="w-4 h-4 mr-1" /> Amigos
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Pines de retos</span>
              <Switch checked={showChallenges} onCheckedChange={onToggleChallenges} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Parques</span>
              <Switch checked={showParks} onCheckedChange={onToggleParks} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Fuentes</span>
              <Switch checked={showFountains} onCheckedChange={onToggleFountains} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Barrios</span>
              <Switch checked={showDistricts} onCheckedChange={onToggleDistricts} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
