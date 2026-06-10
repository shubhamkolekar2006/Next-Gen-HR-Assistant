import axios from 'axios';
import type { CreateEmployeePayload } from '@/types/employee';
import type {
  DocumentGenerationPayload,
  GeneratedDocumentResponse,
  GeneratedDocument,
  AuthResponse,
} from '@/types/api';

const API_BASE_URL = (import.meta.env as { VITE_API_URL?: string }).VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for auth tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return Promise.reject(error);
  }
);

// Chatbot service
export const chatbotService = {
  ask: async (query: string) => {
    const response = await api.post('/chatbot/ask', { query });
    return response.data;
  },
};

// Employee service
export const employeeService = {
  getAll: async (params?: { search?: string; department?: string; page?: number; limit?: number }) => {
    const response = await api.get('/employees', { params });
    return response.data;
  },
  listRoles: async (params?: { department?: string }) => {
    const response = await api.get('/employees/roles', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },
  getAttritionRisk: async (id: string) => {
    const response = await api.get(`/employees/${id}/attrition-risk`);
    return response.data;
  },
  getPerformancePrediction: async (id: string, periods?: number, forceRefresh?: boolean) => {
    const params: Record<string, any> = {};
    if (periods) params.periods = periods;
    if (forceRefresh) params.force_refresh = true;
    const response = await api.get(`/employees/${id}/performance-prediction`, { params });
    return response.data;
  },
  refreshPerformancePrediction: async (payload: { employee_ids?: string[]; periods?: number; force_refresh?: boolean }) => {
    const response = await api.post('/employees/performance-predictions/generate', payload);
    return response.data;
  },
  create: async (payload: CreateEmployeePayload) => {
    const response = await api.post('/employees', payload);
    return response.data;
  },
};

// Documents service
export const documentsService = {
  generateOfferLetter: async (payload: DocumentGenerationPayload<'offer_letter'>) => {
    const response = await api.post('/agents/documents/offer-letter', payload);
    return response.data as GeneratedDocumentResponse;
  },
  generateContract: async (payload: DocumentGenerationPayload<'employment_contract'>) => {
    const response = await api.post('/agents/documents/contract', payload);
    return response.data as GeneratedDocumentResponse;
  },
  generateExperienceCertificate: async (payload: DocumentGenerationPayload<'experience_certificate'>) => {
    const response = await api.post('/agents/documents/experience-certificate', payload);
    return response.data as GeneratedDocumentResponse;
  },
  generateSalaryCertificate: async (payload: DocumentGenerationPayload<'salary_certificate'>) => {
    const response = await api.post('/agents/documents/salary-certificate', payload);
    return response.data as GeneratedDocumentResponse;
  },
  listDocuments: async (params?: { type?: string; employee_id?: string }) => {
    const response = await api.get('/agents/documents', { params });
    return response.data as { success: boolean; data: GeneratedDocument[] };
  },
  downloadDocument: async (documentId: string, format: 'pdf' | 'docx') => {
    const response = await api.get(`/agents/documents/${documentId}/download`, {
      params: { format },
      responseType: 'blob', // Important for file downloads
    });
    return response.data;
  },
};

// Auth service
export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data as AuthResponse;
  },
  register: async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { name, email, password });
    return response.data as AuthResponse;
  },
  me: async () => {
    const response = await api.get('/auth/me');
    return response.data as AuthResponse;
  },
};

// Analytics service
export const analyticsService = {
  getSummary: async () => {
    const response = await api.get('/analytics/summary');
    return response.data;
  },
  getDepartmentDistribution: async () => {
    const response = await api.get('/analytics/department-distribution');
    return response.data;
  },
  getAttritionRisk: async () => {
    const response = await api.get('/analytics/attrition-risk');
    return response.data;
  },
  getPerformanceTrend: async (periods?: number) => {
    const params = periods ? { periods } : {};
    const response = await api.get('/analytics/performance-trend', { params });
    return response.data;
  },
};

// Jobs service
export const jobsService = {
  getAll: async (params?: { department?: string; position?: string; status?: string; page?: number; limit?: number }) => {
    const response = await api.get('/jobs', { params });
    return response.data;
  },
  getById: async (jobId: string) => {
    const response = await api.get(`/jobs/${jobId}`);
    return response.data;
  },
  listIds: async () => {
    const response = await api.get('/jobs/ids/list');
    return response.data;
  },
  create: async (job: {
    JobID?: string;
    Position: string;
    Department: string;
    RequiredSkills?: string[];
    ExperienceRequired?: number;
    EducationRequired?: string;
    Status?: string;
  }) => {
    const response = await api.post('/jobs', job);
    return response.data;
  },
  seedBasic: async () => {
    const response = await api.post('/jobs/seed-basic');
    return response.data;
  },
};

// Agents service
export const agentsService = {
  screenResume: async (resumeText: string, jobId?: string, department?: string, jobRole?: string) => {
    const response = await api.post('/agents/resume-screening', {
      resume_text: resumeText,
      job_id: jobId,
      job_role: jobRole,
      department,
    });
    return response.data;
  },
  screenResumesBatch: async (
    resumes: { filename: string; resume_text: string }[],
    jobId?: string,
    department?: string,
    jobRole?: string,
  ) => {
    const response = await api.post('/agents/resume-screening/batch', {
      resumes,
      job_id: jobId,
      job_role: jobRole,
      department,
    });
    return response.data;
  },
  scheduleMeeting: async (query: string, participants?: string[], duration?: number) => {
    const response = await api.post('/agents/schedule-meeting', {
      user_query: query,
      participants,
      duration_minutes: duration,
    });
    return response.data;
  },
  getScreeningResults: async (jobId?: string) => {
    const params = jobId ? { job_id: jobId } : {};
    const response = await api.get('/agents/screening-results', { params });
    return response.data;
  },
  getScheduledMeetings: async (status?: string) => {
    const params = status ? { status } : {};
    const response = await api.get('/agents/scheduled-meetings', { params });
    return response.data;
  },
};

// Onboarding service
export const onboardingService = {
  createOnboarding: async (employeeId: string, employeeData: any) => {
    const response = await api.post('/agents/onboarding/create', {
      employee_id: employeeId,
      employee_data: employeeData,
    });
    return response.data;
  },
  updateTask: async (onboardingId: string, taskId: string, status: string) => {
    const response = await api.post('/agents/onboarding/update-task', {
      onboarding_id: onboardingId,
      task_id: taskId,
      status,
    });
    return response.data;
  },
  assignBuddy: async (onboardingId: string, buddyEmployeeId: string) => {
    const response = await api.post('/agents/onboarding/assign-buddy', {
      onboarding_id: onboardingId,
      buddy_employee_id: buddyEmployeeId,
    });
    return response.data;
  },
  getOnboarding: async (employeeId?: string, status?: string) => {
    const params: any = {};
    if (employeeId) params.employee_id = employeeId;
    if (status) params.status = status;
    const response = await api.get('/agents/onboarding', { params });
    return response.data;
  },
  sendOrientationEmail: async (onboardingId: string) => {
    const response = await api.post('/agents/onboarding/send-orientation-email', {
      onboarding_id: onboardingId,
    });
    return response.data;
  },
  scheduleOrientation: async (onboardingId: string, preferredDate: string, preferredTime: string) => {
    const response = await api.post('/agents/onboarding/schedule-orientation', {
      onboarding_id: onboardingId,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
    });
    return response.data;
  },
  sendDocumentGuidance: async (onboardingId: string) => {
    const response = await api.post('/agents/onboarding/send-document-guidance', {
      onboarding_id: onboardingId,
    });
    return response.data;
  },
  updateDocument: async (onboardingId: string, documentName: string, status: string) => {
    const response = await api.post('/agents/onboarding/update-document', {
      onboarding_id: onboardingId,
      document_name: documentName,
      status,
    });
    return response.data;
  },
};

// Database Manager service
export const databaseService = {
  executeQuery: async (query: string, showMongoQuery?: boolean) => {
    const response = await api.post('/agents/database-query', {
      query,
      show_mongodb_query: showMongoQuery || false,
    });
    return response.data;
  },
};

// Interview Coordinator service
export const interviewCoordinatorService = {
  createWorkflow: async (candidateId: string, jobId: string, rounds?: string[]) => {
    const response = await api.post('/agents/interview/create-workflow', {
      candidate_id: candidateId,
      job_id: jobId,
      rounds: rounds || undefined,
    });
    return response.data;
  },
  sendReminder: async (interviewId: string, hoursBefore?: number) => {
    const response = await api.post('/agents/interview/send-reminder', {
      interview_id: interviewId,
      hours_before: hoursBefore || 24,
    });
    return response.data;
  },
  collectFeedback: async (interviewId: string, interviewer: string, feedback: string) => {
    const response = await api.post('/agents/interview/collect-feedback', {
      interview_id: interviewId,
      interviewer,
      feedback,
    });
    return response.data;
  },
  scheduleNextRound: async (workflowId: string) => {
    const response = await api.post('/agents/interview/schedule-next', {
      workflow_id: workflowId,
    });
    return response.data;
  },
  getWorkflows: async (candidateId?: string, status?: string) => {
    const params: any = {};
    if (candidateId) params.candidate_id = candidateId;
    if (status) params.status = status;
    const response = await api.get('/agents/interview/workflows', { params });
    return response.data;
  },
  listInterviews: async (status?: string, limit?: number) => {
    const params: any = {};
    if (status) params.status = status;
    if (limit) params.limit = limit;
    const response = await api.get('/agents/interview/list', { params });
    return response.data;
  },
};

// Policy Workflows service
export const policyWorkflowsService = {
  createCampaign: async (payload: { name: string; policies: string[]; employee_ids?: string[]; due_date?: string }) => {
    const response = await api.post('/agents/policy-workflows/campaign', payload);
    return response.data;
  },
  listCampaigns: async (status?: string) => {
    const params = status ? { status } : {};
    const response = await api.get('/agents/policy-workflows/campaigns', { params });
    return response.data;
  },
  acknowledge: async (payload: { campaign_id: string; employee_id: string; policy_name: string }) => {
    const response = await api.post('/agents/policy-workflows/acknowledge', payload);
    return response.data;
  },
  getCampaignStatus: async (campaignId: string) => {
    const response = await api.get('/agents/policy-workflows/status', { params: { campaign_id: campaignId } });
    return response.data;
  },
};

// Probation service
export const probationService = {
  list: async () => {
    const response = await api.get('/agents/probation/list');
    return response.data;
  },
  confirm: async (employeeId: string) => {
    const response = await api.post('/agents/probation/confirm', null, { params: { employee_id: employeeId } });
    return response.data;
  },
};

// Interventions service
export const interventionsService = {
  getPlaybooks: async () => {
    const response = await api.get('/agents/interventions/playbooks');
    return response.data;
  },
  getHighRisk: async () => {
    const response = await api.get('/agents/interventions/high-risk');
    return response.data;
  },
  apply: async (payload: { employee_id: string; intervention_type: string; notes?: string }) => {
    const response = await api.post('/agents/interventions/apply', payload);
    return response.data;
  },
};

// Controlled Actions service
export const actionRequestsService = {
  create: async (payload: { action_type: string; employee_id: string; payload?: Record<string, unknown>; requested_by?: string }) => {
    const response = await api.post('/agents/actions/request', payload);
    return response.data;
  },
  listPending: async () => {
    const response = await api.get('/agents/actions/pending');
    return response.data;
  },
  approve: async (requestId: string, approvedBy?: string) => {
    const response = await api.post(`/agents/actions/${requestId}/approve`, null, { params: { approved_by: approvedBy } });
    return response.data;
  },
  reject: async (requestId: string, reason?: string) => {
    const response = await api.post(`/agents/actions/${requestId}/reject`, null, { params: { reason } });
    return response.data;
  },
};

// Orchestrator service
export const orchestratorService = {
  plan: async (query: string, threadId?: string) => {
    const response = await api.post('/orchestrator/plan', { query, thread_id: threadId });
    return response.data;
  },
  execute: async (threadId: string) => {
    const response = await api.post('/orchestrator/execute', { thread_id: threadId });
    return response.data;
  },
};


