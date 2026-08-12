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
      aircraft: {
        Row: {
          aircraft_type: string
          amenities: string[] | null
          base_airport: string | null
          created_at: string | null
          cruise_speed_kts: number | null
          home_base_icao: string | null
          hourly_rate: number | null
          id: string
          images: string[] | null
          manufacturer: string | null
          max_range_nm: number | null
          model: string | null
          notes: string | null
          operator_id: string | null
          seating_capacity: number | null
          status: string | null
          tail_number: string
          updated_at: string | null
          year_of_manufacture: number | null
        }
        Insert: {
          aircraft_type: string
          amenities?: string[] | null
          base_airport?: string | null
          created_at?: string | null
          cruise_speed_kts?: number | null
          home_base_icao?: string | null
          hourly_rate?: number | null
          id?: string
          images?: string[] | null
          manufacturer?: string | null
          max_range_nm?: number | null
          model?: string | null
          notes?: string | null
          operator_id?: string | null
          seating_capacity?: number | null
          status?: string | null
          tail_number: string
          updated_at?: string | null
          year_of_manufacture?: number | null
        }
        Update: {
          aircraft_type?: string
          amenities?: string[] | null
          base_airport?: string | null
          created_at?: string | null
          cruise_speed_kts?: number | null
          home_base_icao?: string | null
          hourly_rate?: number | null
          id?: string
          images?: string[] | null
          manufacturer?: string | null
          max_range_nm?: number | null
          model?: string | null
          notes?: string | null
          operator_id?: string | null
          seating_capacity?: number | null
          status?: string | null
          tail_number?: string
          updated_at?: string | null
          year_of_manufacture?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          billing_entity: string | null
          client_type: string | null
          company_name: string
          company_website: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          department_name: string | null
          email: string | null
          first_name: string | null
          government_references: string | null
          id: string
          last_name: string | null
          middle_name: string | null
          mobile_number: string | null
          notes: string | null
          pa_contact: string | null
          pa_name: string | null
          phone: string | null
          preferred_currency: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          billing_entity?: string | null
          client_type?: string | null
          company_name: string
          company_website?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department_name?: string | null
          email?: string | null
          first_name?: string | null
          government_references?: string | null
          id?: string
          last_name?: string | null
          middle_name?: string | null
          mobile_number?: string | null
          notes?: string | null
          pa_contact?: string | null
          pa_name?: string | null
          phone?: string | null
          preferred_currency?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          billing_entity?: string | null
          client_type?: string | null
          company_name?: string
          company_website?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          department_name?: string | null
          email?: string | null
          first_name?: string | null
          government_references?: string | null
          id?: string
          last_name?: string | null
          middle_name?: string | null
          mobile_number?: string | null
          notes?: string | null
          pa_contact?: string | null
          pa_name?: string | null
          phone?: string | null
          preferred_currency?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      flight_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          flight_id: string
          id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          flight_id: string
          id?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          flight_id?: string
          id?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      flight_metrics: {
        Row: {
          aircraft_id: string | null
          cancellation_reason: string | null
          costs: number | null
          created_at: string | null
          delay_minutes: number | null
          flight_date: string
          flight_hours: number | null
          id: string
          on_time: boolean | null
          passengers: number | null
          profit: number | null
          quote_id: string | null
          revenue: number | null
          route_from: string | null
          route_to: string | null
        }
        Insert: {
          aircraft_id?: string | null
          cancellation_reason?: string | null
          costs?: number | null
          created_at?: string | null
          delay_minutes?: number | null
          flight_date: string
          flight_hours?: number | null
          id?: string
          on_time?: boolean | null
          passengers?: number | null
          profit?: number | null
          quote_id?: string | null
          revenue?: number | null
          route_from?: string | null
          route_to?: string | null
        }
        Update: {
          aircraft_id?: string | null
          cancellation_reason?: string | null
          costs?: number | null
          created_at?: string | null
          delay_minutes?: number | null
          flight_date?: string
          flight_hours?: number | null
          id?: string
          on_time?: boolean | null
          passengers?: number | null
          profit?: number | null
          quote_id?: string | null
          revenue?: number | null
          route_from?: string | null
          route_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_metrics_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_metrics_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_options: {
        Row: {
          aircraft_features: string[] | null
          aircraft_images: string[] | null
          aircraft_notes: string | null
          aircraft_registration: string | null
          aircraft_specs: Json | null
          aircraft_type: string
          availability_status: string | null
          available_times: string[] | null
          baggage_capacity: string | null
          base_price: number
          commission_percent: number | null
          created_at: string
          created_by: string
          currency: string | null
          estimated_duration: string | null
          flight_id: string
          id: string
          interior_images: string[] | null
          is_draft: boolean | null
          is_selected: boolean | null
          layout_image: string | null
          operator_id: string | null
          price_override: number | null
          updated_at: string
          vat_on_commission: boolean
        }
        Insert: {
          aircraft_features?: string[] | null
          aircraft_images?: string[] | null
          aircraft_notes?: string | null
          aircraft_registration?: string | null
          aircraft_specs?: Json | null
          aircraft_type: string
          availability_status?: string | null
          available_times?: string[] | null
          baggage_capacity?: string | null
          base_price: number
          commission_percent?: number | null
          created_at?: string
          created_by: string
          currency?: string | null
          estimated_duration?: string | null
          flight_id: string
          id?: string
          interior_images?: string[] | null
          is_draft?: boolean | null
          is_selected?: boolean | null
          layout_image?: string | null
          operator_id?: string | null
          price_override?: number | null
          updated_at?: string
          vat_on_commission?: boolean
        }
        Update: {
          aircraft_features?: string[] | null
          aircraft_images?: string[] | null
          aircraft_notes?: string | null
          aircraft_registration?: string | null
          aircraft_specs?: Json | null
          aircraft_type?: string
          availability_status?: string | null
          available_times?: string[] | null
          baggage_capacity?: string | null
          base_price?: number
          commission_percent?: number | null
          created_at?: string
          created_by?: string
          currency?: string | null
          estimated_duration?: string | null
          flight_id?: string
          id?: string
          interior_images?: string[] | null
          is_draft?: boolean | null
          is_selected?: boolean | null
          layout_image?: string | null
          operator_id?: string | null
          price_override?: number | null
          updated_at?: string
          vat_on_commission?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "flight_options_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_options_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_requests: {
        Row: {
          aircraft_id: string | null
          assigned_ops_id: string | null
          assigned_ops_name: string | null
          cancellation_reason: string | null
          client_id: string | null
          client_name: string | null
          commission_percent: number | null
          created_at: string
          created_by: string
          departure_date: string
          departure_time: string
          flight_legs: Json | null
          flight_type: string | null
          id: string
          is_urgent: boolean | null
          lead_id: string | null
          lost_reason: string | null
          operator_id: string | null
          options_status: string | null
          ops_accepted_at: string | null
          passengers: number
          preferred_aircraft_category: string | null
          flexibility_hours: number | null
          pricing_breakdown: Json | null
          quotation_id: string | null
          route_from: string
          route_to: string
          special_requests: string | null
          status_ops: string
          status_sales: string
          updated_at: string
        }
        Insert: {
          aircraft_id?: string | null
          assigned_ops_id?: string | null
          assigned_ops_name?: string | null
          cancellation_reason?: string | null
          client_id?: string | null
          client_name?: string | null
          commission_percent?: number | null
          created_at?: string
          created_by: string
          departure_date: string
          departure_time: string
          flight_legs?: Json | null
          flight_type?: string | null
          id?: string
          is_urgent?: boolean | null
          lead_id?: string | null
          lost_reason?: string | null
          operator_id?: string | null
          options_status?: string | null
          ops_accepted_at?: string | null
          passengers?: number
          preferred_aircraft_category?: string | null
          flexibility_hours?: number | null
          pricing_breakdown?: Json | null
          quotation_id?: string | null
          route_from: string
          route_to: string
          special_requests?: string | null
          status_ops?: string
          status_sales?: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string | null
          assigned_ops_id?: string | null
          assigned_ops_name?: string | null
          cancellation_reason?: string | null
          client_id?: string | null
          client_name?: string | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string
          departure_date?: string
          departure_time?: string
          flight_legs?: Json | null
          flight_type?: string | null
          id?: string
          is_urgent?: boolean | null
          lead_id?: string | null
          lost_reason?: string | null
          operator_id?: string | null
          options_status?: string | null
          ops_accepted_at?: string | null
          passengers?: number
          preferred_aircraft_category?: string | null
          flexibility_hours?: number | null
          pricing_breakdown?: Json | null
          quotation_id?: string | null
          route_from?: string
          route_to?: string
          special_requests?: string | null
          status_ops?: string
          status_sales?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_requests_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_status_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          flight_id: string
          id: string
          new_status_ops: string | null
          new_status_sales: string | null
          previous_status_ops: string | null
          previous_status_sales: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          flight_id: string
          id?: string
          new_status_ops?: string | null
          new_status_sales?: string | null
          previous_status_ops?: string | null
          previous_status_sales?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          flight_id?: string
          id?: string
          new_status_ops?: string | null
          new_status_sales?: string | null
          previous_status_ops?: string | null
          previous_status_sales?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_status_history_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          kpi_id: string
          start_date: string
          target_value: number
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          kpi_id: string
          start_date: string
          target_value: number
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          kpi_id?: string
          start_date?: string
          target_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "kpi_assignments_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metric_type: string
          name: string
          target_period: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_type?: string
          name: string
          target_period?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metric_type?: string
          name?: string
          target_period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kpi_progress: {
        Row: {
          assignment_id: string
          created_at: string
          current_value: number
          id: string
          notes: string | null
          recorded_date: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          current_value: number
          id?: string
          notes?: string | null
          recorded_date?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          current_value?: number
          id?: string
          notes?: string | null
          recorded_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_progress_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "kpi_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          billing_entity: string | null
          client_id: string | null
          company_name: string | null
          company_website: string | null
          converted_at: string | null
          converted_to_client_id: string | null
          created_at: string | null
          created_by: string | null
          deal_summary: string | null
          department_name: string | null
          description: string | null
          email: string | null
          estimated_value: number | null
          first_name: string | null
          government_references: string | null
          id: string
          last_name: string | null
          lead_type: string | null
          middle_name: string | null
          mobile_number: string | null
          next_action_date: string | null
          next_action_time: string | null
          next_action_note: string | null
          notes: string | null
          pa_contact: string | null
          pa_name: string | null
          phone: string | null
          preferred_currency: string | null
          priority: string | null
          probability: number | null
          reference_number: string | null
          service_type: string | null
          source: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          billing_entity?: string | null
          client_id?: string | null
          company_name?: string | null
          company_website?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_summary?: string | null
          department_name?: string | null
          description?: string | null
          email?: string | null
          estimated_value?: number | null
          first_name?: string | null
          government_references?: string | null
          id?: string
          last_name?: string | null
          lead_type?: string | null
          middle_name?: string | null
          mobile_number?: string | null
          next_action_date?: string | null
          next_action_time?: string | null
          next_action_note?: string | null
          notes?: string | null
          pa_contact?: string | null
          pa_name?: string | null
          phone?: string | null
          preferred_currency?: string | null
          priority?: string | null
          probability?: number | null
          reference_number?: string | null
          service_type?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          billing_entity?: string | null
          client_id?: string | null
          company_name?: string | null
          company_website?: string | null
          converted_at?: string | null
          converted_to_client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_summary?: string | null
          department_name?: string | null
          description?: string | null
          email?: string | null
          estimated_value?: number | null
          first_name?: string | null
          government_references?: string | null
          id?: string
          last_name?: string | null
          lead_type?: string | null
          middle_name?: string | null
          mobile_number?: string | null
          next_action_date?: string | null
          next_action_time?: string | null
          next_action_note?: string | null
          notes?: string | null
          pa_contact?: string | null
          pa_name?: string | null
          phone?: string | null
          preferred_currency?: string | null
          priority?: string | null
          probability?: number | null
          reference_number?: string | null
          service_type?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_to_client_id_fkey"
            columns: ["converted_to_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          activity_type: string
          description: string
          created_by: string | null
          created_by_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          activity_type?: string
          description: string
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          activity_type?: string
          description?: string
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_windows: {
        Row: {
          aircraft_id: string
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          maintenance_type: string
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          maintenance_type: string
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          maintenance_type?: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_windows_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          flight_id: string
          id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          content: string
          created_at?: string
          flight_id: string
          id?: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          content?: string
          created_at?: string
          flight_id?: string
          id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          flight_id: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flight_id?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          flight_id?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flight_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          aoc_number: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          id: string
          insurance_expiry: string | null
          name: string
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aoc_number?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          insurance_expiry?: string | null
          name: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aoc_number?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          insurance_expiry?: string | null
          name?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          departure_date: string | null
          description: string | null
          estimated_value: number | null
          id: string
          lead_id: string | null
          passengers: number | null
          probability: number | null
          return_date: string | null
          route_from: string | null
          route_to: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          departure_date?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          passengers?: number | null
          probability?: number | null
          return_date?: string | null
          route_from?: string | null
          route_to?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          departure_date?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          lead_id?: string | null
          passengers?: number | null
          probability?: number | null
          return_date?: string | null
          route_from?: string | null
          route_to?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          must_change_password: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          aircraft_id: string | null
          base_price: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          crew_costs: number | null
          currency: string | null
          departure_date: string
          flight_hours: number | null
          fuel_surcharge: number | null
          handling_fees: number | null
          id: string
          landing_fees: number | null
          margin_percent: number | null
          notes: string | null
          opportunity_id: string | null
          passengers: number | null
          quote_number: string
          rate_card_id: string | null
          repositioning_costs: number | null
          return_date: string | null
          route_from: string
          route_to: string
          status: string | null
          taxes: number | null
          total_price: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          aircraft_id?: string | null
          base_price?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_costs?: number | null
          currency?: string | null
          departure_date: string
          flight_hours?: number | null
          fuel_surcharge?: number | null
          handling_fees?: number | null
          id?: string
          landing_fees?: number | null
          margin_percent?: number | null
          notes?: string | null
          opportunity_id?: string | null
          passengers?: number | null
          quote_number: string
          rate_card_id?: string | null
          repositioning_costs?: number | null
          return_date?: string | null
          route_from: string
          route_to: string
          status?: string | null
          taxes?: number | null
          total_price?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          aircraft_id?: string | null
          base_price?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_costs?: number | null
          currency?: string | null
          departure_date?: string
          flight_hours?: number | null
          fuel_surcharge?: number | null
          handling_fees?: number | null
          id?: string
          landing_fees?: number | null
          margin_percent?: number | null
          notes?: string | null
          opportunity_id?: string | null
          passengers?: number | null
          quote_number?: string
          rate_card_id?: string | null
          repositioning_costs?: number | null
          return_date?: string | null
          route_from?: string
          route_to?: string
          status?: string | null
          taxes?: number | null
          total_price?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_cards: {
        Row: {
          aircraft_type: string | null
          created_at: string | null
          created_by: string | null
          crew_overnight_rate: number | null
          fuel_surcharge_percent: number | null
          handling_fee_estimate: number | null
          hourly_rate: number
          id: string
          is_active: boolean | null
          landing_fee_estimate: number | null
          minimum_hours: number | null
          name: string
          repositioning_fee: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          aircraft_type?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_overnight_rate?: number | null
          fuel_surcharge_percent?: number | null
          handling_fee_estimate?: number | null
          hourly_rate: number
          id?: string
          is_active?: boolean | null
          landing_fee_estimate?: number | null
          minimum_hours?: number | null
          name: string
          repositioning_fee?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          aircraft_type?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_overnight_rate?: number | null
          fuel_surcharge_percent?: number | null
          handling_fee_estimate?: number | null
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          landing_fee_estimate?: number | null
          minimum_hours?: number | null
          name?: string
          repositioning_fee?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_flight: { Args: { _flight_id: string }; Returns: boolean }
      convert_lead_to_client: { Args: { p_lead_id: string }; Returns: string }
      get_operations_user_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "sales" | "operations" | "admin" | "super_admin"
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
      app_role: ["sales", "operations", "admin", "super_admin"],
    },
  },
} as const
