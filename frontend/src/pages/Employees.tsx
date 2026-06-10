import { useMemo, useState, useCallback, type ReactNode, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  CalendarDays,
  BadgeCheck,
  TrendingUp,
  Activity,
  ShieldCheck,
  Clock,
  Building2,
  ListChecks,
  ClipboardCheck,
  UserCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { employeeService, onboardingService } from '@/services/api';
import type { Employee, CreateEmployeePayload, PerformancePrediction } from '@/types/employee';

type DetailEmployee = Employee & {
  Email?: string;
  Phone?: string;
  Location?: string;
  DateOfJoining?: string;
  Manager?: string;
  ManagerName?: string;
  EmploymentType?: string;
  PerformanceRating?: string | number;
  LastPromotionDate?: string;
  LastPerformanceReviewDate?: string;
  Tenure?: number;
  LeaveBalance?: number;
  Skills?: string[];
  Projects?: { name: string; status?: string; role?: string }[];
  NextReviewDate?: string;
  Team?: string;
};

type TimelineEvent = {
  title: string;
  description: string;
  date?: string;
  status: 'completed' | 'current' | 'upcoming';
  icon: React.ComponentType<{ className?: string }>;
};

type InfoRowProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
};

type OnboardingTask = {
  id?: string;
  task?: string;
  description?: string;
  owner?: string;
  due_date?: string;
  status?: string;
  category?: string;
  notes?: string;
};

type OnboardingRecord = {
  _id: string;
  employee_id?: string;
  status?: string;
  completion_percentage?: number;
  created_at?: string;
  updated_at?: string;
  start_date?: string;
  buddy_name?: string;
  buddy_email?: string;
  plan?: {
    tasks?: OnboardingTask[];
    [key: string]: unknown;
  };
  tasks?: OnboardingTask[];
};

type EmployeeFormState = {
  name: string;
  email: string;
  department: string;
  position: string;
  phone: string;
  dateOfJoining: string;
  employmentType: string;
  manager: string;
};

const DEFAULT_EMPLOYEE_FORM: EmployeeFormState = {
  name: '',
  email: '',
  department: '',
  position: '',
  phone: '',
  dateOfJoining: '',
  employmentType: 'Full-time',
  manager: '',
};

const InfoRow = ({ icon: Icon, label, value }: InfoRowProps) => (
  <div className="flex items-start gap-3">
    <div className="rounded-md bg-blue-50 p-2">
      <Icon className="w-4 h-4 text-blue-600" />
    </div>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 break-words">{value || 'Not available'}</p>
    </div>
  </div>
);

const formatDate = (value?: string | Date) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (value?: number) => {
  if (!value && value !== 0) return 'Not available';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const calculateServiceDuration = (date?: string) => {
  if (!date) return '—';
  const joined = new Date(date);
  if (Number.isNaN(joined.getTime())) return '—';
  const now = new Date();
  const years = now.getFullYear() - joined.getFullYear();
  const months = now.getMonth() - joined.getMonth();
  const totalMonths = years * 12 + months;
  const finalYears = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  if (finalYears <= 0 && remainingMonths <= 0) return 'Just joined';
  const yearPart = finalYears > 0 ? `${finalYears} yr${finalYears > 1 ? 's' : ''}` : '';
  const monthPart =
    remainingMonths > 0 ? `${remainingMonths} mo${remainingMonths > 1 ? 's' : ''}` : '';
  return [yearPart, monthPart].filter(Boolean).join(' ');
};

const extractStringField = (
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value.toString();
    }
  }
  return undefined;
};

const toDateString = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return formatDate(date);
    return formatDate(value);
  }
  if (typeof value === 'object' && value !== null) {
    const dateValue = (value as Record<string, unknown>)?.$date;
    if (typeof dateValue === 'string') {
      return formatDate(dateValue);
    }
    if (dateValue instanceof Date) {
      return formatDate(dateValue);
    }
  }
  if (value instanceof Date) {
    return formatDate(value);
  }
  return undefined;
};

const formatDateRange = (start?: string, end?: string) => {
  const startLabel = formatDate(start);
  const endLabel = end ? formatDate(end) : 'Present';
  if (!startLabel && !endLabel) return '—';
  if (!startLabel) return endLabel || '—';
  return `${startLabel} - ${endLabel}`;
};

const calculateDurationBetween = (start?: string, end?: string) => {
  if (!start) return '—';
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return '—';
  const endDate = end ? new Date(end) : new Date();
  if (Number.isNaN(endDate.getTime())) return '—';

  const totalMonths =
    endDate.getFullYear() * 12 +
    endDate.getMonth() -
    (startDate.getFullYear() * 12 + startDate.getMonth());

  if (totalMonths <= 0) return 'Less than a month';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const yearPart = years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '';
  const monthPart = months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '';
  return [yearPart, monthPart].filter(Boolean).join(' ') || 'Less than a month';
};

const NAME_KEYS = [
  'Name',
  'name',
  'FullName',
  'fullName',
  'EmployeeName',
  'employeeName',
  'Employee_Name',
  'employee_name',
  'EmployeeFullName',
  'employee_full_name',
];

const DEPARTMENT_KEYS = [
  'Department',
  'department',
  'Dept',
  'dept',
  'DepartmentName',
  'department_name',
  'Division',
  'division',
];

const POSITION_KEYS = [
  'Position',
  'position',
  'Role',
  'role',
  'JobTitle',
  'job_title',
  'Title',
  'title',
  'Designation',
  'designation',
];

const MANAGER_KEYS = [
  'Manager',
  'manager',
  'ManagerName',
  'managerName',
  'Supervisor',
  'supervisor',
  'ReportingManager',
  'reportingManager',
];

const EMAIL_KEYS = ['Email', 'email', 'EmailAddress', 'email_address', 'CorporateEmail', 'corporate_email'];
const PHONE_KEYS = ['Phone', 'phone', 'PhoneNumber', 'phone_number', 'ContactNumber', 'contact_number'];
const LOCATION_KEYS = ['Location', 'location', 'City', 'city', 'Office', 'office', 'OfficeLocation', 'office_location', 'WorkLocation', 'workLocation'];
const TEAM_KEYS = ['Team', 'team', 'Squad', 'squad', 'Group', 'group', 'Department', 'department'];

const getNestedValue = (
  source: Record<string, unknown> | null | undefined,
  path: string,
): unknown => {
  if (!source) return undefined;
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    return record[segment];
  }, source);
};

const getEmployeeField = (
  employee: Employee | DetailEmployee | Record<string, unknown> | null | undefined,
  keys: string[],
  fallback?: string,
) => {
  if (!employee) return fallback;

  return extractStringField(employee as Record<string, unknown>, keys) ?? fallback;
};

const EXCLUDED_ATTRIBUTE_KEYS = new Set([
  '_id',
  '__v',
  'Employee_ID',
  'EmployeeID',
  'employee_id',
  'employeeId',
  'id',
  'Name',
  'Department',
  'Position',
  'Email',
  'Phone',
  'Manager',
  'ManagerName',
  'EmploymentType',
  'DateOfJoining',
  'LastPromotionDate',
  'LastPerformanceReviewDate',
  'NextReviewDate',
  'Salary',
  'LeaveBalance',
  'Benefits',
  'Team',
  'Location',
  'City',
  'Experience',
  'ExperienceSummary',
  'TotalWorkingYears',
  'ExperienceYears',
  'TotalExperienceYears',
  'YearsOfExperience',
  'YearsAtCompany',
  'PerformanceRating',
  'EmploymentHistory',
  'CareerHistory',
  'History',
  'JobHistory',
  'WorkHistory',
  'Projects',
  'Skills',
  'PerformanceHistory',
  'CreatedAt',
  'UpdatedAt',
  'contact',
  'employment_overview',
  'compensation',
  'performance_insights',
  'current_assignment',
  'experience_years',
  'service_tenure',
  'onboarding_progress',
  'attrition_risk',
  'skills',
  'employment_history',
]);

const humanizeKey = (key: string) => {
  if (!key) return key;
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
};

const formatAttributeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const resolveEmployeeIdentifier = (employee: Employee | DetailEmployee | Record<string, unknown>): string | undefined => {
  if (!employee) return undefined;
  const candidate =
    (employee as Employee).Employee_ID ||
    (employee as any).EmployeeID ||
    (employee as any).employee_id ||
    (employee as any).ID ||
    (employee as any).id ||
    (employee as any)._id;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
};

export const Employees = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<EmployeeFormState>({ ...DEFAULT_EMPLOYEE_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  const [refreshingPrediction, setRefreshingPrediction] = useState(false);

  useEffect(() => {
    if (!creationSuccess) return;
    const timeout = window.setTimeout(() => setCreationSuccess(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [creationSuccess]);

  const resetForm = useCallback(() => {
    setFormData({ ...DEFAULT_EMPLOYEE_FORM });
  }, []);

  const openAddEmployeeModal = useCallback(() => {
    setIsAddModalOpen(true);
    setFormError(null);
  }, []);

  const closeAddEmployeeModal = useCallback(() => {
    setIsAddModalOpen(false);
    setFormError(null);
    resetForm();
  }, [resetForm]);

  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['employees', search, page],
    queryFn: () => employeeService.getAll({ search, page }),
  });

  const {
    data: selectedEmployeeData,
    isLoading: detailLoading,
    isFetching: detailFetching,
    error: detailError,
  } = useQuery({
    queryKey: ['employee-detail', selectedEmployeeId],
    queryFn: () => employeeService.getById(selectedEmployeeId!),
    enabled: !!selectedEmployeeId,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: attritionData,
    isLoading: attritionLoading,
    error: attritionError,
  } = useQuery({
    queryKey: ['employee-attrition', selectedEmployeeId],
    queryFn: () => employeeService.getAttritionRisk(selectedEmployeeId!),
    enabled: !!selectedEmployeeId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
  } = useQuery({
    queryKey: ['employee-performance', selectedEmployeeId],
    queryFn: () => employeeService.getPerformancePrediction(selectedEmployeeId!, 6),
    enabled: !!selectedEmployeeId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
  const performancePrediction = performanceData?.data as PerformancePrediction | undefined;
  const performanceHistory = performancePrediction?.historical ?? [];
  const performanceForecast = performancePrediction?.forecast ?? [];
  const performanceGeneratedAt = performancePrediction?.generated_at;

  const {
    data: onboardingData,
    isLoading: onboardingLoading,
    error: onboardingError,
  } = useQuery({
    queryKey: ['employee-onboarding', selectedEmployeeId],
    queryFn: () => onboardingService.getOnboarding(selectedEmployeeId!, undefined),
    enabled: !!selectedEmployeeId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const employees = employeesData?.data || [];
  const selectedEmployee = (selectedEmployeeData?.data || null) as DetailEmployee | null;
  const selectedEmployeeName = useMemo(
    () => getEmployeeField(selectedEmployee, NAME_KEYS, selectedEmployee?.Name),
    [selectedEmployee],
  );
  const selectedEmployeeDepartment = useMemo(
    () => getEmployeeField(selectedEmployee, DEPARTMENT_KEYS, selectedEmployee?.Department),
    [selectedEmployee],
  );
  const selectedEmployeePosition = useMemo(
    () => getEmployeeField(selectedEmployee, POSITION_KEYS, selectedEmployee?.Position),
    [selectedEmployee],
  );
  const selectedEmployeeManager = useMemo(
    () => getEmployeeField(selectedEmployee, MANAGER_KEYS, selectedEmployee?.Manager),
    [selectedEmployee],
  );
  const selectedEmployeeEmail = useMemo(
    () => getEmployeeField(selectedEmployee, EMAIL_KEYS, selectedEmployee?.Email),
    [selectedEmployee],
  );
  const selectedEmployeePhone = useMemo(
    () => getEmployeeField(selectedEmployee, PHONE_KEYS, selectedEmployee?.Phone),
    [selectedEmployee],
  );
  const selectedEmployeeLocation = useMemo(
    () => getEmployeeField(selectedEmployee, LOCATION_KEYS, selectedEmployee?.Location || selectedEmployee?.City),
    [selectedEmployee],
  );
  const selectedEmployeeTeam = useMemo(
    () => getEmployeeField(selectedEmployee, TEAM_KEYS, selectedEmployee?.Team || selectedEmployee?.Department),
    [selectedEmployee],
  );
  const selectedEmployeeServiceTenure = useMemo(() => {
    const text =
      getEmployeeField(
        selectedEmployee,
        ['service_tenure', 'ServiceTenure', 'Tenure'],
        selectedEmployee?.service_tenure as string | undefined,
      ) ?? undefined;
    if (text) return text;
    return selectedEmployee?.DateOfJoining ? calculateServiceDuration(selectedEmployee.DateOfJoining) : undefined;
  }, [selectedEmployee]);
  const selectedEmployeeExperienceYears = useMemo(
    () =>
      getEmployeeField(
        selectedEmployee,
        ['experience_years', 'ExperienceYears', 'TotalExperienceYears', 'TotalWorkingYears'],
        (selectedEmployee?.experience_years as string | undefined) ??
          (selectedEmployee?.TotalWorkingYears as string | undefined),
      ),
    [selectedEmployee],
  );
  const formattedExperienceYears = useMemo(() => {
    if (!selectedEmployeeExperienceYears) return undefined;
    const numeric = Number(selectedEmployeeExperienceYears);
    if (!Number.isNaN(numeric)) {
      return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)} yr${numeric === 1 ? '' : 's'}`;
    }
    return selectedEmployeeExperienceYears;
  }, [selectedEmployeeExperienceYears]);
  const selectedEmployeeOnboardingProgress = useMemo(
    () =>
      getEmployeeField(
        selectedEmployee,
        ['onboarding_progress', 'OnboardingProgress'],
        selectedEmployee?.onboarding_progress as string | undefined,
      ),
    [selectedEmployee],
  );
  const selectedEmployeeAttritionRisk = useMemo(
    () =>
      getEmployeeField(
        selectedEmployee,
        ['attrition_risk', 'AttritionRisk'],
        selectedEmployee?.attrition_risk as string | undefined,
      ),
    [selectedEmployee],
  );
  const contactEmail = useMemo(
    () => (selectedEmployeeEmail ?? (getNestedValue(selectedEmployee, 'contact.email') as string | undefined)),
    [selectedEmployee, selectedEmployeeEmail],
  );
  const contactPhone = useMemo(
    () => (selectedEmployeePhone ?? (getNestedValue(selectedEmployee, 'contact.phone') as string | undefined)),
    [selectedEmployee, selectedEmployeePhone],
  );
  const contactLocation = useMemo(
    () =>
      selectedEmployeeLocation ??
      (getNestedValue(selectedEmployee, 'contact.location') as string | undefined) ??
      (getNestedValue(selectedEmployee, 'contact.city') as string | undefined),
    [selectedEmployee, selectedEmployeeLocation],
  );
  const employmentOverview = useMemo(() => {
    if (!selectedEmployee) return null;
    const overview = getNestedValue(selectedEmployee, 'employment_overview') as Record<string, unknown> | undefined;
    if (!overview || typeof overview !== 'object') return null;
    return {
      employmentType:
        getEmployeeField(overview, ['employment_type', 'EmploymentType']) || selectedEmployee.EmploymentType,
      joined: toDateString(getNestedValue(overview, 'joined')) ?? formatDate(selectedEmployee.DateOfJoining),
      lastPromotion:
        toDateString(getNestedValue(overview, 'last_promotion')) ??
        formatDate(selectedEmployee.LastPromotionDate),
    };
  }, [selectedEmployee]);

  const compensationOverview = useMemo(() => {
    if (!selectedEmployee) return null;
    const compensation = getNestedValue(selectedEmployee, 'compensation') as Record<string, unknown> | undefined;
    if (!compensation || typeof compensation !== 'object') return null;
    return {
      salary:
        (typeof compensation.annual_salary === 'number' ? compensation.annual_salary : undefined) ??
        selectedEmployee.Salary,
      leaveBalance:
        (typeof compensation.leave_balance === 'number' ? compensation.leave_balance : undefined) ??
        selectedEmployee.LeaveBalance,
      benefits:
        getEmployeeField(compensation, ['benefits', 'Benefits']) ?? (selectedEmployee.Benefits as string | undefined),
    };
  }, [selectedEmployee]);

  const performanceOverview = useMemo(() => {
    if (!selectedEmployee) return null;
    const insights = getNestedValue(selectedEmployee, 'performance_insights') as Record<string, unknown> | undefined;
    if (!insights || typeof insights !== 'object') return null;
    return {
      score:
        (typeof insights.performance_score_arima === 'number'
          ? insights.performance_score_arima
          : undefined) ?? (selectedEmployee.performance_rating as number | undefined),
      lastReview:
        toDateString(getNestedValue(insights, 'last_review')) ??
        formatDate(selectedEmployee.LastPerformanceReviewDate),
      nextReview:
        toDateString(getNestedValue(insights, 'next_review')) ?? formatDate(selectedEmployee.NextReviewDate),
    };
  }, [selectedEmployee]);

  const contactInfo = {
    email: contactEmail,
    phone: contactPhone,
    location: contactLocation,
  };

  const selectedEmployeeDisplayId = useMemo(() => {
    if (!selectedEmployee) return null;
    return (
      resolveEmployeeIdentifier(selectedEmployee as Employee) ||
      selectedEmployee.Employee_ID ||
      (selectedEmployee as any)._id ||
      selectedEmployeeName ||
      undefined
    );
  }, [selectedEmployee, selectedEmployeeName]);

  const attritionRisk = attritionData?.data as
    | { risk_score: number; risk_level: 'low' | 'medium' | 'high'; probability: number }
    | undefined;

  const fallbackAttritionRisk = useMemo(() => {
    if (attritionRisk?.risk_level) return attritionRisk.risk_level;
    if (selectedEmployeeAttritionRisk) return selectedEmployeeAttritionRisk.toString();
    return null;
  }, [attritionRisk, selectedEmployeeAttritionRisk]);
  const departmentSuggestions = useMemo(() => {
    const unique = new Set<string>();
    for (const emp of employees as Employee[]) {
      const dept =
        getEmployeeField(emp, DEPARTMENT_KEYS, (emp as any)?.department || emp.Department)?.toString().trim() ||
        '';
      if (dept) {
        unique.add(dept);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const handleCreateEmployee = useCallback(async () => {
    const trimmedName = formData.name.trim();
    const trimmedDepartment = formData.department.trim();
    const trimmedPosition = formData.position.trim();

    if (!trimmedName || !trimmedDepartment || !trimmedPosition) {
      setFormError('Name, Department, and Position are required.');
      return;
    }

    const payload: CreateEmployeePayload = {
      name: trimmedName,
      department: trimmedDepartment,
      position: trimmedPosition,
    };

    if (formData.email.trim()) payload.email = formData.email.trim();
    if (formData.phone.trim()) payload.phone = formData.phone.trim();
    if (formData.dateOfJoining) payload.dateOfJoining = formData.dateOfJoining;
    if (formData.employmentType.trim()) payload.employmentType = formData.employmentType.trim();
    if (formData.manager.trim()) payload.manager = formData.manager.trim();

    setCreateLoading(true);
    setFormError(null);
    try {
      await employeeService.create(payload);
      setCreationSuccess('Employee added successfully.');
      closeAddEmployeeModal();
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to create employee. Please try again.';
      setFormError(typeof message === 'string' ? message : 'Failed to create employee.');
    } finally {
      setCreateLoading(false);
    }
  }, [
    formData,
    closeAddEmployeeModal,
    queryClient,
  ]);

  const handleRefreshPrediction = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setRefreshingPrediction(true);
    try {
      await employeeService.refreshPerformancePrediction({
        employee_ids: [selectedEmployeeId],
        periods: 6,
        force_refresh: true,
      });
      await queryClient.invalidateQueries({
        queryKey: ['employee-performance', selectedEmployeeId],
      });
    } catch (error) {
      console.error('Failed to refresh performance prediction', error);
    } finally {
      setRefreshingPrediction(false);
    }
  }, [selectedEmployeeId, queryClient]);
  const isPanelOpen = !!selectedEmployeeId;
  const isPanelLoading = detailLoading || attritionLoading || performanceLoading || onboardingLoading || detailFetching;

  const onboardingRecord = useMemo<OnboardingRecord | null>(() => {
    if (!onboardingData?.data) return null;
    const records = onboardingData.data as OnboardingRecord[] | undefined;
    if (Array.isArray(records) && records.length > 0) {
      return records[0];
    }
    return null;
  }, [onboardingData]);

  const onboardingTasks = useMemo<OnboardingTask[]>(() => {
    if (!onboardingRecord) return [];
    if (Array.isArray(onboardingRecord.tasks) && onboardingRecord.tasks.length > 0) {
      return onboardingRecord.tasks;
    }
    if (Array.isArray(onboardingRecord.plan?.tasks) && onboardingRecord.plan?.tasks.length > 0) {
      return onboardingRecord.plan?.tasks as OnboardingTask[];
    }
    return [];
  }, [onboardingRecord]);

  const taskProgress = useMemo(() => {
    if (!onboardingRecord && onboardingTasks.length === 0) {
      return {
        total: 0,
        completed: 0,
        pending: 0,
        completionPercentage: 0,
      };
    }

    const total = onboardingTasks.length;
    const completed = onboardingTasks.filter(
      (task) => (task.status || '').toLowerCase() === 'completed',
    ).length;
    const completionPercentage =
      onboardingRecord?.completion_percentage ??
      (total > 0 ? Math.round((completed / total) * 100) : 0);

    return {
      total,
      completed,
      pending: total - completed,
      completionPercentage,
    };
  }, [onboardingRecord, onboardingTasks]);

  const experienceYears =
    selectedEmployee?.TotalWorkingYears ??
    selectedEmployee?.ExperienceYears ??
    selectedEmployee?.TotalExperienceYears ??
    selectedEmployee?.YearsOfExperience;

  const employmentHistoryEntries = useMemo(() => {
    if (!selectedEmployee) return [] as Record<string, unknown>[];
    const potentialSources = [
      selectedEmployee.employment_history,
      selectedEmployee.EmploymentHistory,
      selectedEmployee.CareerHistory,
      selectedEmployee.History,
      selectedEmployee.JobHistory,
      selectedEmployee.WorkHistory,
    ];

    for (const source of potentialSources) {
      if (Array.isArray(source)) {
        return source as Record<string, unknown>[];
      }
      if (source && typeof source === 'object') {
        return Object.values(source as Record<string, Record<string, unknown>>);
      }
    }
    return [] as Record<string, unknown>[];
  }, [selectedEmployee]);

  const hasEmploymentHistory = employmentHistoryEntries.length > 0;
  const selectedEmployeeAvatarInitial =
    (selectedEmployeeName || 'E').charAt(0)?.toUpperCase() || 'E';
  const currentAssignment = selectedEmployee?.current_assignment as string | undefined;

  const additionalAttributes = useMemo(() => {
    if (!selectedEmployee) return [] as Array<{ key: string; value: string }>;
    return Object.entries(selectedEmployee)
      .filter(([key, value]) => {
        if (EXCLUDED_ATTRIBUTE_KEYS.has(key)) return false;
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.trim().length === 0) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value ?? {}).length === 0)
          return false;
        return true;
      })
      .map(([key, value]) => ({
        key: humanizeKey(key),
        value: formatAttributeValue(value),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [selectedEmployee]);

  const normalizedRiskLevel = (fallbackAttritionRisk || '').toLowerCase();
  const riskBadgeClasses = fallbackAttritionRisk
    ? normalizedRiskLevel === 'high'
      ? 'bg-white-500/10 text-black-300 border border-black-500/20'
      : normalizedRiskLevel === 'medium'
        ? 'bg-white-500/10 text-black-300 border border-black-500/20'
        : 'bg-white-500/10 text-black-300 border border-emerald-500/20'
    : 'bg-white-100 text-black border border-black-200';

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    if (!selectedEmployee) return [];
    const events: TimelineEvent[] = [];

    if (selectedEmployee.DateOfJoining) {
      events.push({
        title: 'Joined the company',
        description: `Started as ${selectedEmployeePosition || 'team member'} in ${
          selectedEmployeeDepartment || 'the organisation'
        }.`,
        date: formatDate(selectedEmployee.DateOfJoining),
        status: 'completed',
        icon: BadgeCheck,
      });
    }

    if (selectedEmployee.LastPromotionDate) {
      events.push({
        title: 'Last promotion',
        description: `Promoted on ${formatDate(selectedEmployee.LastPromotionDate)}.`,
        date: formatDate(selectedEmployee.LastPromotionDate),
        status: 'completed',
        icon: TrendingUp,
      });
    }

    events.push({
      title: 'Current assignment',
      description: `Working as ${selectedEmployeePosition || 'N/A'} in ${
        selectedEmployeeDepartment || 'N/A'
      }.`,
      date: formatDate(selectedEmployee.LastRoleChangeDate || selectedEmployee.DateOfJoining),
      status: 'current',
      icon: Briefcase,
    });

    if (attritionRisk || fallbackAttritionRisk) {
      events.push({
        title: 'Attrition risk assessment',
        description: attritionRisk
          ? `Current risk score is ${attritionRisk.risk_score}% (${attritionRisk.risk_level.toUpperCase()}).`
          : `Current risk level is ${fallbackAttritionRisk}.`,
        date: formatDate(new Date()),
        status: (attritionRisk?.risk_level || normalizedRiskLevel) === 'high' ? 'upcoming' : 'current',
        icon: ShieldCheck,
      });
    }

    if (onboardingRecord?.created_at) {
      events.push({
        title: 'Onboarding plan created',
        description: `Personalized onboarding with ${taskProgress.total} tasks was initiated.`,
        date: formatDate(onboardingRecord.created_at),
        status: 'completed',
        icon: ClipboardCheck,
      });
    }

    if (onboardingRecord?.buddy_name) {
      events.push({
        title: 'Buddy assigned',
        description: `${onboardingRecord.buddy_name} (${onboardingRecord.buddy_email || 'email pending'}) assigned as onboarding buddy.`,
        date: formatDate(onboardingRecord.updated_at || onboardingRecord.created_at),
        status: 'completed',
        icon: UserCircle,
      });
    }

    if (taskProgress.total > 0) {
      const nextTask = onboardingTasks.find(
        (task) => (task.status || '').toLowerCase() !== 'completed',
      );
      if (nextTask) {
        events.push({
          title: 'Next onboarding task',
          description: `${nextTask.task || nextTask.description || 'Upcoming task'}${
            nextTask.owner ? ` · Owner: ${nextTask.owner}` : ''
          }`,
          date: formatDate(nextTask.due_date),
          status: 'upcoming',
          icon: ListChecks,
        });
      }
    }

    events.push({
      title: 'Next performance review',
      description:
        selectedEmployee.NextReviewDate
          ? `Scheduled for ${formatDate(selectedEmployee.NextReviewDate)}.`
          : 'Schedule the next performance review.',
      date: formatDate(selectedEmployee.NextReviewDate),
      status: 'upcoming',
      icon: CalendarDays,
    });

    return events;
  }, [selectedEmployee, attritionRisk, onboardingRecord, onboardingTasks, taskProgress]);

  const trackingCards = useMemo(
    () =>
      selectedEmployee
        ? [
            {
              title: 'Service tenure',
              value: selectedEmployeeServiceTenure ?? calculateServiceDuration(selectedEmployee.DateOfJoining),
              description: 'Time since hire',
              accent: 'from-purple-500/20 to-fuchsia-500/20',
              icon: Clock,
            },
            {
              title: 'Total experience',
              value: formattedExperienceYears
                ? formattedExperienceYears
                : selectedEmployee.Experience ||
                  selectedEmployee.ExperienceSummary ||
                  'Experience not recorded',
              description: 'Overall professional tenure',
              accent: 'from-indigo-500/20 to-blue-500/20',
              icon: Briefcase,
            },
            {
              title: 'Performance rating',
              value:
                selectedEmployee.PerformanceRating !== undefined
                  ? selectedEmployee.PerformanceRating
                  : 'Not recorded',
              description: 'Latest annual review',
              accent: 'from-emerald-500/20 to-teal-500/20',
              icon: Activity,
            },
            {
              title: 'Onboarding progress',
              value:
                selectedEmployeeOnboardingProgress
                  ? selectedEmployeeOnboardingProgress
                  : taskProgress.total > 0
                    ? `${taskProgress.completed}/${taskProgress.total} • ${taskProgress.completionPercentage}%`
                  : onboardingError
                    ? 'No onboarding data'
                    : 'Planning...',
              description: 'Tasks completed from onboarding plan',
              accent: 'from-blue-500/20 to-cyan-500/20',
              icon: ClipboardCheck,
            },
            {
              title: 'Attrition risk',
              value: attritionRisk
                ? `${attritionRisk.risk_score}% • ${attritionRisk.risk_level.toUpperCase()}`
                : fallbackAttritionRisk
                  ? fallbackAttritionRisk
                  : attritionError
                    ? 'Model unavailable'
                    : 'Evaluating...',
              description: 'Machine learning risk signal',
              accent:
                attritionRisk?.risk_level === 'high'
                  ? 'from-red-500/25 to-rose-500/25'
                  : attritionRisk?.risk_level === 'medium'
                    ? 'from-amber-500/25 to-orange-500/25'
                    : 'from-emerald-500/25 to-teal-500/25',
              icon: ShieldCheck,
            },
          ]
        : [],
    [selectedEmployee, attritionRisk, attritionError, taskProgress, onboardingError, experienceYears],
  );

  const skills = useMemo<string[] | null>(() => {
    const rawSkills = selectedEmployee?.Skills as unknown;
    if (!rawSkills) return null;
    if (Array.isArray(rawSkills)) {
      return (rawSkills as unknown[]).map((skill) => String(skill).trim());
    }
    if (typeof rawSkills === 'string') {
      return (rawSkills as string).split(',').map((skill: string) => skill.trim());
    }
    return null;
  }, [selectedEmployee]);

  const handleSelectEmployee = useCallback(
    (employeeId: string) => {
      setSelectedEmployeeId(employeeId);
    },
    [setSelectedEmployeeId],
  );

  const closePanel = useCallback(() => {
    setSelectedEmployeeId(null);
  }, [setSelectedEmployeeId]);

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => {
              if (!createLoading) closeAddEmployeeModal();
            }}
          ></div>
          <div className="relative w-full max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-blue-600">Add Employee</h2>
                <p className="text-sm text-black">Create a new employee record</p>
              </div>
              <button
                type="button"
                onClick={closeAddEmployeeModal}
                disabled={createLoading}
                className="rounded-lg p-2 text-black "
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-black-500/30 bg-white-500/10 px-3 py-2 text-sm text-black-300">
                {formError}
              </div>
            )}

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!createLoading) {
                  void handleCreateEmployee();
                }
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Full Name<span className="text-red-400">*</span>
                  </span>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Jane Doe"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Email
                  </span>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="jane.doe@company.com"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Phone
                  </span>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 555 0100"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Department<span className="text-red-400">*</span>
                  </span>
                  <Input
                    value={formData.department}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, department: e.target.value }))
                    }
                    placeholder="People Operations"
                    list="department-suggestions"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Position<span className="text-red-400">*</span>
                  </span>
                  <Input
                    value={formData.position}
                    onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                    placeholder="HR Business Partner"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Manager
                  </span>
                  <Input
                    value={formData.manager}
                    onChange={(e) => setFormData((prev) => ({ ...prev, manager: e.target.value }))}
                    placeholder="Alex Johnson"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Date of Joining
                  </span>
                  <Input
                    type="date"
                    value={formData.dateOfJoining}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, dateOfJoining: e.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-black">
                    Employment Type
                  </span>
                  <select
                    value={formData.employmentType}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, employmentType: e.target.value }))
                    }
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                    <option value="Consultant">Consultant</option>
                  </select>
                </label>
              </div>

              <datalist id="department-suggestions">
                {departmentSuggestions.map((dept) => (
                  <option key={dept} value={dept} />
                ))}
              </datalist>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeAddEmployeeModal}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? 'Adding…' : 'Add Employee'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-blue-600">
              Employees
            </h1>
            <p className="text-black mt-1">Manage your workforce</p>
          </div>
          <Button
            onClick={openAddEmployeeModal}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>

        {creationSuccess && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 shadow-lg shadow-emerald-500/10">
            {creationSuccess}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 w-5 h-5 text-black" />
          <Input
            placeholder="Search employees by name, ID, or department..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-white border-gray-300 text-black placeholder-gray-400 focus:border-blue-500"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading employees...</div>
          </div>
        )}

        {/* Employee Grid */}
        {!isLoading && employees.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No employees found</p>
          </div>
        )}

        {!isLoading && employees.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {employees.map((emp: Employee) => {
                const employeeIdentifier = resolveEmployeeIdentifier(emp);
                const displayId = employeeIdentifier || '';
                const employeeName = getEmployeeField(emp, NAME_KEYS, emp.Name) || 'Unknown';
                const employeePosition = getEmployeeField(emp, POSITION_KEYS, emp.Position)?.trim() || '';
                const employeeDepartment = getEmployeeField(emp, DEPARTMENT_KEYS, emp.Department)?.trim() || '';
                const avatarInitial = employeeName.charAt(0)?.toUpperCase() || 'E';
                return (
                  <Card
                    key={employeeIdentifier || emp.Employee_ID || emp._id || employeeName}
                  role="button"
                  tabIndex={0}
                    onClick={() => employeeIdentifier && handleSelectEmployee(employeeIdentifier)}
                  onKeyDown={(event) => {
                      if (!employeeIdentifier) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelectEmployee(employeeIdentifier);
                      }
                    }}
                  className="cursor-pointer border border-gray-200 bg-white focus:outline-none hover:border-blue-300 hover:shadow-md transition-all duration-200"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {avatarInitial}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                              if (employeeIdentifier) {
                                handleSelectEmployee(employeeIdentifier);
                              }
                          }}
                          className="font-semibold text-lg text-gray-900 focus:outline-none rounded-md px-1 py-0.5"
                        >
                          {employeeName}
                        </button>
                        {employeePosition && <p className="text-sm text-gray-600">{employeePosition}</p>}
                      </div>
                      {employeeDepartment && (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                          {employeeDepartment}
                        </Badge>
                      )}
                      {displayId && <div className="text-xs text-gray-500">ID: {displayId}</div>}
                      {emp.Salary && (
                        <div className="text-sm font-medium text-blue-600">
                          {formatCurrency(emp.Salary)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {employeesData?.pagination && employeesData.pagination.pages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-gray-300 text-gray-700"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {employeesData.pagination.pages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(employeesData.pagination.pages, p + 1))}
                  disabled={page >= employeesData.pagination.pages}
                  className="border-gray-300 text-gray-700"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Panel */}
      {isPanelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closePanel}
          />
          <div
            className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-white border-l border-gray-200 shadow-xl"
          >
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div>
                  <p className="text-sm uppercase tracking-widest text-gray-500">
                    Employee snapshot
                  </p>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedEmployee?.Name || 'Loading employee'}
                  </h2>
                </div>
                <button
                  onClick={closePanel}
                  className="rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="h-full overflow-y-auto px-6 py-6 bg-gray-50">
                {isPanelLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                    <p>Loading employee record...</p>
                  </div>
                )}

                {!isPanelLoading && detailError && (
                  <div className="rounded-lg border border-black-500/30 bg-white-500/10 p-6 text-black-200">
                    <h3 className="text-lg font-semibold mb-2">Unable to load employee</h3>
                    <p>{(detailError as Error).message}</p>
                  </div>
                )}

                {!isPanelLoading && !detailError && selectedEmployee && (
                  <div className="space-y-6 pb-10">
                    {/* Hero */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl font-semibold text-white shadow-md">
                            {selectedEmployeeAvatarInitial}
                          </div>
                          <div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-2xl font-semibold text-gray-900">
                                {selectedEmployeeName || 'Employee'}
                              </h3>
                              <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                                #{selectedEmployeeDisplayId || '—'}
                              </Badge>
                            </div>
                            <p className="text-gray-600 mt-1">
                              {selectedEmployeePosition || 'Role TBD'} ·{' '}
                              {selectedEmployeeDepartment || 'Department TBD'}
                            </p>
                            {selectedEmployeeManager && (
                              <p className="text-sm text-gray-500 mt-2">
                                Reporting to {selectedEmployeeManager}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider ${riskBadgeClasses}`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Attrition risk:{' '}
                            {attritionRisk
                              ? `${attritionRisk.risk_level.toUpperCase()} (${attritionRisk.risk_score}%)`
                              : fallbackAttritionRisk
                                ? fallbackAttritionRisk
                                : attritionError
                                  ? 'Unavailable'
                                  : 'Evaluating'}
                          </div>
                          <div className="text-gray-600">
                            Joined {employmentOverview?.joined || formatDate(selectedEmployee.DateOfJoining) || '—'} ·{' '}
                            {employmentOverview?.employmentType || selectedEmployee.EmploymentType || 'Employment type pending'}
                          </div>
                          <div className="text-gray-600">
                            Experience:{' '}
                            {formattedExperienceYears
                              ? `${formattedExperienceYears} total`
                              : experienceYears !== undefined
                                ? `${experienceYears} year${experienceYears === 1 ? '' : 's'} total`
                                : selectedEmployee.YearsAtCompany
                                  ? `${selectedEmployee.YearsAtCompany} yrs at company`
                                  : 'Not recorded'}
                          </div>
                          {onboardingRecord && (
                            <div className="flex flex-col gap-1 text-gray-600">
                              <span className="flex items-center gap-2">
                                <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />
                                Onboarding status:{' '}
                                <span className="uppercase text-xs tracking-wider text-blue-700">
                                  {selectedEmployeeOnboardingProgress || onboardingRecord.status || 'Active'}
                                </span>
                              </span>
                              {taskProgress.total > 0 && (
                                <span className="text-xs text-gray-500">
                                  {taskProgress.completed}/{taskProgress.total} tasks completed (
                                  {taskProgress.completionPercentage}%)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tracking cards */}
                    {trackingCards.length > 0 && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {trackingCards.map((item) => (
                          <div
                            key={item.title}
                            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all duration-200 group"
                          >
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <span>{item.title}</span>
                              <item.icon className="w-4 h-4 text-blue-500" />
                            </div>
                            <p className="mt-2 text-xl font-semibold text-gray-900">{item.value}</p>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Personal & Employment details */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <Card className="border-black-200 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg text-black-900">Contact & identity</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 text-sm text-black-700 sm:grid-cols-2">
                          <InfoRow icon={Mail} label="Email" value={contactInfo.email} />
                          <InfoRow icon={Phone} label="Phone" value={contactInfo.phone} />
                          <InfoRow
                            icon={MapPin}
                            label="Location"
                            value={contactInfo.location}
                          />
                          <InfoRow
                            icon={Building2}
                            label="Team"
                            value={selectedEmployeeTeam}
                          />
                        </CardContent>
                      </Card>

                      <Card className="border-gray-200 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg text-gray-900">Employment overview</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 text-sm text-gray-700 sm:grid-cols-2">
                          <InfoRow
                            icon={Briefcase}
                            label="Role"
                            value={selectedEmployeePosition}
                          />
                          <InfoRow
                            icon={CalendarDays}
                            label="Joined"
                            value={employmentOverview?.joined || formatDate(selectedEmployee.DateOfJoining) || '—'}
                          />
                          <InfoRow
                            icon={TrendingUp}
                            label="Last promotion"
                            value={employmentOverview?.lastPromotion || formatDate(selectedEmployee.LastPromotionDate) || '—'}
                          />
                          <InfoRow
                            icon={BadgeCheck}
                            label="Employment type"
                            value={employmentOverview?.employmentType || selectedEmployee.EmploymentType || 'Full-time'}
                          />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Compensation & Performance */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <Card className="border-black-200 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg text-black-900">
                            Compensation & benefits
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-gray-700">
                          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                            <span className="text-gray-700">Annual salary</span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(
                                (compensationOverview?.salary as number | undefined) ?? selectedEmployee.Salary,
                              )}
                            </span>
                          </div>
                          <InfoRow
                            icon={Activity}
                            label="Leave balance"
                            value={
                              compensationOverview?.leaveBalance !== undefined
                                ? `${compensationOverview.leaveBalance} days`
                                : selectedEmployee.LeaveBalance !== undefined
                                  ? `${selectedEmployee.LeaveBalance} days`
                                : 'Not recorded'
                            }
                          />
                          <InfoRow
                            icon={ShieldCheck}
                            label="Benefits"
                            value={
                              compensationOverview?.benefits ||
                              selectedEmployee.Benefits ||
                              'Standard benefits package'
                            }
                          />
                        </CardContent>
                      </Card>

                      <Card className="border-gray-200 bg-white">
                        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <CardTitle className="text-lg text-gray-900">
                            Performance & risk insights
                          </CardTitle>
                          {selectedEmployeeId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRefreshPrediction}
                              disabled={refreshingPrediction}
                              className="border-gray-300 text-gray-700 hover:bg-gray-100"
                            >
                              <RefreshCw
                                className={`mr-2 h-4 w-4 ${refreshingPrediction ? 'animate-spin' : ''}`}
                              />
                              {refreshingPrediction ? 'Refreshing...' : 'Regenerate forecast'}
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-black-700">
                          {/* Performance Score - Prominent Display */}
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-blue-100 p-2">
                                  <Activity className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-gray-500">
                                    Performance Score (Forecast)
                                  </p>
                                  {performancePrediction?.current_performance_score !== undefined ? (
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl font-bold text-gray-900">
                                        {performancePrediction.current_performance_score.toFixed(1)}
                                      </span>
                                      <span className="text-sm text-gray-500">/ 100</span>
                                      <Badge
                                        className={`ml-2 ${
                                          performancePrediction.current_performance_score >= 80
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                            : performancePrediction.current_performance_score >= 60
                                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                                              : 'bg-red-100 text-red-800 border-red-200'
                                        }`}
                                      >
                                        {performancePrediction.trend === 'increasing'
                                          ? '↑ Improving'
                                          : performancePrediction.trend === 'decreasing'
                                            ? '↓ Declining'
                                            : '→ Stable'}
                                      </Badge>
                                    </div>
                                  ) : performanceOverview?.score !== undefined ? (
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl font-bold text-gray-900">
                                        {Number(performanceOverview.score).toFixed(1)}
                                      </span>
                                      <span className="text-sm text-gray-500">/ 5</span>
                                      <Badge className="ml-2 bg-emerald-100 text-emerald-800 border-emerald-200">
                                        Manual score
                                      </Badge>
                                    </div>
                                  ) : performanceLoading ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                                      <span className="text-gray-500">Calculating...</span>
                                    </div>
                                  ) : performanceError ? (
                                    <span className="text-amber-600">Model unavailable</span>
                                  ) : (
                                    <span className="text-gray-500">No prediction available</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {performancePrediction && (performanceHistory.length > 0 || performanceForecast.length > 0) && (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                                  Recent performance history
                                </p>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                  <ul className="space-y-2 text-sm text-gray-700">
                                    {performanceHistory.length > 0 ? (
                                      performanceHistory.slice(-6).map((entry, idx) => (
                                        <li
                                          key={`${entry.date}-${idx}`}
                                          className="flex items-center justify-between"
                                        >
                                          <span>{formatDate(entry.date) || entry.date}</span>
                                          <span className="font-medium text-gray-900">
                                            {typeof entry.score === 'number'
                                              ? entry.score.toFixed(1)
                                              : Number(entry.score ?? 0).toFixed(1)}
                                          </span>
                                        </li>
                                      ))
                                    ) : (
                                      <li className="text-xs text-gray-500">No historical records available.</li>
                                    )}
                                  </ul>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                                  Forecast (next {performanceForecast.length} period{performanceForecast.length === 1 ? '' : 's'})
                                </p>
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                  <ul className="space-y-2 text-sm text-gray-700">
                                    {performanceForecast.length > 0 ? (
                                      performanceForecast.map((entry, idx) => (
                                        <li
                                          key={`${entry.date}-${idx}`}
                                          className="flex items-center justify-between"
                                        >
                                          <span>{formatDate(entry.date) || entry.date}</span>
                                          <span className="font-medium text-emerald-600">
                                            {typeof entry.predicted_score === 'number'
                                              ? entry.predicted_score.toFixed(1)
                                              : Number(entry.predicted_score ?? 0).toFixed(1)}
                                          </span>
                                        </li>
                                      ))
                                    ) : (
                                      <li className="text-xs text-gray-500">Forecast not available.</li>
                                    )}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}

                          {performanceGeneratedAt && (
                            <p className="text-xs text-black-500">
                              Last updated {formatDate(performanceGeneratedAt) || performanceGeneratedAt}
                            </p>
                          )}
                          {!performancePrediction && performanceOverview && (
                            <p className="text-xs text-black-500">
                              Manual review data last updated{' '}
                              {performanceOverview.lastReview || 'Not recorded'}
                            </p>
                          )}

                          {/* Attrition Risk - Prominent Display */}
                          <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`rounded-lg p-2  ${
                                    attritionRisk
                                      ? attritionRisk.risk_level === 'high'
                                        ? 'bg-red-100'
                                        : attritionRisk.risk_level === 'medium'
                                          ? 'bg-amber-100'
                                          : 'bg-emerald-100'
                                      : 'bg-gray-200'
                                  }`}
                                >
                                  <ShieldCheck
                                    className={`w-5 h-5 ${
                                      attritionRisk
                                        ? attritionRisk.risk_level === 'high'
                                          ? 'text-red-600'
                                          : attritionRisk.risk_level === 'medium'
                                            ? 'text-amber-600'
                                            : 'text-emerald-600'
                                        : 'text-gray-500'
                                    }`}
                                  />
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-gray-500">
                                    Attrition Risk
                                  </p>
                                  {attritionRisk ? (
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl font-bold text-gray-900">
                                        {(attritionRisk.probability * 100).toFixed(1)}%
                                      </span>
                                      <Badge
                                        className={`ml-2 ${
                                          attritionRisk.risk_level === 'high'
                                            ? 'bg-red-100 text-red-800 border-red-200'
                                            : attritionRisk.risk_level === 'medium'
                                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                        }`}
                                      >
                                        {attritionRisk.risk_level.toUpperCase()} RISK
                                      </Badge>
                                    </div>
                                  ) : fallbackAttritionRisk ? (
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-2xl font-bold text-gray-900">
                                        {fallbackAttritionRisk}
                                      </span>
                                      <Badge
                                        className={`ml-2 ${
                                          normalizedRiskLevel === 'high'
                                            ? 'bg-red-100 text-red-800 border-red-200'
                                            : normalizedRiskLevel === 'medium'
                                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                        }`}
                                      >
                                        Manual risk
                                      </Badge>
                                    </div>
                                  ) : attritionLoading ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                                      <span className="text-gray-500">Scoring...</span>
                                    </div>
                                  ) : attritionError ? (
                                    <span className="text-amber-600">
                                      Model unavailable for this employee
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">No data available</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 pt-4">
                            <InfoRow
                              icon={TrendingUp}
                              label="Last performance review"
                              value={
                                formatDate(selectedEmployee.LastPerformanceReviewDate) ||
                                'Review pending'
                              }
                            />
                            <InfoRow
                              icon={CalendarDays}
                              label="Next review"
                              value={
                                formatDate(selectedEmployee.NextReviewDate) || 'Yet to be scheduled'
                              }
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Onboarding & Tasks */}
                    <Card className="border-black-200 bg-white">
                      <CardHeader>
                        <CardTitle className="text-lg text-black-900 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <span>Onboarding & task tracking</span>
                          {onboardingRecord?.start_date && (
                            <span className="text-xs uppercase tracking-wider text-gray-600">
                              Start date: {formatDate(onboardingRecord.start_date) || '—'}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {onboardingLoading ? (
                          <div className="flex flex-col items-center justify-center gap-3 py-6 text-gray-600">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                            <p className="text-sm">Fetching onboarding plan…</p>
                          </div>
                        ) : onboardingError ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                            Unable to load onboarding data for this employee.{' '}
                            {onboardingError instanceof Error
                              ? onboardingError.message
                              : String(onboardingError)}
                          </div>
                        ) : taskProgress.total === 0 ? (
                          <div className="rounded-lg border border-gray-200 bg-gray-100 p-5 text-sm text-gray-800 leading-relaxed">
                            No onboarding plan is recorded for this employee yet. Create one from the
                            onboarding agent when the employee is newly hired to start tracking tasks,
                            documents, and buddy assignments.
                          </div>
                        ) : (
                          <>
                            <div>
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>Completion</span>
                                <span className="font-medium text-gray-900">{taskProgress.completionPercentage}%</span>
                              </div>
                              <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                                <div
                                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                                  style={{
                                    width: `${Math.min(taskProgress.completionPercentage, 100)}%`,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              {onboardingTasks.slice(0, 6).map((task, idx) => {
                                const normalizedStatus = (task.status || 'pending').toLowerCase();
                                const statusLabel =
                                  normalizedStatus === 'completed'
                                    ? 'Completed'
                                    : normalizedStatus === 'in-progress' ||
                                        normalizedStatus === 'ongoing'
                                      ? 'In progress'
                                      : normalizedStatus === 'blocked'
                                        ? 'Blocked'
                                        : 'Pending';
                                const statusClasses =
                                  normalizedStatus === 'completed'
                                    ? 'bg-emerald-100 border border-emerald-200 text-emerald-800'
                                    : normalizedStatus === 'in-progress' ||
                                        normalizedStatus === 'ongoing'
                                      ? 'bg-blue-100 border border-blue-200 text-blue-800'
                                      : normalizedStatus === 'blocked'
                                        ? 'bg-red-100 border border-red-200 text-red-800'
                                        : 'bg-gray-100 border border-gray-200 text-gray-700';

                                return (
                                  <div
                                    key={`${task.task || task.description || 'task'}-${idx}`}
                                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-start sm:justify-between shadow-sm"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {task.task || task.description || 'Onboarding task'}
                                      </p>
                                      {task.description && (
                                        <p className="text-xs text-gray-600 leading-relaxed">{task.description}</p>
                                      )}
                                      <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wider text-gray-500">
                                        {task.owner && <span>Owner: {task.owner}</span>}
                                        {task.category && <span>Category: {task.category}</span>}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-start gap-2 text-xs text-gray-600 sm:items-end">
                                      <span>
                                        Due:{' '}
                                        {task.due_date
                                          ? formatDate(task.due_date) || '—'
                                          : 'Not set'}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${statusClasses}`}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {statusLabel}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {taskProgress.total > 6 && (
                              <p className="text-xs text-gray-600">
                                Showing 6 of {taskProgress.total} onboarding tasks.
                              </p>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Employment History */}
                    <Card className="border-gray-200 bg-white">
                      <CardHeader>
                        <CardTitle className="text-lg text-gray-900">Employment history & moves</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {hasEmploymentHistory ? (
                          employmentHistoryEntries.map((record, idx) => {
                            const entry = record as Record<string, unknown>;
                            const role = extractStringField(entry, [
                              'role',
                              'position',
                              'title',
                              'designation',
                              'jobTitle',
                            ]);
                            const department = extractStringField(entry, [
                              'department',
                              'team',
                              'division',
                              'businessUnit',
                              'company',
                              'organization',
                              'employer',
                            ]);
                            const start = extractStringField(entry, [
                              'start',
                              'from',
                              'start_date',
                              'startDate',
                              'joined',
                            ]);
                            const end = extractStringField(entry, [
                              'end',
                              'to',
                              'end_date',
                              'endDate',
                              'left',
                            ]);
                            const achievements =
                              entry.achievements ||
                              entry.Achievements ||
                              entry.highlights ||
                              entry.Highlights;
                            const responsibilities =
                              entry.responsibilities ||
                              entry.Responsibilities ||
                              entry.description;
                            const responsibilitiesText =
                              typeof responsibilities === 'string'
                                ? responsibilities
                                : Array.isArray(responsibilities)
                                  ? (responsibilities as unknown[])
                                      .map((item) => String(item))
                                      .join(', ')
                                  : undefined;
                            const achievementsList = Array.isArray(achievements)
                              ? (achievements as unknown[])
                              : null;
                            const durationText =
                              extractStringField(entry, ['duration', 'tenure', 'timeframe']) ||
                              undefined;

                            return (
                              <div
                                key={`history-${idx}`}
                                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 md:flex-row md:items-start md:gap-4 shadow-sm"
                              >
                                <div className="flex items-center gap-3 md:w-1/3">
                                  <div className="rounded-xl bg-blue-50 p-3">
                                    <Briefcase className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {role || 'Role information'}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {department || selectedEmployeeDepartment || 'Department'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex-1 space-y-2 text-sm">
                                  <p className="text-xs text-gray-600 font-medium">
                                    {start || end
                                      ? `${formatDateRange(start, end)} • ${calculateDurationBetween(start, end)}`
                                      : durationText || 'Duration not recorded'}
                                  </p>
                                  {responsibilitiesText && (
                                    <p className="text-sm text-gray-700 leading-relaxed">{responsibilitiesText}</p>
                                  )}
                                  {achievementsList && achievementsList.length > 0 && (
                                    <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600">
                                      {achievementsList.slice(0, 4).map((item, achievementIdx) => (
                                        <li key={`achievement-${idx}-${achievementIdx}`}>
                                          {String(item)}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-gray-600 leading-relaxed">
                            No historical records were found for this employee. Use the onboarding or
                            database manager agents to enrich employment history.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Skills & Projects */}
                    {(skills && skills.length > 0) || selectedEmployee?.Projects ? (
                      <Card className="border-gray-200 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg text-gray-900">
                            Skills & current assignments
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {currentAssignment && (
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                              <p className="text-xs uppercase tracking-wider text-indigo-700">Current assignment</p>
                              <p className="mt-2 text-sm text-indigo-900">{currentAssignment}</p>
                            </div>
                          )}
                          {skills && skills.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-wider text-gray-500">
                                Core skills
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {skills.map((skill: string) => (
                                  <span
                                    key={skill}
                                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-800"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedEmployee?.Projects && selectedEmployee.Projects.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs uppercase tracking-wider text-gray-500">
                                Active projects
                              </p>
                              <div className="space-y-2">
                                {selectedEmployee.Projects.map((project, idx) => (
                                  <div
                                    key={`${project.name}-${idx}`}
                                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm"
                                  >
                                    <div>
                                      <p className="font-medium text-gray-900">{project.name}</p>
                                      <p className="text-xs text-gray-600">
                                        Role: {project.role || 'Contributor'}
                                      </p>
                                    </div>
                                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 font-medium">
                                      {project.status || 'In progress'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}

                    {/* Timeline */}
                    <Card className="border-gray-200 bg-white">
                      <CardHeader>
                        <CardTitle className="text-lg text-gray-900">
                          Employee journey & tracking
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {timelineEvents.length === 0 ? (
                          <p className="text-sm text-gray-600">
                            Tracking data is not yet available for this employee.
                          </p>
                        ) : (
                          <div className="space-y-6">
                            {timelineEvents.map((event, index) => {
                              const statusStyles =
                                event.status === 'completed'
                                  ? 'bg-emerald-100 border border-emerald-200 text-emerald-700'
                                  : event.status === 'current'
                                    ? 'bg-blue-100 border border-blue-200 text-blue-700'
                                    : 'bg-gray-100 border border-gray-200 text-gray-700';
                              const statusLabel =
                                event.status === 'completed'
                                  ? 'Completed'
                                  : event.status === 'current'
                                    ? 'In progress'
                                    : 'Upcoming';

                              return (
                                <div key={`${event.title}-${index}`} className="flex gap-4">
                                  <div className="flex flex-col items-center">
                                    <div className={`rounded-xl p-3 ${statusStyles}`}>
                                      <event.icon className="w-4 h-4" />
                                    </div>
                                    {index !== timelineEvents.length - 1 && (
                                      <div className="mt-2 h-full w-px bg-gray-200" />
                                    )}
                                  </div>
                                  <div className="flex-1 space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-900">
                                        {event.title}
                                      </span>
                                      <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gray-600 font-medium">
                                        {statusLabel}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-700 leading-relaxed">{event.description}</p>
                                    <p className="text-xs text-gray-500">
                                      {event.date || 'Date to be confirmed'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Additional attributes */}
                    {additionalAttributes.length > 0 && (
                      <Card className="border-gray-200 bg-white">
                        <CardHeader>
                          <CardTitle className="text-lg text-gray-900">Additional employee data</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {additionalAttributes.map((attr) => (
                              <div
                                key={attr.key}
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                              >
                                <p className="text-xs uppercase tracking-wider text-gray-500">{attr.key}</p>
                                <p className="text-sm text-gray-800 break-words">{attr.value || 'Not provided'}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
  
    </div>
  );
};

