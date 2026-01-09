export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          points: number
          requirement: number
          type: Database["public"]["Enums"]["achievement_type"]
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: string
          name: string
          points?: number
          requirement: number
          type: Database["public"]["Enums"]["achievement_type"]
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          points?: number
          requirement?: number
          type?: Database["public"]["Enums"]["achievement_type"]
        }
        Relationships: []
      }
      challenge_participations: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          current_progress: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_progress?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participations_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          description: string
          end_date: string
          icon: string
          id: string
          name: string
          reward_points: number
          start_date: string
          target_value: number
          type: string
        }
        Insert: {
          created_at?: string
          description: string
          end_date: string
          icon?: string
          id?: string
          name: string
          reward_points?: number
          start_date: string
          target_value: number
          type: string
        }
        Update: {
          created_at?: string
          description?: string
          end_date?: string
          icon?: string
          id?: string
          name?: string
          reward_points?: number
          start_date?: string
          target_value?: number
          type?: string
        }
        Relationships: []
      }
      clan_feed: {
        Row: {
          clan_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          clan_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          clan_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clan_feed_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_feed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_members: {
        Row: {
          clan_id: string
          contribution_points: number
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["clan_role"]
          user_id: string
        }
        Insert: {
          clan_id: string
          contribution_points?: number
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["clan_role"]
          user_id: string
        }
        Update: {
          clan_id?: string
          contribution_points?: number
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["clan_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_missions: {
        Row: {
          active: boolean
          clan_id: string
          created_at: string
          current_progress: number
          id: string
          mission_type: string
          reward_points: number
          reward_shields: number
          target_count: number
        }
        Insert: {
          active?: boolean
          clan_id: string
          created_at?: string
          current_progress?: number
          id?: string
          mission_type: string
          reward_points?: number
          reward_shields?: number
          target_count?: number
        }
        Update: {
          active?: boolean
          clan_id?: string
          created_at?: string
          current_progress?: number
          id?: string
          mission_type?: string
          reward_points?: number
          reward_shields?: number
          target_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "clan_missions_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          banner_color: string | null
          created_at: string
          description: string | null
          emblem_url: string | null
          founder_id: string
          id: string
          name: string
          territories_controlled: number
          total_points: number
        }
        Insert: {
          banner_color?: string | null
          created_at?: string
          description?: string | null
          emblem_url?: string | null
          founder_id: string
          id?: string
          name: string
          territories_controlled?: number
          total_points?: number
        }
        Update: {
          banner_color?: string | null
          created_at?: string
          description?: string | null
          emblem_url?: string | null
          founder_id?: string
          id?: string
          name?: string
          territories_controlled?: number
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "clans_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          arena_name: string | null
          challenger_id: string
          challenger_progress: number
          created_at: string
          duel_type: Database["public"]["Enums"]["duel_type"]
          end_at: string
          id: string
          opponent_id: string
          opponent_progress: number
          start_at: string
          status: Database["public"]["Enums"]["duel_status"]
          target_value: number
          winner_id: string | null
        }
        Insert: {
          arena_name?: string | null
          challenger_id: string
          challenger_progress?: number
          created_at?: string
          duel_type?: Database["public"]["Enums"]["duel_type"]
          end_at?: string
          id?: string
          opponent_id: string
          opponent_progress?: number
          start_at?: string
          status?: Database["public"]["Enums"]["duel_status"]
          target_value?: number
          winner_id?: string | null
        }
        Update: {
          arena_name?: string | null
          challenger_id?: string
          challenger_progress?: number
          created_at?: string
          duel_type?: Database["public"]["Enums"]["duel_type"]
          end_at?: string
          id?: string
          opponent_id?: string
          opponent_progress?: number
          start_at?: string
          status?: Database["public"]["Enums"]["duel_status"]
          target_value?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duels_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duels_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_messages: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          identifier: string
          preferred_window: string
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          identifier: string
          preferred_window?: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          identifier?: string
          preferred_window?: string
          title?: string
        }
        Relationships: []
      }
      explorer_territories: {
        Row: {
          created_at: string
          distance: number
          duration: number
          id: string
          metadata: Json | null
          path: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          distance?: number
          duration?: number
          id?: string
          metadata?: Json | null
          path: Json
          user_id: string
        }
        Update: {
          created_at?: string
          distance?: number
          duration?: number
          id?: string
          metadata?: Json | null
          path?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "explorer_territories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lobbies: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          invite_code: string
          is_active: boolean
          max_members: number | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          invite_code?: string
          is_active?: boolean
          max_members?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          max_members?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lobby_members: {
        Row: {
          id: string
          joined_at: string
          lobby_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          lobby_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          lobby_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobby_members_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
        ]
      }
      map_challenge_claims: {
        Row: {
          challenge_id: string
          claimed_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          claimed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          claimed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_challenge_claims_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "map_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_challenge_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      map_challenge_targets: {
        Row: {
          challenge_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_challenge_targets_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "map_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_challenge_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      map_challenges: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_date: string
          id: string
          latitude: number
          longitude: number
          name: string
          radius: number
          reward_points: number
          start_date: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          radius?: number
          reward_points?: number
          start_date?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          radius?: number
          reward_points?: number
          start_date?: string
        }
        Relationships: []
      }
      map_pois: {
        Row: {
          category: string
          coordinates: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category: string
          coordinates: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          coordinates?: Json
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      mission_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          mission_id: string
          progress: number
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id: string
          progress?: number
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          end_date: string
          id: string
          mission_type: string
          reward_points: number
          reward_shields: number
          rotation_slot: number | null
          start_date: string
          target_count: number
          title: string
          weekend_only: boolean | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          mission_type: string
          reward_points?: number
          reward_shields?: number
          rotation_slot?: number | null
          start_date?: string
          target_count?: number
          title: string
          weekend_only?: boolean | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          mission_type?: string
          reward_points?: number
          reward_shields?: number
          rotation_slot?: number | null
          start_date?: string
          target_count?: number
          title?: string
          weekend_only?: boolean | null
        }
        Relationships: []
      }
      neutral_arenas: {
        Row: {
          coordinates: Json | null
          description: string | null
          id: string
          name: string
          reward_points: number | null
        }
        Insert: {
          coordinates?: Json | null
          description?: string | null
          id?: string
          name: string
          reward_points?: number | null
        }
        Update: {
          coordinates?: Json | null
          description?: string | null
          id?: string
          name?: string
          reward_points?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      park_conquests: {
        Row: {
          conquered_at: string
          id: string
          park_id: string
          run_id: string | null
          user_id: string
        }
        Insert: {
          conquered_at?: string
          id?: string
          park_id: string
          run_id?: string | null
          user_id: string
        }
        Update: {
          conquered_at?: string
          id?: string
          park_id?: string
          run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "park_conquests_park_id_fkey"
            columns: ["park_id"]
            isOneToOne: true
            referencedRelation: "map_pois"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "park_conquests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "park_conquests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          color: string
          created_at: string
          current_league: string | null
          current_streak: number
          explorer_mode: boolean | null
          gender: string | null
          height: number | null
          historical_points: number | null
          id: string
          league_shard: string | null
          previous_league: string | null
          season_points: number | null
          social_league: boolean | null
          social_points: number | null
          total_distance: number
          total_points: number
          total_territories: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          color?: string
          created_at?: string
          current_league?: string | null
          current_streak?: number
          explorer_mode?: boolean | null
          gender?: string | null
          height?: number | null
          historical_points?: number | null
          id: string
          league_shard?: string | null
          previous_league?: string | null
          season_points?: number | null
          social_league?: boolean | null
          social_points?: number | null
          total_distance?: number
          total_points?: number
          total_territories?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          color?: string
          created_at?: string
          current_league?: string | null
          current_streak?: number
          explorer_mode?: boolean | null
          gender?: string | null
          height?: number | null
          historical_points?: number | null
          id?: string
          league_shard?: string | null
          previous_league?: string | null
          season_points?: number | null
          social_league?: boolean | null
          social_points?: number | null
          total_distance?: number
          total_points?: number
          total_territories?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          expiration_time: number | null
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          expiration_time?: number | null
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          expiration_time?: number | null
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      run_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: string
          run_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction?: string
          run_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_reactions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          avg_pace: number
          created_at: string
          distance: number
          duration: number
          id: string
          league_shard: string | null
          path: Json
          points_gained: number
          territories_conquered: number
          territories_lost: number
          territories_stolen: number
          user_id: string
        }
        Insert: {
          avg_pace: number
          created_at?: string
          distance: number
          duration: number
          id?: string
          league_shard?: string | null
          path: Json
          points_gained?: number
          territories_conquered?: number
          territories_lost?: number
          territories_stolen?: number
          user_id: string
        }
        Update: {
          avg_pace?: number
          created_at?: string
          distance?: number
          duration?: number
          id?: string
          league_shard?: string | null
          path?: Json
          points_gained?: number
          territories_conquered?: number
          territories_lost?: number
          territories_stolen?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      season_results: {
        Row: {
          created_at: string | null
          final_league: string
          final_points: number
          final_rank: number
          id: string
          rewards_claimed: boolean | null
          season_id: string
          territories_conquered: number | null
          total_distance: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          final_league: string
          final_points?: number
          final_rank: number
          id?: string
          rewards_claimed?: boolean | null
          season_id: string
          territories_conquered?: number | null
          total_distance?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          final_league?: string
          final_points?: number
          final_rank?: number
          id?: string
          rewards_claimed?: boolean | null
          season_id?: string
          territories_conquered?: number | null
          total_distance?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          active: boolean | null
          created_at: string | null
          end_date: string
          id: string
          name: string
          start_date: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      territories: {
        Row: {
          area: number
          avg_pace: number
          conquered: boolean
          conquest_points: number
          cooldown_until: string | null
          coordinates: Json
          created_at: string
          id: string
          is_social: boolean | null
          last_attack_at: string | null
          last_attacker_id: string | null
          last_defender_id: string | null
          league_shard: string | null
          lobby_id: string | null
          perimeter: number
          poi_summary: string | null
          points: number
          protected_until: string | null
          required_pace: number | null
          social_participants: string[] | null
          status: Database["public"]["Enums"]["territory_status"]
          tags: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          area: number
          avg_pace: number
          conquered?: boolean
          conquest_points?: number
          cooldown_until?: string | null
          coordinates: Json
          created_at?: string
          id?: string
          is_social?: boolean | null
          last_attack_at?: string | null
          last_attacker_id?: string | null
          last_defender_id?: string | null
          league_shard?: string | null
          lobby_id?: string | null
          perimeter: number
          poi_summary?: string | null
          points: number
          protected_until?: string | null
          required_pace?: number | null
          social_participants?: string[] | null
          status?: Database["public"]["Enums"]["territory_status"]
          tags?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: number
          avg_pace?: number
          conquered?: boolean
          conquest_points?: number
          cooldown_until?: string | null
          coordinates?: Json
          created_at?: string
          id?: string
          is_social?: boolean | null
          last_attack_at?: string | null
          last_attacker_id?: string | null
          last_defender_id?: string | null
          league_shard?: string | null
          lobby_id?: string | null
          perimeter?: number
          poi_summary?: string | null
          points?: number
          protected_until?: string | null
          required_pace?: number | null
          social_participants?: string[] | null
          status?: Database["public"]["Enums"]["territory_status"]
          tags?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territories_last_attacker_id_fkey"
            columns: ["last_attacker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_last_defender_id_fkey"
            columns: ["last_defender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_events: {
        Row: {
          area: number | null
          attacker_id: string | null
          created_at: string
          defender_id: string | null
          event_type: Database["public"]["Enums"]["territory_event_type"]
          id: string
          overlap_ratio: number | null
          pace: number | null
          points_awarded: number | null
          result: Database["public"]["Enums"]["territory_event_result"]
          territory_id: string
        }
        Insert: {
          area?: number | null
          attacker_id?: string | null
          created_at?: string
          defender_id?: string | null
          event_type: Database["public"]["Enums"]["territory_event_type"]
          id?: string
          overlap_ratio?: number | null
          pace?: number | null
          points_awarded?: number | null
          result?: Database["public"]["Enums"]["territory_event_result"]
          territory_id: string
        }
        Update: {
          area?: number | null
          attacker_id?: string | null
          created_at?: string
          defender_id?: string | null
          event_type?: Database["public"]["Enums"]["territory_event_type"]
          id?: string
          overlap_ratio?: number | null
          pace?: number | null
          points_awarded?: number | null
          result?: Database["public"]["Enums"]["territory_event_result"]
          territory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_events_attacker_id_fkey"
            columns: ["attacker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_events_defender_id_fkey"
            columns: ["defender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_events_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_shields: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          shield_type: Database["public"]["Enums"]["shield_source"]
          territory_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          shield_type: Database["public"]["Enums"]["shield_source"]
          territory_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          shield_type?: Database["public"]["Enums"]["shield_source"]
          territory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_shields_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territory_shields_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shields: {
        Row: {
          charges: number
          created_at: string
          id: string
          source: Database["public"]["Enums"]["shield_source"]
          user_id: string
        }
        Insert: {
          charges?: number
          created_at?: string
          id?: string
          source: Database["public"]["Enums"]["shield_source"]
          user_id: string
        }
        Update: {
          charges?: number
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["shield_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_shields_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_user_streak: { Args: { p_user_id: string }; Returns: number }
      is_member_of_clan: { Args: { check_clan: string }; Returns: boolean }
      is_member_of_lobby: { Args: { check_lobby: string }; Returns: boolean }
      rebalance_league_shards: {
        Args: { shard_size?: number }
        Returns: undefined
      }
    }
    Enums: {
      achievement_type: "distance" | "territories" | "streak"
      clan_role: "leader" | "officer" | "member"
      duel_status: "pending" | "active" | "completed"
      duel_type: "distance" | "territories" | "points" | "arena"
      shield_source: "consumable" | "challenge" | "mission"
      territory_event_result: "success" | "failed" | "neutral"
      territory_event_type: "conquest" | "steal" | "reinforce" | "defense"
      territory_status: "idle" | "protected" | "contested"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      achievement_type: ["distance", "territories", "streak"],
      clan_role: ["leader", "officer", "member"],
      duel_status: ["pending", "active", "completed"],
      duel_type: ["distance", "territories", "points", "arena"],
      shield_source: ["consumable", "challenge", "mission"],
      territory_event_result: ["success", "failed", "neutral"],
      territory_event_type: ["conquest", "steal", "reinforce", "defense"],
      territory_status: ["idle", "protected", "contested"],
    },
  },
} as const
