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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          decision_by: string | null
          decision_message: string | null
          id: string
          manager_message: string | null
          recommended_amount: number | null
          recommended_estimate_id: string | null
          request_id: string
          requested_at: string
          requested_by: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          decision_by?: string | null
          decision_message?: string | null
          id?: string
          manager_message?: string | null
          recommended_amount?: number | null
          recommended_estimate_id?: string | null
          request_id: string
          requested_at?: string
          requested_by?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          decision_by?: string | null
          decision_message?: string | null
          id?: string
          manager_message?: string | null
          recommended_amount?: number | null
          recommended_estimate_id?: string | null
          request_id?: string
          requested_at?: string
          requested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_recommended_estimate_id_fkey"
            columns: ["recommended_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          amount: number
          attachment_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_recommended: boolean
          received_at: string
          request_id: string
          scope_of_work: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_recommended?: boolean
          received_at?: string
          request_id: string
          scope_of_work?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          attachment_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_recommended?: boolean
          received_at?: string
          request_id?: string
          scope_of_work?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "request_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_impact_notes: {
        Row: {
          amount: number | null
          author_id: string | null
          category: Database["public"]["Enums"]["impact_category"]
          created_at: string
          id: string
          note: string
          owner_visible: boolean
          request_id: string
          timeframe: Database["public"]["Enums"]["impact_timeframe"]
        }
        Insert: {
          amount?: number | null
          author_id?: string | null
          category: Database["public"]["Enums"]["impact_category"]
          created_at?: string
          id?: string
          note: string
          owner_visible?: boolean
          request_id: string
          timeframe: Database["public"]["Enums"]["impact_timeframe"]
        }
        Update: {
          amount?: number | null
          author_id?: string | null
          category?: Database["public"]["Enums"]["impact_category"]
          created_at?: string
          id?: string
          note?: string
          owner_visible?: boolean
          request_id?: string
          timeframe?: Database["public"]["Enums"]["impact_timeframe"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_impact_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          property_id: string
          txn_date: string
          txn_type: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          property_id: string
          txn_date: string
          txn_type: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          property_id?: string
          txn_date?: string
          txn_type?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          access_information: string | null
          approval_required: boolean
          approved_amount: number | null
          assigned_manager_id: string | null
          assigned_vendor_id: string | null
          category: string | null
          closed_at: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          manager_urgency: Database["public"]["Enums"]["urgency_level"] | null
          organization_id: string
          permission_to_enter: boolean
          preferred_access_times: string | null
          property_id: string
          recommended_action: string | null
          request_number: string
          responsibility:
            | Database["public"]["Enums"]["responsibility_type"]
            | null
          responsibility_notes: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string
          submitted_by: string | null
          suite_id: string | null
          target_completion_date: string | null
          tenant_company_id: string | null
          tenant_urgency: Database["public"]["Enums"]["urgency_level"]
          title: string
          updated_at: string
        }
        Insert: {
          access_information?: string | null
          approval_required?: boolean
          approved_amount?: number | null
          assigned_manager_id?: string | null
          assigned_vendor_id?: string | null
          category?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          manager_urgency?: Database["public"]["Enums"]["urgency_level"] | null
          organization_id: string
          permission_to_enter?: boolean
          preferred_access_times?: string | null
          property_id: string
          recommended_action?: string | null
          request_number?: string
          responsibility?:
            | Database["public"]["Enums"]["responsibility_type"]
            | null
          responsibility_notes?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string
          submitted_by?: string | null
          suite_id?: string | null
          target_completion_date?: string | null
          tenant_company_id?: string | null
          tenant_urgency?: Database["public"]["Enums"]["urgency_level"]
          title: string
          updated_at?: string
        }
        Update: {
          access_information?: string | null
          approval_required?: boolean
          approved_amount?: number | null
          assigned_manager_id?: string | null
          assigned_vendor_id?: string | null
          category?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          manager_urgency?: Database["public"]["Enums"]["urgency_level"] | null
          organization_id?: string
          permission_to_enter?: boolean
          preferred_access_times?: string | null
          property_id?: string
          recommended_action?: string | null
          request_number?: string
          responsibility?:
            | Database["public"]["Enums"]["responsibility_type"]
            | null
          responsibility_notes?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string
          submitted_by?: string | null
          suite_id?: string | null
          target_completion_date?: string | null
          tenant_company_id?: string | null
          tenant_urgency?: Database["public"]["Enums"]["urgency_level"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_company_id_fkey"
            columns: ["tenant_company_id"]
            isOneToOne: false
            referencedRelation: "tenant_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          request_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          request_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          request_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      owner_entities: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_entity_users: {
        Row: {
          created_at: string
          id: string
          owner_entity_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_entity_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_entity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_entity_users_owner_entity_id_fkey"
            columns: ["owner_entity_id"]
            isOneToOne: false
            referencedRelation: "owner_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          owner_entity_id: string
          postal_code: string | null
          property_type: string | null
          square_feet: number | null
          state: string | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          owner_entity_id: string
          postal_code?: string | null
          property_type?: string | null
          square_feet?: number | null
          state?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          owner_entity_id?: string
          postal_code?: string | null
          property_type?: string | null
          square_feet?: number | null
          state?: string | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_entity_id_fkey"
            columns: ["owner_entity_id"]
            isOneToOne: false
            referencedRelation: "owner_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      property_budgets: {
        Row: {
          budgeted_amount: number
          category: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          property_id: string
          updated_at: string
          year: number
        }
        Insert: {
          budgeted_amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id: string
          updated_at?: string
          year: number
        }
        Update: {
          budgeted_amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_budgets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_financials: {
        Row: {
          created_at: string
          created_by: string | null
          gross_income: number
          id: string
          notes: string | null
          operating_expenses: number
          other_income: number
          period_month: string
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gross_income?: number
          id?: string
          notes?: string | null
          operating_expenses?: number
          other_income?: number
          period_month: string
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gross_income?: number
          id?: string
          notes?: string | null
          operating_expenses?: number
          other_income?: number
          period_month?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_financials_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_manager_assignments: {
        Row: {
          created_at: string
          id: string
          manager_user_id: string
          property_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_user_id: string
          property_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_user_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_manager_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_valuations: {
        Row: {
          as_of_date: string
          created_at: string
          created_by: string | null
          id: string
          market_value: number
          property_id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          as_of_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          market_value: number
          property_id: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          as_of_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          market_value?: number
          property_id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_valuations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["attachment_type"]
          content_type: string | null
          created_at: string
          file_name: string | null
          id: string
          owner_visible: boolean
          request_id: string
          size_bytes: number | null
          storage_path: string
          tenant_visible: boolean
          uploaded_by: string | null
        }
        Insert: {
          attachment_type?: Database["public"]["Enums"]["attachment_type"]
          content_type?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          owner_visible?: boolean
          request_id: string
          size_bytes?: number | null
          storage_path: string
          tenant_visible?: boolean
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["attachment_type"]
          content_type?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          owner_visible?: boolean
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_visible?: boolean
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          request_id: string
          visibility: Database["public"]["Enums"]["comment_visibility"]
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          request_id: string
          visibility?: Database["public"]["Enums"]["comment_visibility"]
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          visibility?: Database["public"]["Enums"]["comment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      suites: {
        Row: {
          created_at: string
          floor: string | null
          id: string
          notes: string | null
          property_id: string
          square_feet: number | null
          suite_number: string
          suite_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          property_id: string
          square_feet?: number | null
          suite_number: string
          suite_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          property_id?: string
          square_feet?: number | null
          suite_number?: string
          suite_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_companies: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_suite_assignments: {
        Row: {
          created_at: string
          id: string
          lease_end: string | null
          lease_start: string | null
          suite_id: string
          tenant_company_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          suite_id: string
          tenant_company_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          suite_id?: string
          tenant_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_suite_assignments_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_suite_assignments_tenant_company_id_fkey"
            columns: ["tenant_company_id"]
            isOneToOne: false
            referencedRelation: "tenant_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          is_primary_contact: boolean
          tenant_company_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          tenant_company_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary_contact?: boolean
          tenant_company_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_company_id_fkey"
            columns: ["tenant_company_id"]
            isOneToOne: false
            referencedRelation: "tenant_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          active: boolean
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          insurance_expiration: string | null
          license_number: string | null
          name: string
          notes: string | null
          organization_id: string
          trade: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          insurance_expiration?: string | null
          license_number?: string | null
          name: string
          notes?: string | null
          organization_id: string
          trade?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          insurance_expiration?: string | null
          license_number?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_completion_records: {
        Row: {
          completed_on: string | null
          created_at: string
          final_cost: number | null
          id: string
          invoice_number: string | null
          notes: string | null
          recorded_by: string | null
          request_id: string
          vendor_id: string | null
          warranty_details: string | null
          warranty_expires_on: string | null
        }
        Insert: {
          completed_on?: string | null
          created_at?: string
          final_cost?: number | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          recorded_by?: string | null
          request_id: string
          vendor_id?: string | null
          warranty_details?: string | null
          warranty_expires_on?: string | null
        }
        Update: {
          completed_on?: string | null
          created_at?: string
          final_cost?: number | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          recorded_by?: string | null
          request_id?: string
          vendor_id?: string | null
          warranty_details?: string | null
          warranty_expires_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_completion_records_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_completion_records_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "property_manager" | "owner" | "tenant"
      approval_decision:
        | "pending"
        | "approved"
        | "declined"
        | "additional_estimate_requested"
        | "question"
      attachment_type:
        | "initial_photo"
        | "estimate"
        | "invoice"
        | "completion_photo"
        | "warranty"
        | "other"
      comment_visibility:
        | "internal_manager"
        | "manager_owner"
        | "manager_tenant"
        | "all_parties"
      impact_category:
        | "current_operating_budget"
        | "cash_flow"
        | "future_operating_expense"
        | "capital_expenditure"
        | "preventive_maintenance"
        | "lease_term_consideration"
        | "tenant_responsibility"
        | "insurance_or_warranty"
        | "compliance_or_safety"
        | "revenue_or_tenant_retention_risk"
        | "other"
      impact_timeframe:
        | "immediate"
        | "current_month"
        | "current_quarter"
        | "current_year"
        | "next_budget_year"
        | "long_term"
      request_status:
        | "submitted"
        | "manager_review"
        | "awaiting_information"
        | "estimating"
        | "awaiting_owner_approval"
        | "owner_question"
        | "additional_estimate_requested"
        | "approved"
        | "declined"
        | "vendor_coordination"
        | "scheduled"
        | "in_progress"
        | "work_completed"
        | "invoice_pending"
        | "completed"
        | "closed"
        | "cancelled"
      responsibility_type:
        | "owner"
        | "tenant"
        | "shared"
        | "warranty"
        | "unknown"
      urgency_level: "routine" | "soon" | "urgent" | "emergency"
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
      app_role: ["admin", "property_manager", "owner", "tenant"],
      approval_decision: [
        "pending",
        "approved",
        "declined",
        "additional_estimate_requested",
        "question",
      ],
      attachment_type: [
        "initial_photo",
        "estimate",
        "invoice",
        "completion_photo",
        "warranty",
        "other",
      ],
      comment_visibility: [
        "internal_manager",
        "manager_owner",
        "manager_tenant",
        "all_parties",
      ],
      impact_category: [
        "current_operating_budget",
        "cash_flow",
        "future_operating_expense",
        "capital_expenditure",
        "preventive_maintenance",
        "lease_term_consideration",
        "tenant_responsibility",
        "insurance_or_warranty",
        "compliance_or_safety",
        "revenue_or_tenant_retention_risk",
        "other",
      ],
      impact_timeframe: [
        "immediate",
        "current_month",
        "current_quarter",
        "current_year",
        "next_budget_year",
        "long_term",
      ],
      request_status: [
        "submitted",
        "manager_review",
        "awaiting_information",
        "estimating",
        "awaiting_owner_approval",
        "owner_question",
        "additional_estimate_requested",
        "approved",
        "declined",
        "vendor_coordination",
        "scheduled",
        "in_progress",
        "work_completed",
        "invoice_pending",
        "completed",
        "closed",
        "cancelled",
      ],
      responsibility_type: ["owner", "tenant", "shared", "warranty", "unknown"],
      urgency_level: ["routine", "soon", "urgent", "emergency"],
    },
  },
} as const
