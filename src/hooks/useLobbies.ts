import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Lobby {
  id: string;
  name: string;
  invite_code: string;
  creator_id: string;
}

export const useLobbies = () => {
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [selectedLobbyId, setSelectedLobbyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLobbies = useCallback(async () => {
    if (!user) {
      setLobbies([]);
      setLoading(false);
      return;
    }

    try {
      // Obtener lobbies donde soy miembro
      const { data: memberData } = await supabase
        .from('lobby_members')
        .select('lobby_id')
        .eq('user_id', user.id);

      const lobbyIds = memberData?.map(m => m.lobby_id) || [];

      if (lobbyIds.length === 0) {
        // Solo obtener lobbies que creé
        const { data: myLobbies } = await supabase
          .from('lobbies')
          .select('id, name, invite_code, creator_id')
          .eq('creator_id', user.id);

        setLobbies(myLobbies || []);
      } else {
        const { data: lobbiesData } = await supabase
          .from('lobbies')
          .select('id, name, invite_code, creator_id')
          .or(`creator_id.eq.${user.id},id.in.(${lobbyIds.join(',')})`);

        setLobbies(lobbiesData || []);
      }
    } catch (error) {
      console.error('Error fetching lobbies:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLobbies();
  }, [fetchLobbies]);

  const selectLobby = useCallback((lobbyId: string | null) => {
    setSelectedLobbyId(lobbyId);
  }, []);

  return {
    lobbies,
    selectedLobbyId,
    selectLobby,
    loading,
    refetch: fetchLobbies,
  };
};
