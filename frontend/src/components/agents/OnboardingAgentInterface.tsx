import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, FileText, UserCheck, Calendar, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { onboardingService } from '@/services/api';

const WORKFLOW_STEPS = [
  {
    id: 'send_onboarding_mail',
    name: 'Send Onboarding Mail',
    description: 'Send welcome email to new employee with onboarding information',
    icon: Mail,
  },
  {
    id: 'check_availability',
    name: 'Check Orientation Availability',
    description: 'Send email to check employee availability for orientation session',
    icon: Calendar,
  },
  {
    id: 'schedule_orientation',
    name: 'Schedule Orientation Meeting',
    description: 'Schedule orientation meeting based on employee response',
    icon: Calendar,
  },
  {
    id: 'document_guidance',
    name: 'Document Guidance',
    description: 'Send email with required documents list and submission instructions',
    icon: FileText,
  },
  {
    id: 'track_documents',
    name: 'Track Document Submission',
    description: 'Track and update document submission status',
    icon: Upload,
  },
];

export const OnboardingAgentInterface = () => {
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [onboardingId, setOnboardingId] = useState('');
  
  // Step 1: Create onboarding & send mail
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  
  // Step 2 & 3: Orientation
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  
  // Step 4 & 5: Documents
  const [selectedDocument, setSelectedDocument] = useState('');
  const [documentStatus, setDocumentStatus] = useState('submitted');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [onboardingData, setOnboardingData] = useState<any>(null);

  const handleCreateOnboarding = async () => {
    setLoading(true);
    setResult(null);
    try {
      const employeeData = {
        name: employeeName,
        email: employeeEmail,
        department,
        position,
        start_date: new Date().toISOString(),
        generate_offer_letter: true,
      };

      const response = await onboardingService.createOnboarding(employeeId, employeeData);
      if (response.success) {
        setOnboardingId(response.data._id);
        setOnboardingData(response.data);
        setResult({ success: true, message: 'Onboarding plan created and welcome email sent!' });
      } else {
        setResult({ error: response.message || 'Failed to create onboarding' });
      }
    } catch (error: any) {
      console.error('Create onboarding error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to create onboarding';
      setResult({ error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOrientationEmail = async () => {
    if (!onboardingId) {
      setResult({ error: 'Please create onboarding plan first or enter onboarding ID' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const response = await onboardingService.sendOrientationEmail(onboardingId);
      setResult(response);
    } catch (error: any) {
      console.error('Send orientation email error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to send orientation email';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleOrientation = async () => {
    if (!onboardingId) {
      setResult({ error: 'Please create onboarding plan first or enter onboarding ID' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const response = await onboardingService.scheduleOrientation(
        onboardingId,
        preferredDate,
        preferredTime
      );
      setResult(response);
    } catch (error: any) {
      console.error('Schedule orientation error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to schedule orientation';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSendDocumentGuidance = async () => {
    if (!onboardingId) {
      setResult({ error: 'Please create onboarding plan first or enter onboarding ID' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const response = await onboardingService.sendDocumentGuidance(onboardingId);
      setResult(response);
      if (response.success && response.data) {
        setOnboardingData((prev: any) => ({
          ...prev,
          required_documents: response.data.required_documents,
          document_tracking: response.data.document_tracking || {}
        }));
      }
    } catch (error: any) {
      console.error('Send document guidance error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to send document guidance';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDocument = async () => {
    if (!onboardingId || !selectedDocument) {
      setResult({ error: 'Please select a document and ensure onboarding ID is set' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const response = await onboardingService.updateDocument(
        onboardingId,
        selectedDocument,
        documentStatus
      );
      setResult(response);
      if (response.success && response.data) {
        setOnboardingData((prev: any) => ({
          ...prev,
          document_tracking: response.data.document_tracking,
          document_completion_percentage: response.data.document_completion_percentage
        }));
      }
    } catch (error: any) {
      console.error('Update document error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to update document status';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-black-600 bg-clip-text text-black">
              Onboarding Automation Agent
            </h2>
            <p className="text-slate-600 mt-1">Manage employee onboarding workflows step by step</p>
          </div>
        </div>
      </motion.div>

      {/* Workflow Steps Overview */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Onboarding Workflow Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border-2 rounded-lg p-5 cursor-pointer transition-all duration-200 ease-out group ${
                    activeStep === step.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-md'
                  }`}
                  onClick={() => setActiveStep(activeStep === step.id ? null : step.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg shrink-0">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-semibold text-sm transition-colors duration-200 ${
                          activeStep === step.id ? 'text-slate-800' : 'text-slate-700 group-hover:text-slate-900'
                        }`}>
                          {step.name}
                        </h4>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {index + 1}
                        </Badge>
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors duration-200 ${
                        activeStep === step.id ? 'text-slate-600' : 'text-slate-500 group-hover:text-slate-700'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Send Onboarding Mail */}
      {activeStep === 'send_onboarding_mail' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Step 1: Send Onboarding Mail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Employee ID</label>
                  <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP001" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Employee Name</label>
                  <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="John Doe" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
                  <Input type="email" value={employeeEmail} onChange={(e) => setEmployeeEmail(e.target.value)} placeholder="john@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Department</label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Position</label>
                  <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Software Engineer" />
                </div>
              </div>
              <Button
                onClick={handleCreateOnboarding}
                disabled={loading || !employeeId || !employeeName || !employeeEmail}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Creating...' : 'Create Onboarding Plan & Send Welcome Email'}
              </Button>
              {result && onboardingId && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700">✅ Onboarding ID: <strong>{onboardingId}</strong></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Check Orientation Availability */}
      {activeStep === 'check_availability' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Step 2: Check Orientation Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Onboarding ID</label>
                <Input
                  value={onboardingId}
                  onChange={(e) => setOnboardingId(e.target.value)}
                  placeholder="Enter onboarding ID from Step 1"
                />
              </div>
              <Button
                onClick={handleSendOrientationEmail}
                disabled={loading || !onboardingId}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Sending...' : 'Send Availability Check Email'}
              </Button>
              {result && result.success && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700">✅ {result.data?.message || result.message}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Schedule Orientation */}
      {activeStep === 'schedule_orientation' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Step 3: Schedule Orientation Meeting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Onboarding ID</label>
                <Input value={onboardingId} onChange={(e) => setOnboardingId(e.target.value)} placeholder="Enter onboarding ID" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Preferred Date</label>
                  <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Preferred Time</label>
                  <Input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
                </div>
              </div>
              <Button
                onClick={handleScheduleOrientation}
                disabled={loading || !onboardingId || !preferredDate || !preferredTime}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Scheduling...' : 'Schedule Orientation Meeting'}
              </Button>
              {result && result.success && result.data?.meeting && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700 font-semibold mb-1">✅ Meeting Scheduled!</p>
                  <p className="text-xs text-green-600">Date: {result.data.meeting.InterviewDate}</p>
                  <p className="text-xs text-green-600">Time: {result.data.meeting.InterviewTime}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Document Guidance */}
      {activeStep === 'document_guidance' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Step 4: Send Document Guidance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Onboarding ID</label>
                <Input value={onboardingId} onChange={(e) => setOnboardingId(e.target.value)} placeholder="Enter onboarding ID" />
              </div>
              <Button
                onClick={handleSendDocumentGuidance}
                disabled={loading || !onboardingId}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Sending...' : 'Send Document Guidance Email'}
              </Button>
              {result && result.success && result.data?.required_documents && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700 font-semibold mb-2">✅ Document guidance sent!</p>
                  <p className="text-xs text-slate-600 mb-2">Required documents:</p>
                  <ul className="text-xs text-slate-700 list-disc list-inside space-y-1">
                    {result.data.required_documents.map((doc: string, idx: number) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Track Documents */}
      {activeStep === 'track_documents' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-500" />
              Step 5: Track Document Submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Onboarding ID</label>
                <Input value={onboardingId} onChange={(e) => setOnboardingId(e.target.value)} placeholder="Enter onboarding ID" />
              </div>
              {onboardingData?.required_documents && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Select Document</label>
                  <select
                    value={selectedDocument}
                    onChange={(e) => setSelectedDocument(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">Select a document...</option>
                    {onboardingData.required_documents.map((doc: string) => (
                      <option key={doc} value={doc}>{doc}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Document Status</label>
                <select
                  value={documentStatus}
                  onChange={(e) => setDocumentStatus(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <Button
                onClick={handleUpdateDocument}
                disabled={loading || !onboardingId || !selectedDocument}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Updating...' : 'Update Document Status'}
              </Button>
              {result && result.success && result.data && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700 font-semibold mb-2">✅ Document status updated!</p>
                  <p className="text-xs text-green-600">
                    Completion: {result.data.document_completion_percentage?.toFixed(1)}%
                  </p>
                </div>
              )}
              {onboardingData?.document_tracking && (
                <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-sm font-semibold mb-2">Document Tracking:</p>
                  <div className="space-y-2">
                    {Object.entries(onboardingData.document_tracking).map(([doc, info]: [string, any]) => (
                      <div key={doc} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">{doc}</span>
                        <Badge className={info.status === 'verified' ? 'bg-green-500' : info.status === 'submitted' ? 'bg-yellow-500' : 'bg-gray-500'}>
                          {info.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results/Errors */}
      {result && (result.error || (result.success === false && result.message)) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-red-50 border border-red-200"
        >
          <p className="text-red-700 text-sm font-semibold mb-1">Error:</p>
          <p className="text-red-600 text-sm">
            {result.error || result.message || 'An unknown error occurred'}
          </p>
          {result.error && result.error.includes('Network') && (
            <p className="text-red-500 text-xs mt-2">
              Please check if the backend server is running on {import.meta.env.VITE_API_URL || 'http://localhost:8000'}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};
