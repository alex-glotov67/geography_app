
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"at": string,"details": NonNullable<Json>,"id": number,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"at"?: string,"details"?: NonNullable<Json>,"id"?: never,"teacher_id": string
                  }
                  Update: {
                    "action"?: string,"at"?: string,"details"?: NonNullable<Json>,"id"?: never,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "archived": boolean,"created_at": string,"grade": number,"id": string,"login_prefix": string,"name": string,"school_id": string,"school_year": string,"teacher_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"created_at"?: string,"grade": number,"id"?: string,"login_prefix": string,"name": string,"school_id"?: string,"school_year": string,"teacher_id"?: string
                  }
                  Update: {
                    "archived"?: boolean,"created_at"?: string,"grade"?: number,"id"?: string,"login_prefix"?: string,"name"?: string,"school_id"?: string,"school_year"?: string,"teacher_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "classes_teacher_id_fkey"
      columns: ["teacher_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_outcomes": {
                  Row: {
                    "lesson_id": string,"outcome_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "lesson_id": string,"outcome_id": string
                  }
                  Update: {
                    "lesson_id"?: string,"outcome_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_outcomes_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_outcomes_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "task_usage"
      referencedColumns: ["lesson_id"]
    },{
      foreignKeyName: "lesson_outcomes_outcome_id_fkey"
      columns: ["outcome_id"]
isOneToOne: false
      referencedRelation: "program_outcomes"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_version_tasks": {
                  Row: {
                    "lesson_id": string,"lesson_version": number,"position": number,"role": string,"task_id": string,"task_version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "lesson_id": string,"lesson_version": number,"position": number,"role": string,"task_id": string,"task_version": number
                  }
                  Update: {
                    "lesson_id"?: string,"lesson_version"?: number,"position"?: number,"role"?: string,"task_id"?: string,"task_version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_version_tasks_lesson_id_lesson_version_fkey"
      columns: ["lesson_id","lesson_version"]
isOneToOne: false
      referencedRelation: "lesson_versions"
      referencedColumns: ["lesson_id","version"]
    },{
      foreignKeyName: "lesson_version_tasks_task_id_task_version_fkey"
      columns: ["task_id","task_version"]
isOneToOne: false
      referencedRelation: "task_versions"
      referencedColumns: ["task_id","version"]
    }
                  ]
                },"lesson_versions": {
                  Row: {
                    "grade": number,"homework_count": number,"is_current": boolean,"is_demo": boolean,"lesson_id": string,"media_ids": (string)[],"number": number | null,"owner_id": string,"published_at": string,"school_id": string,"section_id": string | null,"slug": string,"snapshot": NonNullable<Json>,"title": string,"version": number,"video_ids": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "grade": number,"homework_count"?: number,"is_current"?: boolean,"is_demo"?: boolean,"lesson_id": string,"media_ids"?: (string)[],"number"?: number | null,"owner_id": string,"published_at"?: string,"school_id": string,"section_id"?: string | null,"slug": string,"snapshot": NonNullable<Json>,"title": string,"version": number,"video_ids"?: (string)[]
                  }
                  Update: {
                    "grade"?: number,"homework_count"?: number,"is_current"?: boolean,"is_demo"?: boolean,"lesson_id"?: string,"media_ids"?: (string)[],"number"?: number | null,"owner_id"?: string,"published_at"?: string,"school_id"?: string,"section_id"?: string | null,"slug"?: string,"snapshot"?: NonNullable<Json>,"title"?: string,"version"?: number,"video_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_versions_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_versions_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: false
      referencedRelation: "task_usage"
      referencedColumns: ["lesson_id"]
    },{
      foreignKeyName: "lesson_versions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_versions_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lesson_versions_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "blocks": NonNullable<Json>,"grade": number,"homework": Json | null,"id": string,"is_demo": boolean,"ktp_ref": string | null,"number": number | null,"owner_id": string,"published_version": number | null,"quiz_pool": (string)[],"reviewed_by_teacher": boolean,"revision": number,"school_id": string,"section_id": string | null,"simplified": Json | null,"slug": string,"status": string,"textbook_ref": Json | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks"?: NonNullable<Json>,"grade": number,"homework"?: Json | null,"id"?: string,"is_demo"?: boolean,"ktp_ref"?: string | null,"number"?: number | null,"owner_id"?: string,"published_version"?: number | null,"quiz_pool"?: (string)[],"reviewed_by_teacher"?: boolean,"revision"?: number,"school_id"?: string,"section_id"?: string | null,"simplified"?: Json | null,"slug": string,"status"?: string,"textbook_ref"?: Json | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "blocks"?: NonNullable<Json>,"grade"?: number,"homework"?: Json | null,"id"?: string,"is_demo"?: boolean,"ktp_ref"?: string | null,"number"?: number | null,"owner_id"?: string,"published_version"?: number | null,"quiz_pool"?: (string)[],"reviewed_by_teacher"?: boolean,"revision"?: number,"school_id"?: string,"section_id"?: string | null,"simplified"?: Json | null,"slug"?: string,"status"?: string,"textbook_ref"?: Json | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                },"media": {
                  Row: {
                    "alt": string | null,"bucket_path": string,"bytes": number | null,"caption": string | null,"created_at": string,"height": number | null,"id": string,"is_demo": boolean,"kind": string,"license": string | null,"owner_id": string,"school_id": string,"source": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string | null,"bucket_path": string,"bytes"?: number | null,"caption"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"is_demo"?: boolean,"kind": string,"license"?: string | null,"owner_id"?: string,"school_id"?: string,"source"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "alt"?: string | null,"bucket_path"?: string,"bytes"?: number | null,"caption"?: string | null,"created_at"?: string,"height"?: number | null,"id"?: string,"is_demo"?: boolean,"kind"?: string,"license"?: string | null,"owner_id"?: string,"school_id"?: string,"source"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"program_outcomes": {
                  Row: {
                    "archived": boolean,"code": string,"grade": number,"id": string,"is_demo": boolean,"owner_id": string,"position": number | null,"school_id": string,"source": string,"text": string,"text_norm": string | null,"topic_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"code": string,"grade": number,"id"?: string,"is_demo"?: boolean,"owner_id"?: string,"position"?: number | null,"school_id"?: string,"source": string,"text": string,"text_norm"?: never,"topic_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived"?: boolean,"code"?: string,"grade"?: number,"id"?: string,"is_demo"?: boolean,"owner_id"?: string,"position"?: number | null,"school_id"?: string,"source"?: string,"text"?: string,"text_norm"?: never,"topic_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_outcomes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_outcomes_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_outcomes_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sections": {
                  Row: {
                    "grade": number,"id": string,"is_demo": boolean,"number": number,"owner_id": string,"school_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "grade": number,"id"?: string,"is_demo"?: boolean,"number": number,"owner_id"?: string,"school_id"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "grade"?: number,"id"?: string,"is_demo"?: boolean,"number"?: number,"owner_id"?: string,"school_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sections_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sections_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "archived": boolean,"auth_user_id": string | null,"class_id": string,"created_at": string,"display_name": string | null,"first_initial": string,"id": string,"last_login_at": string | null,"last_name": string,"login": string,"name_key": string | null,"number": number,"school_id": string,"simplified_mode": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"auth_user_id"?: string | null,"class_id": string,"created_at"?: string,"display_name"?: never,"first_initial": string,"id"?: string,"last_login_at"?: string | null,"last_name": string,"login": string,"name_key"?: never,"number": number,"school_id": string,"simplified_mode"?: boolean
                  }
                  Update: {
                    "archived"?: boolean,"auth_user_id"?: string | null,"class_id"?: string,"created_at"?: string,"display_name"?: never,"first_initial"?: string,"id"?: string,"last_login_at"?: string | null,"last_name"?: string,"login"?: string,"name_key"?: never,"number"?: number,"school_id"?: string,"simplified_mode"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "students_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"task_keys": {
                  Row: {
                    "key": NonNullable<Json>,"owner_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": NonNullable<Json>,"owner_id"?: string,"task_id": string
                  }
                  Update: {
                    "key"?: NonNullable<Json>,"owner_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_keys_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_keys_task_id_fkey"
      columns: ["task_id"]
isOneToOne: true
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_versions": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"feedback": Json | null,"grp": string,"hint": string | null,"is_demo": boolean,"key": NonNullable<Json>,"level": string,"owner_id": string,"points": number,"print_override": Json | null,"task_id": string,"type": string,"version": number,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"feedback"?: Json | null,"grp": string,"hint"?: string | null,"is_demo"?: boolean,"key": NonNullable<Json>,"level": string,"owner_id": string,"points": number,"print_override"?: Json | null,"task_id": string,"type": string,"version": number,"visibility": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"feedback"?: Json | null,"grp"?: string,"hint"?: string | null,"is_demo"?: boolean,"key"?: NonNullable<Json>,"level"?: string,"owner_id"?: string,"points"?: number,"print_override"?: Json | null,"task_id"?: string,"type"?: string,"version"?: number,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_versions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_versions_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "archived": boolean,"content": NonNullable<Json>,"feedback": Json | null,"grp": string,"hint": string | null,"id": string,"is_demo": boolean,"level": string,"owner_id": string,"points": number,"print_override": Json | null,"revision": number,"school_id": string,"tags": NonNullable<Json>,"type": string,"updated_at": string,"version": number,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"content": NonNullable<Json>,"feedback"?: Json | null,"grp": string,"hint"?: string | null,"id"?: string,"is_demo"?: boolean,"level": string,"owner_id"?: string,"points"?: number,"print_override"?: Json | null,"revision"?: number,"school_id"?: string,"tags"?: NonNullable<Json>,"type": string,"updated_at"?: string,"version"?: number,"visibility": string
                  }
                  Update: {
                    "archived"?: boolean,"content"?: NonNullable<Json>,"feedback"?: Json | null,"grp"?: string,"hint"?: string | null,"id"?: string,"is_demo"?: boolean,"level"?: string,"owner_id"?: string,"points"?: number,"print_override"?: Json | null,"revision"?: number,"school_id"?: string,"tags"?: NonNullable<Json>,"type"?: string,"updated_at"?: string,"version"?: number,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"teachers": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"login_prefix": string,"school_id": string,"students_can_change_password": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string,"id": string,"login_prefix"?: string,"school_id": string,"students_can_change_password"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"login_prefix"?: string,"school_id"?: string,"students_can_change_password"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "teachers_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"topics": {
                  Row: {
                    "id": string,"is_demo": boolean,"number": number,"owner_id": string,"school_id": string,"section_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_demo"?: boolean,"number": number,"owner_id"?: string,"school_id"?: string,"section_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "id"?: string,"is_demo"?: boolean,"number"?: number,"owner_id"?: string,"school_id"?: string,"section_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "topics_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "topics_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "topics_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                },"videos": {
                  Row: {
                    "approved": boolean,"channel": string | null,"checked_at": string | null,"duration_sec": number | null,"end_sec": number | null,"id": string,"is_demo": boolean,"lang": string,"owner_id": string,"school_id": string,"start_sec": number | null,"title": string,"youtube_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved"?: boolean,"channel"?: string | null,"checked_at"?: string | null,"duration_sec"?: number | null,"end_sec"?: number | null,"id"?: string,"is_demo"?: boolean,"lang"?: string,"owner_id"?: string,"school_id"?: string,"start_sec"?: number | null,"title": string,"youtube_id": string
                  }
                  Update: {
                    "approved"?: boolean,"channel"?: string | null,"checked_at"?: string | null,"duration_sec"?: number | null,"end_sec"?: number | null,"id"?: string,"is_demo"?: boolean,"lang"?: string,"owner_id"?: string,"school_id"?: string,"start_sec"?: number | null,"title"?: string,"youtube_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "videos_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "teachers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "videos_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "task_usage": {
                  Row: {
                    "grade": number | null,"lesson_id": string | null,"lesson_number": number | null,"lesson_slug": string | null,"lesson_title": string | null,"published": boolean | null,"role": string | null,"task_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_outcome":
{ Args: { "p_source": string,"p_text": string,"p_topic_id": string }; Returns: {
              "code": string,"id": string
            }[]
                           },
"publish_lesson":
{ Args: { "p_lesson_id": string }; Returns: number
                           },
"publish_lesson_reviewed":
{ Args: { "p_lesson_id": string,"p_revision": number }; Returns: number
                           },
"reorder_outcomes":
{ Args: { "p_ids": (string)[],"p_topic_id": string }; Returns: undefined
                           },
"save_lesson":
{ Args: { "p_fields": Json,"p_id": string,"p_outcome_ids"?: (string)[],"p_revision": number }; Returns: number
                           },
"save_task":
{ Args: { "p_id": string,"p_key": Json,"p_revision": number,"p_task": Json }; Returns: {
              "id": string,"revision": number,"version": number
            }[]
                           },
"touch_last_login":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"unpublish_lesson":
{ Args: { "p_lesson_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
