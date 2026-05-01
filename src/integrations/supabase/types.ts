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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_rules: {
        Row: {
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          notification_method: string
          user_id: string
        }
        Insert: {
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notification_method?: string
          user_id: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notification_method?: string
          user_id?: string
        }
        Relationships: []
      }
      briefing_requests: {
        Row: {
          analyst_user_id: string | null
          client_user_id: string
          countries: string[]
          created_at: string
          deadline: string | null
          id: string
          priority: string
          regions: string[]
          response_notes: string | null
          response_report_url: string | null
          scope: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          analyst_user_id?: string | null
          client_user_id: string
          countries?: string[]
          created_at?: string
          deadline?: string | null
          id?: string
          priority?: string
          regions?: string[]
          response_notes?: string | null
          response_report_url?: string | null
          scope: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          analyst_user_id?: string | null
          client_user_id?: string
          countries?: string[]
          created_at?: string
          deadline?: string | null
          id?: string
          priority?: string
          regions?: string[]
          response_notes?: string | null
          response_report_url?: string | null
          scope?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_assignments: {
        Row: {
          analyst_user_id: string
          client_user_id: string
          countries: string[]
          created_at: string
          id: string
          is_active: boolean
          regions: string[]
          services: string[]
          updated_at: string
        }
        Insert: {
          analyst_user_id: string
          client_user_id: string
          countries?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          regions?: string[]
          services?: string[]
          updated_at?: string
        }
        Update: {
          analyst_user_id?: string
          client_user_id?: string
          countries?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          regions?: string[]
          services?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      country_watchlist: {
        Row: {
          country_name: string
          created_at: string
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          country_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          country_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      crisis_alert_history: {
        Row: {
          channels: string[]
          event_id: string | null
          id: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          channels?: string[]
          event_id?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          channels?: string[]
          event_id?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crisis_alert_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "crisis_events"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_assets: {
        Row: {
          address: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          radius_km: number
          type: Database["public"]["Enums"]["crisis_asset_type"]
          user_id: string
        }
        Insert: {
          address?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name: string
          radius_km?: number
          type?: Database["public"]["Enums"]["crisis_asset_type"]
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          radius_km?: number
          type?: Database["public"]["Enums"]["crisis_asset_type"]
          user_id?: string
        }
        Relationships: []
      }
      crisis_events: {
        Row: {
          actions: string[]
          affected_area: string | null
          category: Database["public"]["Enums"]["crisis_category"]
          confidence: number
          created_at: string
          id: string
          impacts: string[]
          latitude: number
          location: string
          longitude: number
          pipeline_stage: Database["public"]["Enums"]["crisis_pipeline_stage"]
          severity: Database["public"]["Enums"]["crisis_severity"]
          source_type: string
          sources_count: number
          status: Database["public"]["Enums"]["crisis_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          actions?: string[]
          affected_area?: string | null
          category?: Database["public"]["Enums"]["crisis_category"]
          confidence?: number
          created_at?: string
          id?: string
          impacts?: string[]
          latitude?: number
          location?: string
          longitude?: number
          pipeline_stage?: Database["public"]["Enums"]["crisis_pipeline_stage"]
          severity?: Database["public"]["Enums"]["crisis_severity"]
          source_type?: string
          sources_count?: number
          status?: Database["public"]["Enums"]["crisis_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          actions?: string[]
          affected_area?: string | null
          category?: Database["public"]["Enums"]["crisis_category"]
          confidence?: number
          created_at?: string
          id?: string
          impacts?: string[]
          latitude?: number
          location?: string
          longitude?: number
          pipeline_stage?: Database["public"]["Enums"]["crisis_pipeline_stage"]
          severity?: Database["public"]["Enums"]["crisis_severity"]
          source_type?: string
          sources_count?: number
          status?: Database["public"]["Enums"]["crisis_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      crisis_user_settings: {
        Row: {
          created_at: string
          email: string | null
          last_travel_analysis: Json | null
          last_travel_analysis_at: string | null
          min_severity: Database["public"]["Enums"]["crisis_severity"]
          notify_email: boolean
          notify_slack: boolean
          notify_sms: boolean
          ollama_model: string | null
          ollama_token: string | null
          ollama_url: string | null
          regions: string[]
          slack_webhook: string | null
          sms_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          last_travel_analysis?: Json | null
          last_travel_analysis_at?: string | null
          min_severity?: Database["public"]["Enums"]["crisis_severity"]
          notify_email?: boolean
          notify_slack?: boolean
          notify_sms?: boolean
          ollama_model?: string | null
          ollama_token?: string | null
          ollama_url?: string | null
          regions?: string[]
          slack_webhook?: string | null
          sms_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          last_travel_analysis?: Json | null
          last_travel_analysis_at?: string | null
          min_severity?: Database["public"]["Enums"]["crisis_severity"]
          notify_email?: boolean
          notify_slack?: boolean
          notify_sms?: boolean
          ollama_model?: string | null
          ollama_token?: string | null
          ollama_url?: string | null
          regions?: string[]
          slack_webhook?: string | null
          sms_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intel_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          news_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          news_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          news_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      itinerary_destinations: {
        Row: {
          arrival_date: string
          city: string | null
          country: string
          created_at: string
          departure_date: string
          id: string
          itinerary_id: string
          lat: number | null
          lon: number | null
          sequence: number
          user_id: string
        }
        Insert: {
          arrival_date: string
          city?: string | null
          country: string
          created_at?: string
          departure_date: string
          id?: string
          itinerary_id: string
          lat?: number | null
          lon?: number | null
          sequence?: number
          user_id: string
        }
        Update: {
          arrival_date?: string
          city?: string | null
          country?: string
          created_at?: string
          departure_date?: string
          id?: string
          itinerary_id?: string
          lat?: number | null
          lon?: number | null
          sequence?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_destinations_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "travel_itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          actor_type: Database["public"]["Enums"]["actor_type"]
          category: Database["public"]["Enums"]["news_category"]
          city: string | null
          confidence_level: Database["public"]["Enums"]["confidence_level"]
          confidence_score: number
          country: string
          created_at: string
          id: string
          is_published_to_clients: boolean
          lat: number
          lon: number
          published_at: string
          published_by: string | null
          published_to_clients_at: string | null
          region: string
          source: string
          source_credibility: Database["public"]["Enums"]["source_credibility"]
          sub_category: string | null
          summary: string
          tags: string[]
          threat_level: Database["public"]["Enums"]["threat_level"]
          title: string
          token: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          actor_type?: Database["public"]["Enums"]["actor_type"]
          category?: Database["public"]["Enums"]["news_category"]
          city?: string | null
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          confidence_score?: number
          country: string
          created_at?: string
          id?: string
          is_published_to_clients?: boolean
          lat: number
          lon: number
          published_at?: string
          published_by?: string | null
          published_to_clients_at?: string | null
          region: string
          source: string
          source_credibility?: Database["public"]["Enums"]["source_credibility"]
          sub_category?: string | null
          summary: string
          tags?: string[]
          threat_level?: Database["public"]["Enums"]["threat_level"]
          title: string
          token?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          actor_type?: Database["public"]["Enums"]["actor_type"]
          category?: Database["public"]["Enums"]["news_category"]
          city?: string | null
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          confidence_score?: number
          country?: string
          created_at?: string
          id?: string
          is_published_to_clients?: boolean
          lat?: number
          lon?: number
          published_at?: string
          published_by?: string | null
          published_to_clients_at?: string | null
          region?: string
          source?: string
          source_credibility?: Database["public"]["Enums"]["source_credibility"]
          sub_category?: string | null
          summary?: string
          tags?: string[]
          threat_level?: Database["public"]["Enums"]["threat_level"]
          title?: string
          token?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          news_item_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          news_item_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          news_item_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sam_ai_chats: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      travel_alerts: {
        Row: {
          alert_type: string
          created_at: string
          destination_id: string | null
          id: string
          is_read: boolean
          itinerary_id: string | null
          message: string
          news_item_id: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          alert_type?: string
          created_at?: string
          destination_id?: string | null
          id?: string
          is_read?: boolean
          itinerary_id?: string | null
          message: string
          news_item_id?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          destination_id?: string | null
          id?: string
          is_read?: boolean
          itinerary_id?: string | null
          message?: string
          news_item_id?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_alerts_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "itinerary_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_alerts_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "travel_itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_alerts_news_item_id_fkey"
            columns: ["news_item_id"]
            isOneToOne: false
            referencedRelation: "news_items"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_itineraries: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          notes: string | null
          start_date: string
          status: string
          traveler_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          notes?: string | null
          start_date: string
          status?: string
          traveler_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          status?: string
          traveler_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlists: {
        Row: {
          created_at: string
          description: string | null
          filters: Json
          id: string
          is_shared: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          is_shared?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          is_shared?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_news_items: { Args: never; Returns: number }
      client_can_see: {
        Args: { _country: string; _region: string }
        Returns: boolean
      }
      get_my_client_assignment: {
        Args: never
        Returns: {
          countries: string[]
          is_active: boolean
          regions: string[]
          services: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      actor_type: "state" | "non-state" | "organization"
      app_role: "analyst" | "client"
      confidence_level: "verified" | "developing" | "breaking"
      crisis_asset_type: "office" | "warehouse" | "employee" | "supplier"
      crisis_category: "Social" | "News" | "GovAlert" | "Weather" | "Traffic"
      crisis_pipeline_stage:
        | "ingestion"
        | "classified"
        | "geotagged"
        | "verified"
      crisis_severity: "critical" | "high" | "medium" | "low"
      crisis_status: "new" | "verified" | "active" | "resolved"
      news_category:
        | "security"
        | "diplomacy"
        | "economy"
        | "conflict"
        | "humanitarian"
        | "technology"
      source_credibility: "high" | "medium" | "low"
      threat_level: "low" | "elevated" | "high" | "critical"
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
      actor_type: ["state", "non-state", "organization"],
      app_role: ["analyst", "client"],
      confidence_level: ["verified", "developing", "breaking"],
      crisis_asset_type: ["office", "warehouse", "employee", "supplier"],
      crisis_category: ["Social", "News", "GovAlert", "Weather", "Traffic"],
      crisis_pipeline_stage: [
        "ingestion",
        "classified",
        "geotagged",
        "verified",
      ],
      crisis_severity: ["critical", "high", "medium", "low"],
      crisis_status: ["new", "verified", "active", "resolved"],
      news_category: [
        "security",
        "diplomacy",
        "economy",
        "conflict",
        "humanitarian",
        "technology",
      ],
      source_credibility: ["high", "medium", "low"],
      threat_level: ["low", "elevated", "high", "critical"],
    },
  },
} as const
