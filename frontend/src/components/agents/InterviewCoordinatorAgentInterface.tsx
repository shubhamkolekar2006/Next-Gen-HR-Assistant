import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Mail, MessageSquare, Calendar, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { interviewCoordinatorService } from '@/services/api';

const WORKFLOW_STEPS = [
  {
    id: 'create_workflow',
    name: 'Create Interview Workflow',
    description: 'Set up multi-round interview process',
    api: '',
    icon: Plus,
  },
  {
    id: 'send_reminder',
    name: 'Send Reminders',
    description: 'Automatically send interview reminders 24 hours before',
    api: '',
    icon: Mail,
  },
  {
    id: 'collect_feedback',
    name: 'Collect Feedback',
    description: 'Gather and analyze interview feedback',
    api: '',
    icon: MessageSquare,
  },
  {
    id: 'schedule_next',
    name: 'Schedule Next Round',
    description: 'Automatically schedule next round based on feedback',
    api: '',
    icon: Calendar,
  },
];

export const InterviewCoordinatorAgentInterface = () => {
  const [activeStep, setActiveStep] = useState<string | null>(null);
  
  // Step 1: Create Workflow
  const [candidateId, setCandidateId] = useState('');
  const [jobId, setJobId] = useState('');
  const [roundsInput, setRoundsInput] = useState('');
  
  // Step 2: Send Reminder
  const [interviewId, setInterviewId] = useState('');
  const [hoursBefore, setHoursBefore] = useState('24');
  
  // Step 3: Collect Feedback
  const [feedbackInterviewId, setFeedbackInterviewId] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [feedback, setFeedback] = useState('');
  
  // Step 4: Schedule Next Round
  const [workflowId, setWorkflowId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showInterviewList, setShowInterviewList] = useState(false);
  const [interviewsData, setInterviewsData] = useState<any>(null);
  const [loadingInterviews, setLoadingInterviews] = useState(false);

  const fetchInterviews = async () => {
    if (showInterviewList && interviewsData) return; // Already loaded
    
    setLoadingInterviews(true);
    try {
      const data = await interviewCoordinatorService.listInterviews();
      setInterviewsData(data);
    } catch (error) {
      console.error('Failed to fetch interviews:', error);
      setInterviewsData({ success: false, data: [] });
    } finally {
      setLoadingInterviews(false);
    }
  };

  const toggleInterviewList = () => {
    const newState = !showInterviewList;
    setShowInterviewList(newState);
    if (newState) {
      fetchInterviews();
    }
  };

  const handleCreateWorkflow = async () => {
    setLoading(true);
    setResult(null);
    try {
      const rounds = roundsInput
        ? roundsInput.split(',').map(r => r.trim()).filter(r => r)
        : undefined;
      
      const response = await interviewCoordinatorService.createWorkflow(
        candidateId,
        jobId,
        rounds
      );
      setResult(response);
    } catch (error: any) {
      console.error('Create workflow error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to create workflow';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async () => {
    if (!interviewId) {
      setResult({ error: 'Please enter interview ID' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const response = await interviewCoordinatorService.sendReminder(
        interviewId,
        parseInt(hoursBefore) || 24
      );
      setResult(response);
    } catch (error: any) {
      console.error('Send reminder error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to send reminder';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleCollectFeedback = async () => {
    if (!feedbackInterviewId || !interviewer || !feedback) {
      setResult({ error: 'Please fill all fields' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const response = await interviewCoordinatorService.collectFeedback(
        feedbackInterviewId,
        interviewer,
        feedback
      );
      setResult(response);
    } catch (error: any) {
      console.error('Collect feedback error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to collect feedback';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleNext = async () => {
    if (!workflowId) {
      setResult({ error: 'Please enter workflow ID' });
      return;
    }
    
    setLoading(true);
    setResult(null);
    try {
      const response = await interviewCoordinatorService.scheduleNextRound(workflowId);
      setResult(response);
    } catch (error: any) {
      console.error('Schedule next round error:', error);
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Failed to schedule next round';
      setResult({ success: false, message: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-lg">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Interview Coordinator Agent
            </h2>
            <p className="text-slate-600 mt-1">Coordinates multi-round interviews, sends reminders, collects feedback</p>
          </div>
        </div>
      </motion.div>

      {/* Workflow Steps Overview */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Workflow Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {step.api ? (
                        <div className="mt-2 bg-slate-100 rounded px-2 py-1 text-xs font-mono text-slate-700">
                          {step.api}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Create Workflow */}
      {activeStep === 'create_workflow' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" />
              Step 1: Create Interview Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Candidate ID or Email
                </label>
                <Input
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  placeholder="candidate@example.com or candidate_id"
                />
                <p className="text-xs text-slate-500 mt-1">
                  You can use an email address - a candidate record will be created automatically if not found
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Job ID
                </label>
                <Input
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  placeholder="JOB123"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Interview Rounds (comma-separated, optional)
                </label>
                <Input
                  value={roundsInput}
                  onChange={(e) => setRoundsInput(e.target.value)}
                  placeholder="Phone Screen, Technical Interview, Final Round"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty for default: Phone Screen, Technical Interview, Final Round
                </p>
              </div>
              <Button
                onClick={handleCreateWorkflow}
                disabled={loading || !candidateId || !jobId}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Creating...' : 'Create Interview Workflow'}
              </Button>
              {result && result.success && result.data && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700 font-semibold mb-2">✅ Workflow created!</p>
                  <p className="text-xs text-green-600">Workflow ID: <strong>{result.data._id}</strong></p>
                  <p className="text-xs text-green-600">Total Rounds: {result.data.total_rounds}</p>
                  <p className="text-xs text-green-600">Status: {result.data.status}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Send Reminder */}
      {activeStep === 'send_reminder' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Step 2: Send Interview Reminder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    Interview ID
                  </label>
                  <button
                    type="button"
                    onClick={toggleInterviewList}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    {showInterviewList ? 'Hide' : 'Show'} Available Interviews
                  </button>
                </div>
                <Input
                  value={interviewId}
                  onChange={(e) => setInterviewId(e.target.value)}
                  placeholder="Enter interview ID from database"
                />
                {showInterviewList && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-40 overflow-y-auto">
                    {loadingInterviews ? (
                      <p className="text-xs text-slate-500">Loading interviews...</p>
                    ) : interviewsData?.success && interviewsData.data?.length > 0 ? (
                      <>
                        <p className="text-xs font-semibold text-slate-700 mb-2">Available Interviews:</p>
                        <div className="space-y-1">
                          {interviewsData.data.map((interview: any) => (
                            <div
                              key={interview._id}
                              className="text-xs p-2 bg-white rounded border border-slate-200 hover:bg-blue-50 cursor-pointer"
                              onClick={() => {
                                setInterviewId(interview._id);
                                setShowInterviewList(false);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-slate-600">{interview._id.substring(0, 8)}...</span>
                                <Badge className="text-xs">{interview.Status}</Badge>
                              </div>
                              <p className="text-slate-500 mt-1">{interview.Subject}</p>
                              <p className="text-slate-400 text-xs">{interview.InterviewDate} at {interview.InterviewTime}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">No interviews found in database</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Hours Before Interview (default: 24)
                </label>
                <Input
                  type="number"
                  value={hoursBefore}
                  onChange={(e) => setHoursBefore(e.target.value)}
                  placeholder="24"
                />
              </div>
              <Button
                onClick={handleSendReminder}
                disabled={loading || !interviewId}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Sending...' : 'Send Reminder Email'}
              </Button>
              {result && result.success && (
                <div className="p-4 rounded-lg bg-blue-50 border border-green-200">
                  <p className="text-sm text-green-700">✅ {result.data?.message || 'Reminder sent successfully!'}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Collect Feedback */}
      {activeStep === 'collect_feedback' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Step 3: Collect Interview Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    Interview ID
                  </label>
                  <button
                    type="button"
                    onClick={toggleInterviewList}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    {showInterviewList ? 'Hide' : 'Show'} Available Interviews
                  </button>
                </div>
                <Input
                  value={feedbackInterviewId}
                  onChange={(e) => setFeedbackInterviewId(e.target.value)}
                  placeholder="Enter interview ID from database"
                />
                {showInterviewList && interviewsData?.success && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-40 overflow-y-auto">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Available Interviews:</p>
                    <div className="space-y-1">
                      {interviewsData.data?.map((interview: any) => (
                        <div
                          key={interview._id}
                          className="text-xs p-2 bg-white rounded border border-slate-200 hover:bg-blue-50 cursor-pointer"
                          onClick={() => {
                            setFeedbackInterviewId(interview._id);
                            setShowInterviewList(false);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-slate-600">{interview._id.substring(0, 8)}...</span>
                            <Badge className="text-xs">{interview.Status}</Badge>
                          </div>
                          <p className="text-slate-500 mt-1">{interview.Subject}</p>
                          <p className="text-slate-400 text-xs">{interview.InterviewDate} at {interview.InterviewTime}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Interviewer Name
                </label>
                <Input
                  value={interviewer}
                  onChange={(e) => setInterviewer(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Feedback
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Enter interview feedback..."
                  className="w-full min-h-[150px] p-3 border border-slate-300 rounded-lg resize-none text-black"
                />
              </div>
              <Button
                onClick={handleCollectFeedback}
                disabled={loading || !feedbackInterviewId || !interviewer || !feedback}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Processing...' : 'Submit Feedback'}
              </Button>
              {result && result.success && result.data?.analysis && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700 font-semibold mb-2">✅ Feedback analyzed!</p>
                  <div className="space-y-1 text-xs">
                    <p><strong>Rating:</strong> {result.data.analysis.overall_rating}/5</p>
                    <p><strong>Recommendation:</strong> {result.data.analysis.recommendation?.toUpperCase()}</p>
                    {result.data.analysis.strengths && result.data.analysis.strengths.length > 0 && (
                      <p><strong>Strengths:</strong> {result.data.analysis.strengths.join(', ')}</p>
                    )}
                    {result.data.analysis.summary && (
                      <p><strong>Summary:</strong> {result.data.analysis.summary}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Schedule Next Round */}
      {activeStep === 'schedule_next' && (
        <Card className="border-0 shadow-md border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Step 4: Schedule Next Round
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Workflow ID
                </label>
                <Input
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  placeholder="Enter workflow ID"
                />
              </div>
              <Button
                onClick={handleScheduleNext}
                disabled={loading || !workflowId}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Scheduling...' : 'Schedule Next Round'}
              </Button>
              {result && result.success && result.data?.meeting && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700 font-semibold mb-2">✅ Next round scheduled!</p>
                  <div className="space-y-1 text-xs text-green-600">
                    <p><strong>Date:</strong> {result.data.meeting.InterviewDate}</p>
                    <p><strong>Time:</strong> {result.data.meeting.InterviewTime}</p>
                    <p><strong>Subject:</strong> {result.data.meeting.Subject}</p>
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
        </motion.div>
      )}

      {/* Features Info */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
              <Mail className="w-6 h-6 text-blue-600 mb-2" />
              <h4 className="font-semibold text-slate-800 mb-1">Email Integration</h4>
              <p className="text-sm text-slate-600 leading-relaxed">Automated reminder emails and notifications</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
              <MessageSquare className="w-6 h-6 text-blue-600 mb-2" />
              <h4 className="font-semibold text-slate-800 mb-1">Feedback Collection</h4>
              <p className="text-sm text-slate-600 leading-relaxed">AI-powered feedback analysis and recommendations</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
              <Calendar className="w-6 h-6 text-blue-600 mb-2" />
              <h4 className="font-semibold text-slate-800 mb-1">Auto-Scheduling</h4>
              <p className="text-sm text-slate-600 leading-relaxed">Automatic next round scheduling based on feedback</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
