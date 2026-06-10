export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
}

export type DocumentTypeId =
  | 'offer_letter'
  | 'employment_contract'
  | 'experience_certificate'
  | 'salary_certificate';

export interface GeneratedDocument {
  _id?: string;
  type: DocumentTypeId;
  employee_id?: string;
  employee_name?: string;
  candidate_name?: string;
  candidate_email?: string;
  job_id?: string;
  content: string;
  generated_at: string;
  status?: string;
  sent_at?: string;
  sent_to?: string;
}

export type DocumentGenerationPayload<T extends DocumentTypeId> =
  T extends 'offer_letter'
    ? {
        candidate_data: Record<string, any>;
        job_data: Record<string, any>;
        offer_details: Record<string, any>;
      }
    : T extends 'employment_contract'
      ? {
          employee_data: Record<string, any>;
          contract_terms: Record<string, any>;
        }
      : {
          employee_data: Record<string, any>;
          certificate_data: Record<string, any>;
        };

export interface GeneratedDocumentResponse {
  success: boolean;
  data: {
    success?: boolean;
    content?: string;
    document?: GeneratedDocument;
    error?: string;
  };
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  created_at?: string;
  last_login_at?: string;
}

export interface AuthSuccessPayload {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface AuthResponse {
  success: boolean;
  data: AuthSuccessPayload;
}

