import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, CheckCircle, XCircle, AlertCircle, Upload } from 'lucide-react';
import { agentsService, employeeService } from '@/services/api';

const WORKFLOW_STEPS = [
  {
    id: 'parse_resume',
    name: 'Parse Resume',
    description: 'Extract structured information from resume text',
    api: '',
  },
  {
    id: 'score_candidate',
    name: 'Score Candidate',
    description: 'Score candidate against job requirements (0-100)',
    api: '',
  },
  {
    id: 'save_result',
    name: 'Save Result',
    description: 'Store screening result in database',
    api: '',
  },
  {
    id: 'notify',
    name: 'Notify & Auto-Advance',
    description: 'Auto-advance high scores or notify HR for review',
    api: '',
  },
];

export const ResumeScreeningAgentInterface = () => {
  const [resumeText, setResumeText] = useState('');
  const [roleOptions, setRoleOptions] = useState<Array<{ role: string; department?: string; count?: number }>>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchRoles() {
      setRolesLoading(true);
      setRolesError(null);
      try {
        const response = await employeeService.listRoles();
        if (isMounted) {
          setRoleOptions(response?.data ?? []);
        }
      } catch (error: any) {
        if (isMounted) {
          setRolesError(error?.message || 'Failed to load roles');
        }
      } finally {
        if (isMounted) {
          setRolesLoading(false);
        }
      }
    }

    fetchRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      // Check file type
      const fileType = file.type;
      const fileName = file.name.toLowerCase();

      // Handle text files
      if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        const text = await file.text();
        setResumeText(text);
      }
      // Handle PDF files - try to read as text (basic support)
      else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // For PDFs, we'll need to extract text. For now, show a message.
        // In a production app, you'd use a PDF parsing library like pdf-parse
        const reader = new FileReader();
        reader.onload = () => {
          // PDFs are binary, so we can't directly read them as text
          // This is a placeholder - in production, use a PDF library
          setResumeText('PDF file uploaded. Please extract text manually or use a PDF parser.');
        };
        reader.readAsArrayBuffer(file);
      }
      // Handle Word documents - try to read as text (basic support)
      else if (
        fileType === 'application/msword' ||
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.doc') ||
        fileName.endsWith('.docx')
      ) {
        // Word docs are binary, so we can't directly read them as text
        // This is a placeholder - in production, use a Word parsing library
        setResumeText('Word document uploaded. Please extract text manually or use a document parser.');
      }
      // Try to read as text for other file types
      else {
        try {
          const text = await file.text();
          setResumeText(text);
        } catch (error) {
          setResumeText('Unable to read file as text. Please paste the resume content manually.');
        }
      }
    } catch (error: any) {
      setResumeText('');
      setUploadedFileName('');
      alert('Error reading file: ' + (error.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleScreenResume = async () => {
    setLoading(true);
    try {
      const selectedRole = selectedRoleIndex ? roleOptions[Number(selectedRoleIndex)] : undefined;
      const response = await agentsService.screenResume(
        resumeText,
        undefined,
        selectedRole?.department,
        selectedRole?.role
      );
      setResult(response);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(', ')
            : error?.response?.data?.message;
      setResult({
        success: false,
        error: msg || error?.message || 'Failed to screen resume',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600 p-3 rounded-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-blue-600">
              Resume Screening Agent
            </h2>
            <p className="text-gray-600 mt-1">Automatically screen resumes and match to job requirements</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Search className="w-5 h-5 text-blue-600" />
              Workflow Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {WORKFLOW_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className="border border-gray-200 rounded-lg p-4 bg-white"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{step.name}</h4>
                    <Badge variant="secondary">Step {index + 1}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                  {step.api ? (
                    <div className="bg-gray-100 rounded px-2 py-1 text-xs font-mono text-gray-900">
                      {step.api}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle>Screen Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Upload Resume File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white">
                  <input
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="resume-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="resume-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-700 font-medium">
                      {isUploading ? 'Uploading...' : 'Click to upload resume'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      TXT, PDF, DOC, DOCX (Max 10MB)
                    </p>
                    {uploadedFileName && (
                      <p className="text-xs text-blue-600 mt-2 font-medium">
                        ✓ {uploadedFileName}
                      </p>
                    )}
                  </label>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Paste Resume Text
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste resume text here..."
                  className="w-full min-h-[200px] p-3 border border-slate-300 rounded-lg resize-none text-black"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Select Job Role (optional)
                </label>
                {rolesLoading ? (
                  <div className="text-sm text-gray-500">Loading roles...</div>
                ) : rolesError ? (
                  <div className="text-sm text-blue-600">{rolesError}</div>
                ) : roleOptions.length > 0 ? (
                  <select
                    value={selectedRoleIndex}
                    onChange={(e) => setSelectedRoleIndex(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-black bg-white"
                  >
                    <option value="">-- Select a Job Role --</option>
                    {roleOptions.map((option, idx) => (
                      <option key={`${option.role}-${option.department}-${idx}`} value={String(idx)}>
                        {option.role}
                        {option.department && option.department !== 'N/A' ? ` (${option.department})` : ''}
                        {typeof option.count === 'number' && option.count > 1 ? ` • ${option.count}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-blue-600">No roles available. Please add employees first.</div>
                )}
              </div>

              <Button
                onClick={handleScreenResume}
                disabled={loading || !resumeText}
                className="w-full bg-blue-600 text-white"
              >
                {loading ? 'Screening...' : 'Screen Resume'}
              </Button>

              {result && (
                <div className="p-4 rounded-lg bg-white border border-gray-200">
                  {result.success && result.data?.score ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {result.data.score.overall_score >= 80 ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : result.data.score.overall_score >= 60 ? (
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="font-semibold">
                          Score: {result.data.score.overall_score}/100
                        </span>
                        <Badge
                          className={
                            result.data.score.overall_score >= 80
                              ? 'bg-blue-600'
                              : result.data.score.overall_score >= 60
                              ? 'bg-blue-500'
                              : 'bg-blue-400'
                          }
                        >
                          {result.data.score.recommendation?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><strong>Skills Match:</strong> {result.data.score.skills_match}/100</p>
                        <p><strong>Experience Match:</strong> {result.data.score.experience_match}/100</p>
                        {result.data.score.missing_skills?.length > 0 && (
                          <p><strong>Missing Skills:</strong> {result.data.score.missing_skills.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-600">
                      {result.message ||
                        result.error ||
                        (typeof result.data?.error === 'string' ? result.data.error : null) ||
                        'Screening failed'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

