export interface Employee {
  _id?: string;
  Employee_ID: string;
  Name: string;
  Department: string;
  Position: string;
  Salary?: number;
  [key: string]: any;
}

export interface EmployeeListResponse {
  success: boolean;
  data: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateEmployeePayload {
  name: string;
  department: string;
  position: string;
  email?: string;
  phone?: string;
  dateOfJoining?: string;
  employmentType?: string;
  manager?: string;
  employeeId?: string;
}

export interface PerformanceHistoricalEntry {
  date: string;
  score: number;
}

export interface PerformanceForecastEntry {
  date: string;
  predicted_score: number;
}

export interface PerformancePrediction {
  employee_id: string;
  model_version?: string;
  generated_at?: string;
  current_performance_score: number;
  trend: 'increasing' | 'decreasing' | 'stable' | string;
  forecast: PerformanceForecastEntry[];
  historical: PerformanceHistoricalEntry[];
  metrics?: Record<string, unknown>;
  history_points?: number;
}

