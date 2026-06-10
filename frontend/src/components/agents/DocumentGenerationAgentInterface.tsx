import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileCheck,
  FileText,
  Copy,
  Download,
  Loader2,
  History,
  RotateCcw,
  Mail,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { documentsService } from '@/services/api';
import type { DocumentTypeId, GeneratedDocument } from '@/types/api';

type OfferLetterForm = {
  candidateName: string;
  candidateEmail: string;
  candidateAddress: string;
  jobTitle: string;
  department: string;
  startDate: string;
  salary: string;
  bonus: string;
  benefits: string;
  reportingManager: string;
  acceptanceDeadline: string;
  notes: string;
};

type ContractForm = {
  employeeName: string;
  employeeId: string;
  role: string;
  department: string;
  startDate: string;
  contractType: string;
  salary: string;
  benefits: string;
  probationPeriod: string;
  workingHours: string;
  workLocation: string;
  terminationNotice: string;
  governingLaw: string;
};

type ExperienceCertificateForm = {
  employeeName: string;
  employeeId: string;
  role: string;
  startDate: string;
  endDate: string;
  summary: string;
  achievements: string;
  behaviourNotes: string;
};

type SalaryCertificateForm = {
  employeeName: string;
  employeeId: string;
  designation: string;
  joiningDate: string;
  salaryAmount: string;
  salaryBreakdown: string;
  remarks: string;
};

type DocumentMeta = {
  id: DocumentTypeId;
  name: string;
  description: string;
  gradient: string;
};

const DOCUMENT_TYPES: DocumentMeta[] = [
  {
    id: 'offer_letter',
    name: 'Offer Letter',
    description: 'Generate personalized employment offer letters with compensation summary.',

    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'employment_contract',
    name: 'Employment Contract',
    description: 'Draft legally compliant employment contracts with role-specific clauses.',

    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'experience_certificate',
    name: 'Experience Certificate',
    description: 'Summarize tenure, responsibilities, and performance for outgoing employees.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'salary_certificate',
    name: 'Salary Certificate',
    description: 'Confirm compensation details for employee verification requests.',
    
    gradient: 'from-blue-500 to-cyan-500',
  },
];

const OFFER_DEFAULT: OfferLetterForm = {
  candidateName: 'Alex Morgan',
  candidateEmail: 'alex.morgan@example.com',
  candidateAddress: '221B Baker Street, London',
  jobTitle: 'Senior Product Manager',
  department: 'Product Strategy',
  startDate: new Date().toISOString().split('T')[0],
  salary: '$140,000',
  bonus: '15% annual bonus based on performance',
  benefits: 'Comprehensive health cover, stock options, remote-first allowance',
  reportingManager: 'Taylor Reed, VP of Product',
  acceptanceDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  notes: 'Hybrid schedule (3 days onsite), relocation support available.',
};

const CONTRACT_DEFAULT: ContractForm = {
  employeeName: 'Jordan Smith',
  employeeId: 'EMP-10245',
  role: 'Lead Software Engineer',
  department: 'Engineering',
  startDate: new Date().toISOString().split('T')[0],
  contractType: 'Full-time, permanent',
  salary: '$160,000 annually',
  benefits: 'Health, dental, 401(k), equity grants, education stipend',
  probationPeriod: '90 days',
  workingHours: '40 hours per week, flexible schedule',
  workLocation: 'San Francisco, CA (Hybrid)',
  terminationNotice: '30 days written notice from either party',
  governingLaw: 'State of California, USA',
};

const EXPERIENCE_DEFAULT: ExperienceCertificateForm = {
  employeeName: 'Priya Patel',
  employeeId: 'EMP-08732',
  role: 'HR Business Partner',
  startDate: '2019-03-15',
  endDate: new Date().toISOString().split('T')[0],
  summary: 'Led employee engagement programs, policy design, and talent initiatives.',
  achievements: 'Increased engagement score by 18%, launched mentorship academy, reduced attrition by 9%.',
  behaviourNotes: 'Highly collaborative, reliable, and culture champion.',
};

const SALARY_DEFAULT: SalaryCertificateForm = {
  employeeName: 'Miguel Alvarez',
  employeeId: 'EMP-06421',
  designation: 'Finance Manager',
  joiningDate: '2021-06-01',
  salaryAmount: '$110,000 annually',
  salaryBreakdown: 'Base $95,000 · Housing Allowance $10,000 · Transport $5,000',
  remarks: 'Compensation details valid as of current date.',
};

const buildOfferPayload = (form: OfferLetterForm) => ({
  candidate_data: {
    name: form.candidateName,
    email: form.candidateEmail,
    address: form.candidateAddress,
  },
  job_data: {
    title: form.jobTitle,
    department: form.department,
    reporting_manager: form.reportingManager,
    start_date: form.startDate,
  },
  offer_details: {
    salary: form.salary,
    bonus: form.bonus,
    benefits: form.benefits,
    acceptance_deadline: form.acceptanceDeadline,
    additional_notes: form.notes,
  },
});

const buildContractPayload = (form: ContractForm) => ({
  employee_data: {
    name: form.employeeName,
    employee_id: form.employeeId,
    role: form.role,
    department: form.department,
    start_date: form.startDate,
  },
  contract_terms: {
    contract_type: form.contractType,
    compensation: form.salary,
    benefits: form.benefits,
    probation_period: form.probationPeriod,
    working_hours: form.workingHours,
    work_location: form.workLocation,
    termination_notice: form.terminationNotice,
    governing_law: form.governingLaw,
  },
});

const buildExperiencePayload = (form: ExperienceCertificateForm) => ({
  employee_data: {
    name: form.employeeName,
    employee_id: form.employeeId,
    designation: form.role,
    start_date: form.startDate,
    end_date: form.endDate,
  },
  certificate_data: {
    responsibilities_summary: form.summary,
    achievements: form.achievements,
    conduct_notes: form.behaviourNotes,
  },
});

const buildSalaryPayload = (form: SalaryCertificateForm) => ({
  employee_data: {
    name: form.employeeName,
    employee_id: form.employeeId,
    designation: form.designation,
    joining_date: form.joiningDate,
  },
  certificate_data: {
    salary_details: form.salaryAmount,
    breakdown: form.salaryBreakdown,
    remarks: form.remarks,
  },
});

type GenerationState = {
  loading: boolean;
  message: string | null;
  tone: 'info' | 'success' | 'error';
};

export const DocumentGenerationAgentInterface = () => {
  const [selectedType, setSelectedType] = useState<DocumentTypeId>('offer_letter');
  const [offerForm, setOfferForm] = useState<OfferLetterForm>({ ...OFFER_DEFAULT });
  const [contractForm, setContractForm] = useState<ContractForm>({ ...CONTRACT_DEFAULT });
  const [experienceForm, setExperienceForm] = useState<ExperienceCertificateForm>({ ...EXPERIENCE_DEFAULT });
  const [salaryForm, setSalaryForm] = useState<SalaryCertificateForm>({ ...SALARY_DEFAULT });
  const [resultContent, setResultContent] = useState<string>('');
  const [generationState, setGenerationState] = useState<GenerationState>({
    loading: false,
    message: null,
    tone: 'info',
  });
  const [history, setHistory] = useState<GeneratedDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [generatedDocumentId, setGeneratedDocumentId] = useState<string | null>(null);

  const selectedMeta = useMemo(
    () => DOCUMENT_TYPES.find((doc) => doc.id === selectedType) ?? DOCUMENT_TYPES[0],
    [selectedType],
  );

  const resetForm = useCallback(() => {
    if (selectedType === 'offer_letter') setOfferForm({ ...OFFER_DEFAULT });
    if (selectedType === 'employment_contract') setContractForm({ ...CONTRACT_DEFAULT });
    if (selectedType === 'experience_certificate') setExperienceForm({ ...EXPERIENCE_DEFAULT });
    if (selectedType === 'salary_certificate') setSalaryForm({ ...SALARY_DEFAULT });
    setGenerationState({ loading: false, message: 'Sample data restored.', tone: 'info' });
  }, [selectedType]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await documentsService.listDocuments({ type: selectedType });
      if (response.success && Array.isArray(response.data)) {
        setHistory(response.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load document history', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    setResultContent('');
    setGenerationState({ loading: false, message: null, tone: 'info' });
    void loadHistory();
  }, [selectedType, loadHistory]);

  const handleGenerate = useCallback(async () => {
    setGenerationState({ loading: true, message: 'Generating document…', tone: 'info' });
    setResultContent('');

    try {
      let response;
      if (selectedType === 'offer_letter') {
        response = await documentsService.generateOfferLetter(buildOfferPayload(offerForm));
      } else if (selectedType === 'employment_contract') {
        response = await documentsService.generateContract(buildContractPayload(contractForm));
      } else if (selectedType === 'experience_certificate') {
        response = await documentsService.generateExperienceCertificate(buildExperiencePayload(experienceForm));
      } else {
        response = await documentsService.generateSalaryCertificate(buildSalaryPayload(salaryForm));
      }

      const generated = response?.data;
      if (generated?.error) {
        setGenerationState({ loading: false, message: generated.error, tone: 'error' });
        return;
      }

      const content = generated?.content ?? generated?.document?.content;
      if (!content) {
        setGenerationState({
          loading: false,
          message: 'The agent did not return any content. Please try again with more details.',
          tone: 'error',
        });
        return;
      }

      const docId = generated?.document?._id || generated?._id;
      if (docId) setGeneratedDocumentId(docId);

      setResultContent(content);
      setGenerationState({
        loading: false,
        message: 'Document generated successfully. Review the content below.',
        tone: 'success',
      });
      void loadHistory();
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to generate the document. Please check the server logs.';
      setGenerationState({ loading: false, message, tone: 'error' });
    }
  }, [selectedType, offerForm, contractForm, experienceForm, salaryForm, loadHistory]);

  const handleCopy = useCallback(async () => {
    if (!resultContent) return;
    try {
      await navigator.clipboard.writeText(resultContent);
      setGenerationState({ loading: false, message: 'Copied document to clipboard.', tone: 'success' });
    } catch (error) {
      setGenerationState({
        loading: false,
        message: 'Unable to copy to clipboard. Please copy manually.',
        tone: 'error',
      });
    }
  }, [resultContent]);

  const handleDownload = useCallback(() => {
    if (!resultContent) return;
    const filename = `${selectedType.replace('_', '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    const blob = new Blob([resultContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [resultContent, selectedType]);

  const handleDownloadFormat = useCallback(async (format: 'pdf' | 'docx') => {
    if (!generatedDocumentId) return;
    try {
      setGenerationState({ loading: true, message: `Preparing ${format.toUpperCase()}...`, tone: 'info' });
      const blob = await documentsService.downloadDocument(generatedDocumentId, format);
      const filename = `${selectedType.replace('_', '-')}-${new Date().toISOString().split('T')[0]}.${format}`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setGenerationState({ loading: false, message: `Downloaded as ${format.toUpperCase()}.`, tone: 'success' });
    } catch (error) {
      setGenerationState({ loading: false, message: `Failed to download ${format.toUpperCase()}.`, tone: 'error' });
    }
  }, [generatedDocumentId, selectedType]);

  const renderTextArea = (value: string, onChange: (val: string) => void, placeholder?: string) => (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );

  const renderOfferForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Candidate name</span>
        <Input
          value={offerForm.candidateName}
          onChange={(event) => setOfferForm((prev) => ({ ...prev, candidateName: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Candidate email</span>
        <Input
          type="email"
          value={offerForm.candidateEmail}
          onChange={(event) => setOfferForm((prev) => ({ ...prev, candidateEmail: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Reporting manager</span>
        <Input
          value={offerForm.reportingManager}
          onChange={(event) => setOfferForm((prev) => ({ ...prev, reportingManager: event.target.value }))}
        />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Candidate address</span>
        {renderTextArea(offerForm.candidateAddress, (value) =>
          setOfferForm((prev) => ({ ...prev, candidateAddress: value })),
        )}
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Job title</span>
        <Input
          value={offerForm.jobTitle}
          onChange={(event) => setOfferForm((prev) => ({ ...prev, jobTitle: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Department</span>
        <Input
          value={offerForm.department}
          onChange={(event) => setOfferForm((prev) => ({ ...prev, department: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Start date</span>
        <Input
          type="date"
          value={offerForm.startDate}
          onChange={(event) => setOfferForm((prev) => ({ ...prev, startDate: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Acceptance deadline</span>
        <Input
          type="date"
          value={offerForm.acceptanceDeadline}
          onChange={(event) =>
            setOfferForm((prev) => ({ ...prev, acceptanceDeadline: event.target.value }))
          }
        />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Salary & compensation</span>
        {renderTextArea(offerForm.salary, (value) => setOfferForm((prev) => ({ ...prev, salary: value })))}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Bonus & incentives</span>
        {renderTextArea(offerForm.bonus, (value) => setOfferForm((prev) => ({ ...prev, bonus: value })))}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Benefits</span>
        {renderTextArea(offerForm.benefits, (value) => setOfferForm((prev) => ({ ...prev, benefits: value })))}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Additional notes</span>
        {renderTextArea(offerForm.notes, (value) => setOfferForm((prev) => ({ ...prev, notes: value })))}
      </label>
    </div>
  );

  const renderContractForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Employee name</span>
        <Input
          value={contractForm.employeeName}
          onChange={(event) => setContractForm((prev) => ({ ...prev, employeeName: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Employee ID</span>
        <Input
          value={contractForm.employeeId}
          onChange={(event) => setContractForm((prev) => ({ ...prev, employeeId: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Role / Title</span>
        <Input
          value={contractForm.role}
          onChange={(event) => setContractForm((prev) => ({ ...prev, role: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Department</span>
        <Input
          value={contractForm.department}
          onChange={(event) => setContractForm((prev) => ({ ...prev, department: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Start date</span>
        <Input
          type="date"
          value={contractForm.startDate}
          onChange={(event) => setContractForm((prev) => ({ ...prev, startDate: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Contract type</span>
        <Input
          value={contractForm.contractType}
          onChange={(event) => setContractForm((prev) => ({ ...prev, contractType: event.target.value }))}
        />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Salary & benefits</span>
        {renderTextArea(contractForm.salary, (value) => setContractForm((prev) => ({ ...prev, salary: value })))}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Benefits</span>
        {renderTextArea(contractForm.benefits, (value) => setContractForm((prev) => ({ ...prev, benefits: value })))}
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Probation period</span>
        <Input
          value={contractForm.probationPeriod}
          onChange={(event) => setContractForm((prev) => ({ ...prev, probationPeriod: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Working hours</span>
        <Input
          value={contractForm.workingHours}
          onChange={(event) => setContractForm((prev) => ({ ...prev, workingHours: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Work location</span>
        <Input
          value={contractForm.workLocation}
          onChange={(event) => setContractForm((prev) => ({ ...prev, workLocation: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Termination notice</span>
        <Input
          value={contractForm.terminationNotice}
          onChange={(event) => setContractForm((prev) => ({ ...prev, terminationNotice: event.target.value }))}
        />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Governing law</span>
        <Input
          value={contractForm.governingLaw}
          onChange={(event) => setContractForm((prev) => ({ ...prev, governingLaw: event.target.value }))}
        />
      </label>
    </div>
  );

  const renderExperienceForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Employee name</span>
        <Input
          value={experienceForm.employeeName}
          onChange={(event) =>
            setExperienceForm((prev) => ({ ...prev, employeeName: event.target.value }))
          }
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Employee ID</span>
        <Input
          value={experienceForm.employeeId}
          onChange={(event) =>
            setExperienceForm((prev) => ({ ...prev, employeeId: event.target.value }))
          }
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Designation</span>
        <Input
          value={experienceForm.role}
          onChange={(event) => setExperienceForm((prev) => ({ ...prev, role: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Start date</span>
        <Input
          type="date"
          value={experienceForm.startDate}
          onChange={(event) =>
            setExperienceForm((prev) => ({ ...prev, startDate: event.target.value }))
          }
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">End date</span>
        <Input
          type="date"
          value={experienceForm.endDate}
          onChange={(event) =>
            setExperienceForm((prev) => ({ ...prev, endDate: event.target.value }))
          }
        />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Summary of responsibilities</span>
        {renderTextArea(experienceForm.summary, (value) =>
          setExperienceForm((prev) => ({ ...prev, summary: value })),
        )}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Key achievements</span>
        {renderTextArea(experienceForm.achievements, (value) =>
          setExperienceForm((prev) => ({ ...prev, achievements: value })),
        )}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Conduct & behaviour notes</span>
        {renderTextArea(experienceForm.behaviourNotes, (value) =>
          setExperienceForm((prev) => ({ ...prev, behaviourNotes: value })),
        )}
      </label>
    </div>
  );

  const renderSalaryForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Employee name</span>
        <Input
          value={salaryForm.employeeName}
          onChange={(event) => setSalaryForm((prev) => ({ ...prev, employeeName: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Employee ID</span>
        <Input
          value={salaryForm.employeeId}
          onChange={(event) => setSalaryForm((prev) => ({ ...prev, employeeId: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Designation</span>
        <Input
          value={salaryForm.designation}
          onChange={(event) => setSalaryForm((prev) => ({ ...prev, designation: event.target.value }))}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Joining date</span>
        <Input
          type="date"
          value={salaryForm.joiningDate}
          onChange={(event) => setSalaryForm((prev) => ({ ...prev, joiningDate: event.target.value }))}
        />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Salary details</span>
        {renderTextArea(salaryForm.salaryAmount, (value) =>
          setSalaryForm((prev) => ({ ...prev, salaryAmount: value })),
        )}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Breakdown</span>
        {renderTextArea(salaryForm.salaryBreakdown, (value) =>
          setSalaryForm((prev) => ({ ...prev, salaryBreakdown: value })),
        )}
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Remarks</span>
        {renderTextArea(salaryForm.remarks, (value) =>
          setSalaryForm((prev) => ({ ...prev, remarks: value })),
        )}
      </label>
    </div>
  );

  const renderActiveForm = () => {
    switch (selectedType) {
      case 'offer_letter':
        return renderOfferForm();
      case 'employment_contract':
        return renderContractForm();
      case 'experience_certificate':
        return renderExperienceForm();
      default:
        return renderSalaryForm();
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg shadow-lg shadow-blue-500/20">
            <FileCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Document Generation Agent
            </h2>
            <p className="text-slate-600 mt-1">
              Automate employment letters, contracts, and certificates with AI assistance.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6">
        <Card className="border border-black-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <FileText className="w-5 h-5 text-blue-500" />
              Document templates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOCUMENT_TYPES.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedType(doc.id)}
                  className={`group rounded-xl border-2 p-5 text-left transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    selectedType === doc.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-md'
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                      selectedType === doc.id
                        ? 'border-blue-300 bg-blue-100 text-blue-800'
                        : 'border-slate-200 bg-slate-100 text-slate-700 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-800'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full bg-gradient-to-br ${doc.gradient}`}></span>
                    {doc.name}
                  </div>
                  <p className={`mt-3 text-sm leading-relaxed transition-colors duration-200 ${
                    selectedType === doc.id ? 'text-slate-600' : 'text-slate-500 group-hover:text-slate-700'
                  }`}>
                    {doc.description}
                  </p>
                  
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-black-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-black-900">{selectedMeta.name}</h3>
                  <p className="text-sm text-gray-600">
                    Provide the relevant details and the agent will draft a complete document.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={resetForm} className="text-black-700">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Use sample data
                </Button>
              </div>
              <div className="space-y-4">{renderActiveForm()}</div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generationState.loading}
                  className="min-w-[180px]"
                >
                  {generationState.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </span>
                  ) : (
                    'Generate document'
                  )}
                </Button>
              </div>
              {generationState.message && (
                <div
                  className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                    generationState.tone === 'success'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : generationState.tone === 'error'
                        ? 'border-red-500/40 bg-red-500/10 text-red-200'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-800'
                  }`}
                >
                  {generationState.message}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Mail className="w-5 h-5 text-blue-600" />
                Generated document
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resultContent ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleCopy}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button type="button" variant="outline" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download .txt
                    </Button>
                    {generatedDocumentId && (
                      <>
                        <Button type="button" variant="outline" onClick={() => handleDownloadFormat('pdf')} className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200">
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button type="button" variant="outline" onClick={() => handleDownloadFormat('docx')} className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border-blue-200">
                          <Download className="w-4 h-4 mr-2" />
                          Download Word
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-900 shadow-inner">
                    <pre className="whitespace-pre-wrap font-sans">{resultContent}</pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600">
                  Generated content will appear here after you run the agent.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <History className="w-5 h-5 text-blue-600" />
                Recent documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history…
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-600">No generated documents yet for this template.</p>
              ) : (
                history.map((doc) => (
                  <div
                    key={doc._id}
                    className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">{doc.employee_name || doc.candidate_name || 'Document'}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(doc.generated_at).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 max-h-20 overflow-hidden">
                      {doc.content}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

