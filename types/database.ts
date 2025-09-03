export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          document_id: string
          user_id: string
          action: string
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          action: string
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          action?: string
          created_at?: string
        }
      }
      annotations: {
        Row: {
          id: string
          document_id: string
          author_id: string
          type: string
          page_number: number
          content: Json
          sequence_number: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          author_id: string
          type?: string
          page_number?: number
          content?: Json
          sequence_number?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          author_id?: string
          type?: string
          page_number?: number
          content?: Json
          sequence_number?: number
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          filename: string
          original_name: string
          file_path: string
          uploaded_by_id: string
          description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          filename: string
          original_name: string
          file_path: string
          uploaded_by_id: string
          description?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          filename?: string
          original_name?: string
          file_path?: string
          uploaded_by_id?: string
          description?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          message: string
          read: boolean
          link: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          read?: boolean
          link?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          read?: boolean
          link?: string | null
          created_at?: string
        }
      }
    }
  }
}