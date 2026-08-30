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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absence_events: {
        Row: {
          action_taken: Database["public"]["Enums"]["absence_action"]
          client_id: string
          coach_id: string
          created_at: string
          handled_by: string | null
          id: string
          level: Database["public"]["Enums"]["absence_level"]
          resolved_at: string | null
          trigger_date: string
        }
        Insert: {
          action_taken?: Database["public"]["Enums"]["absence_action"]
          client_id: string
          coach_id: string
          created_at?: string
          handled_by?: string | null
          id?: string
          level: Database["public"]["Enums"]["absence_level"]
          resolved_at?: string | null
          trigger_date: string
        }
        Update: {
          action_taken?: Database["public"]["Enums"]["absence_action"]
          client_id?: string
          coach_id?: string
          created_at?: string
          handled_by?: string | null
          id?: string
          level?: Database["public"]["Enums"]["absence_level"]
          resolved_at?: string | null
          trigger_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_events_client_coach_fkey"
            columns: ["client_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "absence_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_events_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          coach_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          coach_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          coach_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      client_staff_assignments: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          id: string
          staff_id: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          staff_id: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_staff_assignments_client_coach_fkey"
            columns: ["client_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "client_staff_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_staff_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_staff_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          end_date: string
          id: string
          notes: string | null
          payment_confirmed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["client_subscription_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          payment_confirmed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["client_subscription_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          payment_confirmed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["client_subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_coach_fkey"
            columns: ["client_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activation_expires_at: string | null
          activation_token_hash: string | null
          age: number | null
          coach_id: string
          condition_notes: string | null
          created_at: string
          height_cm: number | null
          id: string
          onboarding_completed: boolean
        }
        Insert: {
          activation_expires_at?: string | null
          activation_token_hash?: string | null
          age?: number | null
          coach_id: string
          condition_notes?: string | null
          created_at?: string
          height_cm?: number | null
          id: string
          onboarding_completed?: boolean
        }
        Update: {
          activation_expires_at?: string | null
          activation_token_hash?: string | null
          age?: number | null
          coach_id?: string
          condition_notes?: string | null
          created_at?: string
          height_cm?: number | null
          id?: string
          onboarding_completed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_subscriptions: {
        Row: {
          cancelled_at: string | null
          coach_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_name: string | null
          status: Database["public"]["Enums"]["coach_subscription_status"]
          stripe_subscription_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          coach_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string | null
          status?: Database["public"]["Enums"]["coach_subscription_status"]
          stripe_subscription_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          coach_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string | null
          status?: Database["public"]["Enums"]["coach_subscription_status"]
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_subscriptions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          created_at: string
          id: string
          settings: Json | null
          stripe_customer_id: string | null
          timezone: string
          trial_expires_at: string | null
          trial_started_at: string | null
          trial_status: Database["public"]["Enums"]["trial_status"]
          updated_at: string
          workspace_name: string
        }
        Insert: {
          created_at?: string
          id: string
          settings?: Json | null
          stripe_customer_id?: string | null
          timezone: string
          trial_expires_at?: string | null
          trial_started_at?: string | null
          trial_status?: Database["public"]["Enums"]["trial_status"]
          updated_at?: string
          workspace_name: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json | null
          stripe_customer_id?: string | null
          timezone?: string
          trial_expires_at?: string | null
          trial_started_at?: string | null
          trial_status?: Database["public"]["Enums"]["trial_status"]
          updated_at?: string
          workspace_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaches_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          id: string
          log_date: string
          meal_description: string | null
          meal_photo_key: string | null
          questions: string | null
          steps: number | null
          weight: number | null
          weight_photo_key: string | null
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          id?: string
          log_date: string
          meal_description?: string | null
          meal_photo_key?: string | null
          questions?: string | null
          steps?: number | null
          weight?: number | null
          weight_photo_key?: string | null
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          log_date?: string
          meal_description?: string | null
          meal_photo_key?: string | null
          questions?: string | null
          steps?: number | null
          weight?: number | null
          weight_photo_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_client_coach_fkey"
            columns: ["client_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "daily_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_cards: {
        Row: {
          client_id: string
          coach_id: string
          computed_at: string
          food_summary: string | null
          id: string
          interpretation: string | null
          last_log_at: string | null
          notes: string | null
          reason: string | null
          status: Database["public"]["Enums"]["flash_status"]
        }
        Insert: {
          client_id: string
          coach_id: string
          computed_at?: string
          food_summary?: string | null
          id?: string
          interpretation?: string | null
          last_log_at?: string | null
          notes?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["flash_status"]
        }
        Update: {
          client_id?: string
          coach_id?: string
          computed_at?: string
          food_summary?: string | null
          id?: string
          interpretation?: string | null
          last_log_at?: string | null
          notes?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["flash_status"]
        }
        Relationships: [
          {
            foreignKeyName: "flash_cards_client_coach_fkey"
            columns: ["client_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "flash_cards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_cards_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_entries: {
        Row: {
          client_id: string
          coach_id: string
          created_at: string
          description: string | null
          id: string
          log_date: string
          meal_type: Database["public"]["Enums"]["meal_type_enum"]
          photo_key: string | null
        }
        Insert: {
          client_id: string
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          log_date: string
          meal_type: Database["public"]["Enums"]["meal_type_enum"]
          photo_key?: string | null
        }
        Update: {
          client_id?: string
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          log_date?: string
          meal_type?: Database["public"]["Enums"]["meal_type_enum"]
          photo_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_entries_client_coach_fkey"
            columns: ["client_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "meal_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_entries_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          coach_id: string
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          coach_id: string
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          coach_id?: string
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          client_id: string
          coach_id: string
          id: string
          plan_id: string
          plan_type: string
          status: Database["public"]["Enums"]["plan_assign_status"]
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          client_id: string
          coach_id: string
          id?: string
          plan_id: string
          plan_type: string
          status?: Database["public"]["Enums"]["plan_assign_status"]
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          client_id?: string
          coach_id?: string
          id?: string
          plan_id?: string
          plan_type?: string
          status?: Database["public"]["Enums"]["plan_assign_status"]
        }
        Relationships: [
          {
            foreignKeyName: "plan_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_client_coach_fkey"
            columns: ["client_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "plan_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assignments_plan_coach_fkey"
            columns: ["plan_id", "coach_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id", "coach_id"]
          },
          {
            foreignKeyName: "plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          coach_id: string
          content: Json | null
          created_at: string
          id: string
          is_template: boolean
          status: Database["public"]["Enums"]["plan_status"]
          title: string
          type: Database["public"]["Enums"]["plan_type_enum"]
          updated_at: string
        }
        Insert: {
          coach_id: string
          content?: Json | null
          created_at?: string
          id?: string
          is_template?: boolean
          status?: Database["public"]["Enums"]["plan_status"]
          title: string
          type: Database["public"]["Enums"]["plan_type_enum"]
          updated_at?: string
        }
        Update: {
          coach_id?: string
          content?: Json | null
          created_at?: string
          id?: string
          is_template?: boolean
          status?: Database["public"]["Enums"]["plan_status"]
          title?: string
          type?: Database["public"]["Enums"]["plan_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_users: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean
          full_name: string
          id: string
          role_type: Database["public"]["Enums"]["role_type"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean
          full_name: string
          id: string
          role_type: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean
          full_name?: string
          id?: string
          role_type?: Database["public"]["Enums"]["role_type"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted: boolean
          id: string
          permission: string
          role_id: string
        }
        Insert: {
          granted?: boolean
          id?: string
          permission: string
          role_id: string
        }
        Update: {
          granted?: boolean
          id?: string
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          coach_id: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          locked: boolean
          name: string
          updated_at: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          locked?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          locked?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_assignments: {
        Row: {
          assigned_regions: string[] | null
          assigned_timezones: string[] | null
          coach_id: string
          created_at: string
          id: string
          role_id: string
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_regions?: string[] | null
          assigned_timezones?: string[] | null
          coach_id: string
          created_at?: string
          id?: string
          role_id: string
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_regions?: string[] | null
          assigned_timezones?: string[] | null
          coach_id?: string
          created_at?: string
          id?: string
          role_id?: string
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_plan: {
        Args: { p_client_id: string; p_plan_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          client_id: string
          coach_id: string
          id: string
          plan_id: string
          plan_type: string
          status: Database["public"]["Enums"]["plan_assign_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "plan_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      assign_staff_to_client: {
        Args: { p_client_id: string; p_staff_id: string }
        Returns: undefined
      }
      confirm_client_payment: {
        Args: { p_notes?: string; p_subscription_id: string }
        Returns: undefined
      }
      create_client_invite: {
        Args: { p_email: string; p_full_name: string; p_user_id: string }
        Returns: string
      }
      create_custom_role: {
        Args: {
          p_billing_manage?: boolean
          p_description?: string
          p_mark_payment?: boolean
          p_modify_plans?: boolean
          p_name: string
          p_read_team_scope?: boolean
        }
        Returns: string
      }
      deactivate_client: { Args: { p_client_id: string }; Returns: undefined }
      get_client_profile_summary: {
        Args: never
        Returns: {
          client_id: string
          coach_id: string
          coach_name: string
          email: string
          full_name: string
          grace_days_remaining: number
          onboarding_completed: boolean
          status: string
          subscription_end_date: string
          subscription_status: string
        }[]
      }
      get_conversation: {
        Args: { p_cursor?: string; p_participant_id: string }
        Returns: {
          coach_id: string
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_conversations: {
        Args: never
        Returns: {
          last_message: string
          last_message_at: string
          participant_id: string
          participant_name: string
          participant_role: string
          unread_count: number
        }[]
      }
      mark_absence_handled: {
        Args: {
          p_action: Database["public"]["Enums"]["absence_action"]
          p_event_id: string
        }
        Returns: undefined
      }
      mark_message_read: { Args: { p_message_id: string }; Returns: undefined }
      pause_client: { Args: { p_client_id: string }; Returns: undefined }
      reactivate_client: { Args: { p_client_id: string }; Returns: undefined }
      reassign_staff_clients: {
        Args: { p_from_staff_id: string; p_to_staff_id?: string }
        Returns: undefined
      }
      refresh_flash_card: {
        Args: { p_client_id: string }
        Returns: {
          client_id: string
          coach_id: string
          computed_at: string
          food_summary: string | null
          id: string
          interpretation: string | null
          last_log_at: string | null
          notes: string | null
          reason: string | null
          status: Database["public"]["Enums"]["flash_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "flash_cards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      regenerate_invite_token: {
        Args: { p_client_id: string }
        Returns: string
      }
      remove_staff_from_client: {
        Args: { p_client_id: string; p_staff_id: string }
        Returns: undefined
      }
      replace_active_plan: {
        Args: {
          p_client_id: string
          p_new_plan_id: string
          p_plan_type: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          client_id: string
          coach_id: string
          id: string
          plan_id: string
          plan_type: string
          status: Database["public"]["Enums"]["plan_assign_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "plan_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      resolve_absence: { Args: { p_event_id: string }; Returns: undefined }
      revoke_invite: { Args: { p_client_id: string }; Returns: undefined }
      send_message: {
        Args: { p_content: string; p_recipient_id: string }
        Returns: {
          coach_id: string
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unpause_client: { Args: { p_client_id: string }; Returns: undefined }
      update_client_profile: {
        Args: {
          p_age?: number
          p_condition_notes?: string
          p_height_cm?: number
        }
        Returns: {
          activation_expires_at: string | null
          activation_token_hash: string | null
          age: number | null
          coach_id: string
          condition_notes: string | null
          created_at: string
          height_cm: number | null
          id: string
          onboarding_completed: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_custom_role_permissions: {
        Args: {
          p_billing_manage?: boolean
          p_description?: string
          p_mark_payment?: boolean
          p_modify_plans?: boolean
          p_read_team_scope?: boolean
          p_role_id: string
        }
        Returns: undefined
      }
      update_flash_card_notes: {
        Args: { p_card_id: string; p_notes: string }
        Returns: {
          client_id: string
          coach_id: string
          computed_at: string
          food_summary: string | null
          id: string
          interpretation: string | null
          last_log_at: string | null
          notes: string | null
          reason: string | null
          status: Database["public"]["Enums"]["flash_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "flash_cards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_staff_status: {
        Args: {
          p_assignment_id: string
          p_status: Database["public"]["Enums"]["staff_status"]
        }
        Returns: undefined
      }
      update_today_log: {
        Args: {
          p_meal_description?: string
          p_meal_photo_key?: string
          p_questions?: string
          p_steps?: number
          p_weight?: number
          p_weight_photo_key?: string
        }
        Returns: {
          client_id: string
          coach_id: string
          created_at: string
          id: string
          log_date: string
          meal_description: string | null
          meal_photo_key: string | null
          questions: string | null
          steps: number | null
          weight: number | null
          weight_photo_key: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "daily_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      absence_action:
        | "pending"
        | "message_sent"
        | "escalated_to_coach"
        | "resolved"
      absence_level: "24h" | "48h" | "72h"
      client_subscription_status: "active" | "expired" | "overdue"
      coach_subscription_status: "active" | "past_due" | "cancelled" | "expired"
      flash_status: "green" | "yellow" | "red"
      meal_type_enum: "breakfast" | "lunch" | "dinner" | "snack"
      plan_assign_status: "active" | "completed" | "replaced"
      plan_status: "active" | "archived"
      plan_type_enum: "meal" | "workout"
      role_type: "super_admin" | "coach" | "assistant" | "client"
      staff_status: "active" | "disabled"
      trial_status:
        | "trial_not_started"
        | "trial_active"
        | "trial_expired"
        | "paid_active"
        | "paid_skipped_trial"
      user_status:
        | "pending"
        | "active"
        | "paused"
        | "suspended"
        | "banned"
        | "deactivated"
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
      absence_action: [
        "pending",
        "message_sent",
        "escalated_to_coach",
        "resolved",
      ],
      absence_level: ["24h", "48h", "72h"],
      client_subscription_status: ["active", "expired", "overdue"],
      coach_subscription_status: ["active", "past_due", "cancelled", "expired"],
      flash_status: ["green", "yellow", "red"],
      meal_type_enum: ["breakfast", "lunch", "dinner", "snack"],
      plan_assign_status: ["active", "completed", "replaced"],
      plan_status: ["active", "archived"],
      plan_type_enum: ["meal", "workout"],
      role_type: ["super_admin", "coach", "assistant", "client"],
      staff_status: ["active", "disabled"],
      trial_status: [
        "trial_not_started",
        "trial_active",
        "trial_expired",
        "paid_active",
        "paid_skipped_trial",
      ],
      user_status: [
        "pending",
        "active",
        "paused",
        "suspended",
        "banned",
        "deactivated",
      ],
    },
  },
} as const
