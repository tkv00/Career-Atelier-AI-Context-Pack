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
      agent_runs: {
        Row: {
          agent_id: string
          created_at: string
          error: string
          finished_at: string | null
          id: string
          output: string
          owner_id: string
          pipeline_id: string | null
          prompt: string
          provider: string
          started_at: string | null
          status: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          error?: string
          finished_at?: string | null
          id?: string
          output?: string
          owner_id: string
          pipeline_id?: string | null
          prompt: string
          provider: string
          started_at?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          error?: string
          finished_at?: string | null
          id?: string
          output?: string
          owner_id?: string
          pipeline_id?: string | null
          prompt?: string
          provider?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      artifacts: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          metadata: Json
          owner_id: string
          pipeline_id: string | null
          run_id: string | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          owner_id: string
          pipeline_id?: string | null
          run_id?: string | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          owner_id?: string
          pipeline_id?: string | null
          run_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      awards: {
        Row: {
          awarded_on: string | null
          created_at: string
          detail: string | null
          grade: string | null
          id: string
          issuer: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          awarded_on?: string | null
          created_at?: string
          detail?: string | null
          grade?: string | null
          id?: string
          issuer?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          awarded_on?: string | null
          created_at?: string
          detail?: string | null
          grade?: string | null
          id?: string
          issuer?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          company: string | null
          confidence: string
          created_at: string
          event_type: string
          id: string
          job_post_id: string | null
          memo: string | null
          owner_id: string
          raw_deadline_text: string | null
          source_url: string | null
          starts_at: string
          title: string
        }
        Insert: {
          all_day?: boolean
          company?: string | null
          confidence?: string
          created_at?: string
          event_type: string
          id?: string
          job_post_id?: string | null
          memo?: string | null
          owner_id: string
          raw_deadline_text?: string | null
          source_url?: string | null
          starts_at: string
          title: string
        }
        Update: {
          all_day?: boolean
          company?: string | null
          confidence?: string
          created_at?: string
          event_type?: string
          id?: string
          job_post_id?: string | null
          memo?: string | null
          owner_id?: string
          raw_deadline_text?: string | null
          source_url?: string | null
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          acquired_on: string | null
          created_at: string
          grade: string | null
          id: string
          issuer: string | null
          memo: string | null
          name: string
          owner_id: string
          registration_number: string | null
          updated_at: string
        }
        Insert: {
          acquired_on?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          issuer?: string | null
          memo?: string | null
          name: string
          owner_id: string
          registration_number?: string | null
          updated_at?: string
        }
        Update: {
          acquired_on?: string | null
          created_at?: string
          grade?: string | null
          id?: string
          issuer?: string | null
          memo?: string | null
          name?: string
          owner_id?: string
          registration_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_research_attachments: {
        Row: {
          created_at: string
          essay_id: string
          file_name: string
          id: string
          owner_id: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          essay_id: string
          file_name: string
          id?: string
          owner_id: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          essay_id?: string
          file_name?: string
          id?: string
          owner_id?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_research_attachments_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essay_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      education_courses: {
        Row: {
          course_name: string
          created_at: string
          credits: number | null
          detail: string | null
          education_id: string
          grade: string | null
          id: string
          owner_id: string
          term: string | null
        }
        Insert: {
          course_name: string
          created_at?: string
          credits?: number | null
          detail?: string | null
          education_id: string
          grade?: string | null
          id?: string
          owner_id: string
          term?: string | null
        }
        Update: {
          course_name?: string
          created_at?: string
          credits?: number | null
          detail?: string | null
          education_id?: string
          grade?: string | null
          id?: string
          owner_id?: string
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "education_courses_education_id_fkey"
            columns: ["education_id"]
            isOneToOne: false
            referencedRelation: "education_records"
            referencedColumns: ["id"]
          },
        ]
      }
      education_records: {
        Row: {
          created_at: string
          ended_on: string | null
          gpa: number | null
          gpa_scale: number | null
          hanja_name: string | null
          id: string
          major: string | null
          memo: string | null
          owner_id: string
          school_name: string
          school_type: string
          secondary_major: string | null
          secondary_major_type: string | null
          started_on: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_on?: string | null
          gpa?: number | null
          gpa_scale?: number | null
          hanja_name?: string | null
          id?: string
          major?: string | null
          memo?: string | null
          owner_id: string
          school_name: string
          school_type?: string
          secondary_major?: string | null
          secondary_major_type?: string | null
          started_on?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_on?: string | null
          gpa?: number | null
          gpa_scale?: number | null
          hanja_name?: string | null
          id?: string
          major?: string | null
          memo?: string | null
          owner_id?: string
          school_name?: string
          school_type?: string
          secondary_major?: string | null
          secondary_major_type?: string | null
          started_on?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      essay_autosaves: {
        Row: {
          chars_with_spaces: number
          chars_without_spaces: number
          content: string
          created_at: string
          device_name: string | null
          essay_id: string
          id: string
          owner_id: string
        }
        Insert: {
          chars_with_spaces: number
          chars_without_spaces: number
          content: string
          created_at?: string
          device_name?: string | null
          essay_id: string
          id?: string
          owner_id: string
        }
        Update: {
          chars_with_spaces?: number
          chars_without_spaces?: number
          content?: string
          created_at?: string
          device_name?: string | null
          essay_id?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_autosaves_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essay_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_projects: {
        Row: {
          created_at: string
          draft: string
          id: string
          job_id: string | null
          owner_id: string
          question: string
          revision: number
          status: string
          subtitle: string
          target_chars: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft?: string
          id?: string
          job_id?: string | null
          owner_id: string
          question?: string
          revision?: number
          status?: string
          subtitle?: string
          target_chars?: number
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft?: string
          id?: string
          job_id?: string | null
          owner_id?: string
          question?: string
          revision?: number
          status?: string
          subtitle?: string
          target_chars?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_projects_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_questions: {
        Row: {
          char_limit: number | null
          char_limit_basis: string | null
          char_min: number | null
          created_at: string
          guide: string | null
          id: string
          job_post_id: string | null
          order_no: number
          owner_id: string
          question: string
          raw: string | null
          source: string
        }
        Insert: {
          char_limit?: number | null
          char_limit_basis?: string | null
          char_min?: number | null
          created_at?: string
          guide?: string | null
          id?: string
          job_post_id?: string | null
          order_no: number
          owner_id: string
          question: string
          raw?: string | null
          source: string
        }
        Update: {
          char_limit?: number | null
          char_limit_basis?: string | null
          char_min?: number | null
          created_at?: string
          guide?: string | null
          id?: string
          job_post_id?: string | null
          order_no?: number
          owner_id?: string
          question?: string
          raw?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_questions_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_revision_requests: {
        Row: {
          base_draft: string
          created_at: string
          essay_id: string
          id: string
          instruction: string
          owner_id: string
        }
        Insert: {
          base_draft?: string
          created_at?: string
          essay_id: string
          id?: string
          instruction: string
          owner_id: string
        }
        Update: {
          base_draft?: string
          created_at?: string
          essay_id?: string
          id?: string
          instruction?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_revision_requests_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essay_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_suggestions: {
        Row: {
          category: string | null
          created_at: string
          essay_id: string
          id: string
          original: string
          owner_id: string
          paragraph_hash: string
          rationale: string | null
          status: string
          suggested: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          essay_id: string
          id?: string
          original: string
          owner_id: string
          paragraph_hash: string
          rationale?: string | null
          status?: string
          suggested: string
        }
        Update: {
          category?: string | null
          created_at?: string
          essay_id?: string
          id?: string
          original?: string
          owner_id?: string
          paragraph_hash?: string
          rationale?: string | null
          status?: string
          suggested?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_suggestions_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essay_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_versions: {
        Row: {
          chars_with_spaces: number
          chars_without_spaces: number
          content: string
          created_at: string
          essay_id: string
          id: string
          note: string
          owner_id: string
          version: number
        }
        Insert: {
          chars_with_spaces: number
          chars_without_spaces: number
          content: string
          created_at?: string
          essay_id: string
          id?: string
          note?: string
          owner_id: string
          version: number
        }
        Update: {
          chars_with_spaces?: number
          chars_without_spaces?: number
          content?: string
          created_at?: string
          essay_id?: string
          id?: string
          note?: string
          owner_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "essay_versions_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essay_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_cards: {
        Row: {
          action: string
          context: string
          id: string
          judgment: string
          metrics: Json
          owner_id: string
          problem: string
          reflection: string
          result: string
          role_scope: string
          situation: string
          tags: Json
          task: string
          title: string
          trial_error: string
          updated_at: string
        }
        Insert: {
          action?: string
          context?: string
          id?: string
          judgment?: string
          metrics?: Json
          owner_id: string
          problem?: string
          reflection?: string
          result?: string
          role_scope?: string
          situation?: string
          tags?: Json
          task?: string
          title?: string
          trial_error?: string
          updated_at?: string
        }
        Update: {
          action?: string
          context?: string
          id?: string
          judgment?: string
          metrics?: Json
          owner_id?: string
          problem?: string
          reflection?: string
          result?: string
          role_scope?: string
          situation?: string
          tags?: Json
          task?: string
          title?: string
          trial_error?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_activities: {
        Row: {
          created_at: string
          detail: string | null
          ended_on: string | null
          id: string
          name: string
          organizer: string | null
          owner_id: string
          role: string | null
          started_on: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          ended_on?: string | null
          id?: string
          name: string
          organizer?: string | null
          owner_id: string
          role?: string | null
          started_on?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          ended_on?: string | null
          id?: string
          name?: string
          organizer?: string | null
          owner_id?: string
          role?: string | null
          started_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      harness_configs: {
        Row: {
          config: Json
          id: string
          name: string
          owner_id: string
          provider_map: Json
          updated_at: string
        }
        Insert: {
          config: Json
          id?: string
          name: string
          owner_id: string
          provider_map: Json
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          name?: string
          owner_id?: string
          provider_map?: Json
          updated_at?: string
        }
        Relationships: []
      }
      interview_questions: {
        Row: {
          answer_markdown: string
          category: string
          created_at: string
          id: string
          job_post_id: string | null
          order_no: number
          owner_id: string
          question: string
          source: string
          updated_at: string
        }
        Insert: {
          answer_markdown?: string
          category: string
          created_at?: string
          id?: string
          job_post_id?: string | null
          order_no?: number
          owner_id: string
          question: string
          source?: string
          updated_at?: string
        }
        Update: {
          answer_markdown?: string
          category?: string
          created_at?: string
          id?: string
          job_post_id?: string | null
          order_no?: number
          owner_id?: string
          question?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_job_post_id_fkey"
            columns: ["job_post_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posts: {
        Row: {
          application_type: string
          company: string
          company_type: string
          created_at: string
          deadline: string | null
          description: string
          fit_score: number
          id: string
          owner_id: string
          requirements: Json
          result_status: string
          role: string
          source: string
          stage_results: Json
          status: string
          submission_status: string
          updated_at: string
          url: string
        }
        Insert: {
          application_type?: string
          company: string
          company_type?: string
          created_at?: string
          deadline?: string | null
          description?: string
          fit_score?: number
          id?: string
          owner_id: string
          requirements?: Json
          result_status?: string
          role: string
          source?: string
          stage_results?: Json
          status?: string
          submission_status?: string
          updated_at?: string
          url?: string
        }
        Update: {
          application_type?: string
          company?: string
          company_type?: string
          created_at?: string
          deadline?: string | null
          description?: string
          fit_score?: number
          id?: string
          owner_id?: string
          requirements?: Json
          result_status?: string
          role?: string
          source?: string
          stage_results?: Json
          status?: string
          submission_status?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          claimed_at: string | null
          created_at: string
          harness_snapshot: Json
          id: string
          kind: string
          owner_id: string
          payload: Json
          pipeline_id: string | null
          priority: number
          runner_id: string | null
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          harness_snapshot: Json
          id?: string
          kind: string
          owner_id: string
          payload: Json
          pipeline_id?: string | null
          priority?: number
          runner_id?: string | null
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          harness_snapshot?: Json
          id?: string
          kind?: string
          owner_id?: string
          payload?: Json
          pipeline_id?: string | null
          priority?: number
          runner_id?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          display_name: string
          id: string
          interests: Json
          owner_id: string
          summary: string
          target_roles: Json
          updated_at: string
        }
        Insert: {
          display_name?: string
          id?: string
          interests?: Json
          owner_id: string
          summary?: string
          target_roles?: Json
          updated_at?: string
        }
        Update: {
          display_name?: string
          id?: string
          interests?: Json
          owner_id?: string
          summary?: string
          target_roles?: Json
          updated_at?: string
        }
        Relationships: []
      }
      project_records: {
        Row: {
          created_at: string
          detail: string | null
          ended_on: string | null
          id: string
          name: string
          organizer: string | null
          owner_id: string
          repo_url: string | null
          role: string | null
          started_on: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          ended_on?: string | null
          id?: string
          name: string
          organizer?: string | null
          owner_id: string
          repo_url?: string | null
          role?: string | null
          started_on?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          ended_on?: string | null
          id?: string
          name?: string
          organizer?: string | null
          owner_id?: string
          repo_url?: string | null
          role?: string | null
          started_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          agent_id: string
          body: string
          effort: string
          id: string
          is_active: boolean
          model: string
          name: string
          owner_id: string
          provider: string
          updated_at: string
          variables: Json
          version: number
        }
        Insert: {
          agent_id: string
          body: string
          effort?: string
          id?: string
          is_active?: boolean
          model?: string
          name: string
          owner_id: string
          provider?: string
          updated_at?: string
          variables?: Json
          version?: number
        }
        Update: {
          agent_id?: string
          body?: string
          effort?: string
          id?: string
          is_active?: boolean
          model?: string
          name?: string
          owner_id?: string
          provider?: string
          updated_at?: string
          variables?: Json
          version?: number
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          body: string
          created_at: string
          id: string
          owner_id: string
          template_id: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          owner_id: string
          template_id: string
          version: number
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      record_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string | null
          owner_id: string
          record_id: string
          record_type: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind?: string | null
          owner_id: string
          record_id: string
          record_type: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string | null
          owner_id?: string
          record_id?: string
          record_type?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: []
      }
      research_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string | null
          kind: string
          owner_id: string
          provider: string
          sources: Json
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id?: string | null
          kind: string
          owner_id: string
          provider?: string
          sources?: Json
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          owner_id?: string
          provider?: string
          sources?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      run_events: {
        Row: {
          created_at: string
          id: number
          kind: string
          owner_id: string
          payload: Json
          run_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          owner_id: string
          payload: Json
          run_id: string
          sequence: number
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          owner_id?: string
          payload?: Json
          run_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runners: {
        Row: {
          approved: boolean
          backup_dir: string | null
          backup_enabled: boolean
          created_at: string
          device_name: string
          fingerprint: string
          id: string
          last_backup_at: string | null
          last_backup_error: string | null
          last_seen_at: string | null
          owner_id: string
        }
        Insert: {
          approved?: boolean
          backup_dir?: string | null
          backup_enabled?: boolean
          created_at?: string
          device_name: string
          fingerprint: string
          id?: string
          last_backup_at?: string | null
          last_backup_error?: string | null
          last_seen_at?: string | null
          owner_id: string
        }
        Update: {
          approved?: boolean
          backup_dir?: string | null
          backup_enabled?: boolean
          created_at?: string
          device_name?: string
          fingerprint?: string
          id?: string
          last_backup_at?: string | null
          last_backup_error?: string | null
          last_seen_at?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      training_programs: {
        Row: {
          created_at: string
          detail: string | null
          ended_on: string | null
          id: string
          name: string
          organizer: string | null
          owner_id: string
          started_on: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          ended_on?: string | null
          id?: string
          name: string
          organizer?: string | null
          owner_id: string
          started_on?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          ended_on?: string | null
          id?: string
          name?: string
          organizer?: string | null
          owner_id?: string
          started_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      work_experiences: {
        Row: {
          company: string
          created_at: string
          detail: string | null
          employment_type: string | null
          ended_on: string | null
          id: string
          leave_reason: string | null
          owner_id: string
          started_on: string | null
          updated_at: string
        }
        Insert: {
          company: string
          created_at?: string
          detail?: string | null
          employment_type?: string | null
          ended_on?: string | null
          id?: string
          leave_reason?: string | null
          owner_id: string
          started_on?: string | null
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          detail?: string | null
          employment_type?: string | null
          ended_on?: string | null
          id?: string
          leave_reason?: string | null
          owner_id?: string
          started_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_job: {
        Args: { p_runner_id: string }
        Returns: {
          claimed_at: string | null
          created_at: string
          harness_snapshot: Json
          id: string
          kind: string
          owner_id: string
          payload: Json
          pipeline_id: string | null
          priority: number
          runner_id: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_old_jobs: { Args: never; Returns: undefined }
      reap_stale_jobs: { Args: never; Returns: undefined }
      restrict_signup_to_owner: { Args: { event: Json }; Returns: Json }
      seed_default_prompts: {
        Args: { target_owner: string }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
