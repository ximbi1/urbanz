import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, SlidersHorizontal, User, Users, Lock } from 'lucide-react';

type TerritoryFilter = 'all' | 'mine' | 'friends' | 'lobby';

interface Lobby {
  id: string;
  name: string;
}

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
  lobbies?: Lobby[];
  selectedLobbyId?: string | null;
  onSelectLobby?: (lobbyId: string | null) => void;
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
  lobbies = [],
  selectedLobbyId,
  onSelectLobby,
}: MapFiltersProps) => {
  const handleLobbyFilterClick = () => {
    if (territoryFilter === 'lobby') {
      onTerritoryFilterChange('all');
      onSelectLobby?.(null);
    } else {
      onTerritoryFilterChange('lobby');
    }
  };

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
        <Card className="w-72 p-3 space-y-3 border-glow bg-background/95">
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
              <Button
                onClick={handleLobbyFilterClick}
                variant={territoryFilter === 'lobby' ? 'default' : 'outline'}
                size="sm"
              >
                <Lock className="w-4 h-4 mr-1" /> Lobby
              </Button>
            </div>
          </div>

          {/* Selector de lobby cuando el filtro está activo */}
          {territoryFilter === 'lobby' && (
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-2">Seleccionar Lobby</p>
              <Select
                value={selectedLobbyId || ''}
                onValueChange={(value) => onSelectLobby?.(value || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elige un lobby" />
                </SelectTrigger>
                <SelectContent>
                  {lobbies.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No estás en ningún lobby
                    </div>
                  ) : (
                    lobbies.map(lobby => (
                      <SelectItem key={lobby.id} value={lobby.id}>
                        {lobby.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

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
