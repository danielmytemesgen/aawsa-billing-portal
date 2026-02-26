export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bills: {
        Row: {
          amount_paid: number | null
          balance_carried_forward: number | null
          balance_due: number | null
          base_water_charge: number
          bill_number: string | null
          bill_period_end_date: string
          bill_period_start_date: string
          bulk_meter_id: string | null
          created_at: string | null
          current_reading_value: number
          difference_usage: number | null
          due_date: string
          id: string
          individual_customer_id: string | null
          maintenance_fee: number | null
          meter_rent: number | null
          month_year: string
          notes: string | null
          payment_status: "Paid" | "Unpaid"
          previous_reading_value: number
          sanitation_fee: number | null
          sewerage_charge: number | null
          total_amount_due: number
          updated_at: string | null
          usage_m3: number | null
        }
        Insert: {
          amount_paid?: number | null
          balance_carried_forward?: number | null
          balance_due?: number | null
          base_water_charge: number
          bill_number?: string | null
          bill_period_end_date: string
          bill_period_start_date: string
          bulk_meter_id?: string | null
          created_at?: string | null
          current_reading_value: number
          difference_usage?: number | null
          due_date: string
          id?: string
          individual_customer_id?: string | null
          maintenance_fee?: number | null
          meter_rent?: number | null
          month_year: string
          notes?: string | null
          payment_status?: "Paid" | "Unpaid"
          previous_reading_value: number
          sanitation_fee?: number | null
          sewerage_charge?: number | null
          total_amount_due: number
          updated_at?: string | null
          usage_m3?: number | null
        }
        Update: {
          amount_paid?: number | null
          balance_carried_forward?: number | null
          balance_due?: number | null
          base_water_charge?: number
          bill_number?: string | null
          bill_period_end_date?: string
          bill_period_start_date?: string
          bulk_meter_id?: string | null
          created_at?: string | null
          current_reading_value?: number
          difference_usage?: number | null
          due_date?: string
          id?: string
          individual_customer_id?: string | null
          maintenance_fee?: number | null
          meter_rent?: number | null
          month_year?: string
          notes?: string | null
          payment_status?: "Paid" | "Unpaid"
          previous_reading_value?: number
          sanitation_fee?: number | null
          sewerage_charge?: number | null
          total_amount_due?: number
          updated_at?: string | null
          usage_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_bulk_meter_id_fkey"
            columns: ["bulk_meter_id"]
            isOneToOne: false
            referencedRelation: "bulk_meters"
            referencedColumns: ["customerKeyNumber"]
          },
          {
            foreignKeyName: "bills_individual_customer_id_fkey"
            columns: ["individual_customer_id"]
            isOneToOne: false
            referencedRelation: "individual_customers"
            referencedColumns: ["customerKeyNumber"]
          },
        ]
      }
      branches: {
        Row: {
          contactPerson: string | null
          contactPhone: number | null
          created_at: string | null
          id: string
          location: string
          name: string
          status: "Active" | "Inactive"
          updated_at: string | null
        }
        Insert: {
          contactPerson?: string | null
          contactPhone?: number | null
          created_at?: string | null
          id?: string
          location: string
          name: string
          status: "Active" | "Inactive"
          updated_at?: string | null
        }
        Update: {
          contactPerson?: string | null
          contactPhone?: number | null
          created_at?: string | null
          id?: string
          location?: string
          name?: string
          status?: "Active" | "Inactive"
          updated_at?: string | null
        }
        Relationships: []
      }
      bulk_meter_readings: {
        Row: {
          bulk_meter_id: string
          created_at: string | null
          id: string
          is_estimate: boolean | null
          month_year: string
          notes: string | null
          reader_staff_id: string | null
          reading_date: string
          reading_value: number
          updated_at: string | null
        }
        Insert: {
          bulk_meter_id: string
          created_at?: string | null
          id?: string
          is_estimate?: boolean | null
          month_year: string
          notes?: string | null
          reader_staff_id?: string | null
          reading_date?: string
          reading_value: number
          updated_at?: string | null
        }
        Update: {
          bulk_meter_id?: string
          created_at?: string | null
          id?: string
          is_estimate?: boolean | null
          month_year?: string
          notes?: string | null
          reader_staff_id?: string | null
          reading_date?: string
          reading_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_meter_readings_bulk_meter_id_fkey"
            columns: ["bulk_meter_id"]
            isOneToOne: false
            referencedRelation: "bulk_meters"
            referencedColumns: ["customerKeyNumber"]
          },
          {
            foreignKeyName: "bulk_meter_readings_reader_staff_id_fkey"
            columns: ["reader_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_meters: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          bulk_usage: number | null
          charge_group: "Domestic" | "Non-domestic"
          contractNumber: string
          createdAt: string | null
          currentReading: number
          customerKeyNumber: string
          difference_bill: number | null
          difference_usage: number | null
          meterNumber: string
          meterSize: number
          month: string
          name: string
          outStandingbill: number | null
          phoneNumber: string | null
          paymentStatus: "Paid" | "Unpaid"
          previousReading: number
          sewerage_connection: "Yes" | "No"
          specificArea: string
          status: "Active" | "Maintenance" | "Pending Approval" | "Rejected"
          subCity: string
          total_bulk_bill: number | null
          updatedAt: string | null
          woreda: string
          x_coordinate: number | null
          y_coordinate: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          bulk_usage?: number | null
          charge_group: "Domestic" | "Non-domestic"
          contractNumber: string
          createdAt?: string | null
          currentReading: number
          customerKeyNumber: string
          difference_bill?: number | null
          difference_usage?: number | null
          meterNumber: string
          meterSize: number
          month: string
          name: string
          outStandingbill?: number | null
          phoneNumber?: string | null
          paymentStatus: "Paid" | "Unpaid"
          previousReading: number
          sewerage_connection: "Yes" | "No"
          specificArea: string
          status: "Active" | "Maintenance" | "Pending Approval" | "Rejected"
          subCity: string
          total_bulk_bill?: number | null
          updatedAt?: string | null
          woreda: string
          x_coordinate?: number | null
          y_coordinate?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          bulk_usage?: number | null
          charge_group?: "Domestic" | "Non-domestic"
          contractNumber?: string
          createdAt?: string | null
          currentReading?: number
          customerKeyNumber?: string
          difference_bill?: number | null
          difference_usage?: number | null
          meterNumber?: string
          meterSize?: number
          month?: string
          name?: string
          outStandingbill?: number | null
          phoneNumber?: string | null
          paymentStatus?: "Paid" | "Unpaid"
          previousReading?: number
          sewerage_connection?: "Yes" | "No"
          specificArea?: string
          status?: "Active" | "Maintenance" | "Pending Approval" | "Rejected"
          subCity?: string
          total_bulk_bill?: number | null
          updatedAt?: string | null
          woreda?: string
          x_coordinate?: number | null
          y_coordinate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bulk_meters_approved_by_staff"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_customer_readings: {
        Row: {
          created_at: string | null
          id: string
          individual_customer_id: string
          is_estimate: boolean | null
          month_year: string
          notes: string | null
          reader_staff_id: string | null
          reading_date: string
          reading_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          individual_customer_id: string
          is_estimate?: boolean | null
          month_year: string
          notes?: string | null
          reader_staff_id?: string | null
          reading_date?: string
          reading_value: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          individual_customer_id?: string
          is_estimate?: boolean | null
          month_year?: string
          notes?: string | null
          reader_staff_id?: string | null
          reading_date?: string
          reading_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "individual_customer_readings_individual_customer_id_fkey"
            columns: ["individual_customer_id"]
            isOneToOne: false
            referencedRelation: "individual_customers"
            referencedColumns: ["customerKeyNumber"]
          },
          {
            foreignKeyName: "individual_customer_readings_reader_staff_id_fkey"
            columns: ["reader_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_customers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignedBulkMeterId: string | null
          bookNumber: string
          branch_id: string | null
          calculatedBill: number
          contractNumber: string
          created_at: string | null
          currentReading: number
          customerKeyNumber: string
          customerType: "Domestic" | "Non-domestic"
          meterNumber: string
          meterSize: number
          month: string
          name: string
          ordinal: number
          paymentStatus: "Paid" | "Unpaid" | "Pending"
          previousReading: number
          sewerageConnection: "Yes" | "No"
          specificArea: string
          status: "Active" | "Inactive" | "Suspended" | "Pending Approval" | "Rejected"
          subCity: string
          updated_at: string | null
          woreda: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignedBulkMeterId?: string | null
          bookNumber: string
          branch_id?: string | null
          calculatedBill?: number
          contractNumber: string
          created_at?: string | null
          currentReading: number
          customerKeyNumber: string
          customerType: "Domestic" | "Non-domestic"
          meterNumber: string
          meterSize: number
          month: string
          name: string
          ordinal: number
          paymentStatus?: "Paid" | "Unpaid" | "Pending"
          previousReading: number
          sewerageConnection: "Yes" | "No"
          specificArea: string
          status?: "Active" | "Inactive" | "Suspended" | "Pending Approval" | "Rejected"
          subCity: string
          updated_at?: string | null
          woreda: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignedBulkMeterId?: string | null
          bookNumber?: string
          branch_id?: string | null
          calculatedBill?: number
          contractNumber?: string
          created_at?: string | null
          currentReading?: number
          customerKeyNumber?: string
          customerType?: "Domestic" | "Non-domestic"
          meterNumber?: string
          meterSize?: number
          month?: string
          name?: string
          ordinal?: number
          paymentStatus?: "Paid" | "Unpaid" | "Pending"
          previousReading?: number
          sewerageConnection?: "Yes" | "No"
          specificArea?: string
          status?: "Active" | "Inactive" | "Suspended" | "Pending Approval" | "Rejected"
          subCity?: string
          updated_at?: string | null
          woreda?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_assigned_bulk_meter"
            columns: ["assignedBulkMeterId"]
            isOneToOne: false
            referencedRelation: "bulk_meters"
            referencedColumns: ["customerKeyNumber"]
          },
          {
            foreignKeyName: "individual_customers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_articles: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: number
          keywords: string[] | null
          title: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: number
          keywords?: string[] | null
          title: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: number
          keywords?: string[] | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_name: string
          target_branch_id: string | null
          phoneNumber: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_name: string
          target_branch_id?: string | null
          phoneNumber?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_name?: string
          target_branch_id?: string | null
          phoneNumber?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_target_branch_id_fkey"
            columns: ["target_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          bill_id: string | null
          created_at: string | null
          id: string
          individual_customer_id: string | null
          notes: string | null
          payment_date: string
          payment_method:
            | "Cash"
            | "Bank Transfer"
            | "Mobile Money"
            | "Online Payment"
            | "Other"
          processed_by_staff_id: string | null
          transaction_reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid: number
          bill_id?: string | null
          created_at?: string | null
          id?: string
          individual_customer_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method:
            | "Cash"
            | "Bank Transfer"
            | "Mobile Money"
            | "Online Payment"
            | "Other"
          processed_by_staff_id?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number
          bill_id?: string | null
          created_at?: string | null
          id?: string
          individual_customer_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?:
            | "Cash"
            | "Bank Transfer"
            | "Mobile Money"
            | "Online Payment"
            | "Other"
          processed_by_staff_id?: string | null
          transaction_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_individual_customer_id_fkey"
            columns: ["individual_customer_id"]
            isOneToOne: false
            referencedRelation: "individual_customers"
            referencedColumns: ["customerKeyNumber"]
          },
          {
            foreignKeyName: "payments_processed_by_staff_id_fkey"
            columns: ["processed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: number
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          description: string | null
          file_format: string | null
          file_name: string | null
          generated_at: string
          generated_by_staff_id: string | null
          id: string
          parameters: Json | null
          report_name:
            | "CustomerDataExport"
            | "BulkMeterDataExport"
            | "BillingSummary"
            | "WaterUsageReport"
            | "PaymentHistoryReport"
            | "MeterReadingAccuracy"
          status: "Generated" | "Pending" | "Failed" | "Archived" | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_format?: string | null
          file_name?: string | null
          generated_at?: string
          generated_by_staff_id?: string | null
          id?: string
          parameters?: Json | null
          report_name:
            | "CustomerDataExport"
            | "BulkMeterDataExport"
            | "BillingSummary"
            | "WaterUsageReport"
            | "PaymentHistoryReport"
            | "MeterReadingAccuracy"
          status?: "Generated" | "Pending" | "Failed" | "Archived" | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_format?: string | null
          file_name?: string | null
          generated_at?: string
          generated_by_staff_id?: string | null
          id?: string
          parameters?: Json | null
          report_name?:
            | "CustomerDataExport"
            | "BulkMeterDataExport"
            | "BillingSummary"
            | "WaterUsageReport"
            | "PaymentHistoryReport"
            | "MeterReadingAccuracy"
          status?: "Generated" | "Pending" | "Failed" | "Archived" | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_generated_by_staff_id_fkey"
            columns: ["generated_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: number
          role_id: number
        }
        Insert: {
          created_at?: string
          permission_id: number
          role_id: number
        }
        Update: {
          created_at?: string
          permission_id?: number
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
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
          created_at: string
          description: string | null
          id: number
          role_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          role_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          branch: string
          created_at: string | null
          email: string
          hire_date: string | null
          id: string
          name: string
          password: string
          phone: string | null
          role: string
          role_id: number | null
          status: "Active" | "Inactive" | "On Leave"
          updated_at: string | null
        }
        Insert: {
          branch: string
          created_at?: string | null
          email: string
          hire_date?: string | null
          id: string
          name: string
          password?: string
          phone?: string | null
          role: string
          role_id?: number | null
          status: "Active" | "Inactive" | "On Leave"
          updated_at?: string | null
        }
        Update: {
          branch?: string
          created_at?: string | null
          email?: string
          hire_date?: string | null
          id?: string
          name?: string
          password?: string
          phone?: string | null
          role?: string
          role_id?: number | null
          status?: "Active" | "Inactive" | "On Leave"
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          created_at: string
          customer_type: string
          domestic_vat_threshold_m3: number
          maintenance_percentage: number
          meter_rent_prices: Json | null
          sanitation_percentage: number
          sewerage_tiers: Json | null
          tiers: Json
          updated_at: string
          vat_rate: number
          year: number
        }
        Insert: {
          created_at?: string
          customer_type: string
          domestic_vat_threshold_m3?: number
          maintenance_percentage?: number
          meter_rent_prices?: Json | null
          sanitation_percentage: number
          sewerage_tiers?: Json | null
          tiers: Json
          updated_at?: string
          vat_rate?: number
          year: number
        }
        Update: {
          created_at?: string
          customer_type?: string
          domestic_vat_threshold_m3?: number
          maintenance_percentage?: number
          meter_rent_prices?: Json | null
          sanitation_percentage?: number
          sewerage_tiers?: Json | null
          tiers?: Json
          updated_at?: string
          vat_rate?: number
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      insert_notification: {
        Args: {
          p_title: string
          p_message: string
          p_sender_name: string
          p_target_branch_id: string | null
        }
        Returns: {
          id: string
          created_at: string
          title: string
          message: string
          sender_name: string
          target_branch_id: string | null
        }[]
      }
      update_role_permissions: {
        Args: {
          p_role_id: number
          p_permission_ids: number[]
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

export type SecurityLog = {
  id: string;
  created_at: string;
  event: string;
  branch_name: string | null;
  staff_email: string | null;
  ip_address: string | null;
};