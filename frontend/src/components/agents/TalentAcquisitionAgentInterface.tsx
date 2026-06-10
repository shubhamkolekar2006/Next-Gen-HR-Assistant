/**
 * Talent Acquisition Agent
 * Job requisition intake, candidate scoring, interview orchestration, offer draft.
 */
import { useState } from 'react';
import { Briefcase, FileText, Calendar, FileSignature } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResumeScreeningAgentInterface } from './ResumeScreeningAgentInterface';
import { InterviewCoordinatorAgentInterface } from './InterviewCoordinatorAgentInterface';
import { MeetingSchedulerAgentInterface } from './MeetingSchedulerAgentInterface';
import { DocumentGenerationAgentInterface } from './DocumentGenerationAgentInterface';
import { jobsService } from '@/services/api';

type TabId = 'job-intake' | 'candidate-scoring' | 'interview-orchestration' | 'offer-draft';

const TABS: { id: TabId; label: string; icon: typeof Briefcase }[] = [
  { id: 'job-intake', label: 'Job Requisition', icon: Briefcase },
  { id: 'candidate-scoring', label: 'Candidate Scoring', icon: FileText },
  { id: 'interview-orchestration', label: 'Interview Orchestration', icon: Calendar },
  { id: 'offer-draft', label: 'Offer Draft', icon: FileSignature },
];

export const TalentAcquisitionAgentInterface = () => {
  const [activeTab, setActiveTab] = useState<TabId>('job-intake');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-lg">
          <Briefcase className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Talent Acquisition Agent
          </h2>
          <p className="text-slate-600 mt-1">
            Job requisition intake, candidate scoring, interview orchestration, offer draft.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'job-intake' && <JobRequisitionIntake />}
      {activeTab === 'candidate-scoring' && <ResumeScreeningAgentInterface />}
      {activeTab === 'interview-orchestration' && (
        <div className="space-y-8">
          <InterviewCoordinatorAgentInterface />
          <MeetingSchedulerAgentInterface />
        </div>
      )}
      {activeTab === 'offer-draft' && <DocumentGenerationAgentInterface />}
    </div>
  );
};

function JobRequisitionIntake() {
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [experienceRequired, setExperienceRequired] = useState('');
  const [educationRequired, setEducationRequired] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCreate = async () => {
    if (!position || !department) return;
    setLoading(true);
    setResult(null);
    try {
      const skills = requiredSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await jobsService.create({
        Position: position,
        Department: department,
        RequiredSkills: skills.length ? skills : undefined,
        ExperienceRequired: experienceRequired ? parseInt(experienceRequired, 10) : undefined,
        EducationRequired: educationRequired || undefined,
        Status: 'Open',
      });
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err?.response?.data?.detail || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="w-5 h-5" />
          Job Requisition Intake
        </CardTitle>
        <p className="text-sm text-gray-600">
          Create a new job requisition to begin the hiring process.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position *</label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g. Senior Software Engineer"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Engineering"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Required Skills (comma-separated)</label>
          <input
            type="text"
            value={requiredSkills}
            onChange={(e) => setRequiredSkills(e.target.value)}
            placeholder="e.g. Python, AWS, React"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
            <input
              type="number"
              value={experienceRequired}
              onChange={(e) => setExperienceRequired(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Education Required</label>
            <input
              type="text"
              value={educationRequired}
              onChange={(e) => setEducationRequired(e.target.value)}
              placeholder="e.g. Bachelor's in CS"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <Button onClick={handleCreate} disabled={loading || !position || !department}>
          {loading ? 'Creating…' : 'Create Job Requisition'}
        </Button>
        {result && (
          <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {result.success ? (
              <p>Job requisition created successfully. Use the Candidate Scoring tab to screen applicants.</p>
            ) : (
              <p>{result.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
