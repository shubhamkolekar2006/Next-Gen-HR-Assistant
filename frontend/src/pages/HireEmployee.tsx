import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { agentsService, employeeService, jobsService } from '@/services/api';

interface ScreeningResult {
  score: {
    overall_score: number;
    recommendation: string;
    strengths: string[];
    weaknesses: string[];
    missing_skills: string[];
    reason: string;
  };
  candidate_data: {
    name: string;
    email: string;
    skills: string[];
    experience_years: number;
  };
}

interface BulkScreeningRow {
  filename: string;
  overall_score: number | null;
  candidate_name: string | null;
  candidate_email: string | null;
  screening_id?: string | null;
  score?: { overall_score?: number; recommendation?: string } | null;
  error?: string;
}

export const HireEmployee = () => {
  const queryClient = useQueryClient();
  const [resumeText, setResumeText] = useState('');
  const [jobId, setJobId] = useState('');
  const [selectedRoleIndex, setSelectedRoleIndex] = useState('');
  const [jobInfo, setJobInfo] = useState<any | null>(null);
  const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(null);
  const [isScreening, setIsScreening] = useState(false);
  const [scheduleQuery, setScheduleQuery] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [meetingResult, setMeetingResult] = useState<any>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkScreeningRow[] | null>(null);
  const [isBulkScreening, setIsBulkScreening] = useState(false);

  // Fetch available jobs
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs-list'],
    queryFn: () => jobsService.listIds(),
  });

  const {
    data: rolesData,
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery({
    queryKey: ['employee-roles'],
    queryFn: () => employeeService.listRoles(),
  });

  const jobs = jobsData?.data || [];
  const roleOptions: Array<{ role: string; department?: string; count?: number }> = rolesData?.data || [];
  const rolesErrorMessage =
    rolesError instanceof Error ? rolesError.message : rolesError ? 'Failed to load roles' : null;
  const selectedRole =
    selectedRoleIndex !== '' ? roleOptions[Number(selectedRoleIndex)] : undefined;

  useEffect(() => {
    const selected = jobs.find((j: any) => j.job_id === jobId);
    setJobInfo(selected || null);
    let cancelled = false;
    async function fetchDetails() {
      try {
        if (jobId) {
          const resp = await jobsService.getById(jobId);
          if (!cancelled && resp?.data) {
            setJobInfo({ ...(selected || {}), ...resp.data });
          }
        }
      } catch (_) {
        // ignore; fallback to list info
      }
    }
    if (jobId) fetchDetails();
    return () => { cancelled = true; };
  }, [jobId, jobs]);

  useEffect(() => {
    if (!roleOptions.length || selectedRoleIndex === '') {
      setJobId('');
      setJobInfo(null);
      return;
    }

    const role = roleOptions[Number(selectedRoleIndex)];
    if (!role) {
      setJobId('');
      setJobInfo(null);
      return;
    }

    const matchingJob = jobs.find((job: any) => {
      const normalized = (value: any) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
      const roleName = normalized(role.role);
      const candidates = [
        job.job_id,
        job.JobID,
        job.Position,
        job.position,
        job.role,
        job.JobTitle,
      ];
      return candidates.some((candidate) => normalized(candidate) === roleName);
    });

    if (matchingJob?.job_id) {
      setJobId(matchingJob.job_id);
      setJobInfo({
        Position: role.role,
        Department: role.department,
        Status: matchingJob.Status || matchingJob.status,
        RequiredSkills: matchingJob.RequiredSkills || matchingJob.requiredSkills || [],
      });
    } else {
      setJobId('');
      setJobInfo({
        Position: role.role,
        Department: role.department,
      });
    }
  }, [selectedRoleIndex, roleOptions, jobs]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read file content
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setResumeText(text);
    };
    reader.readAsText(file);
  };

  const handleScreenResume = async () => {
    if (!resumeText || (!jobId && !selectedRole)) {
      alert('Please upload a resume and select a job role');
      return;
    }

    setIsScreening(true);
    setScreeningResult(null); // Clear previous results
    try {
      const result = await agentsService.screenResume(
        resumeText,
        jobId || undefined,
        selectedRole?.department,
        selectedRole?.role
      );
      
      // Check for error in response
      if (result.data && result.data.error) {
        alert('Screening failed: ' + result.data.error);
        setIsScreening(false);
        return;
      }
      
      if (result.success && result.data) {
        // Ensure the data structure matches expected format
        if (result.data.score && result.data.candidate_data) {
          setScreeningResult(result.data);
        } else {
          console.error('Unexpected response structure:', result);
          alert('Screening completed but received unexpected data format. Check console for details.');
        }
      } else if (result.success === false) {
        // Backend returned an error
        alert('Screening failed: ' + (result.message || 'Unknown error'));
      } else {
        alert('Screening failed: ' + (result.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error screening resume:', error);
      alert('Error screening resume: ' + (error.response?.data?.detail || error.message || 'Unknown error'));
    } finally {
      setIsScreening(false);
    }
  };

  const handleBulkFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) {
      setBulkFiles([]);
      setBulkResults(null);
      return;
    }
    if (files.length > 50) {
      alert('You can upload a maximum of 50 resumes at a time. Only the first 50 will be used.');
    }
    setBulkFiles(files.slice(0, 50));
    setBulkResults(null);
  };

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });

  const handleBulkScreenResumes = async () => {
    if (bulkFiles.length < 2) {
      alert('Bulk screening requires 2 to 50 resumes. Please select at least 2 files.');
      return;
    }
    try {
      setIsBulkScreening(true);
      setBulkResults(null);
      const payloadResumes = await Promise.all(
        bulkFiles.map(async (file) => ({
          filename: file.name,
          resume_text: await readFileAsText(file),
        })),
      );
      const result = await agentsService.screenResumesBatch(
        payloadResumes,
        jobId || undefined,
        selectedRole?.department,
        selectedRole?.role,
      );
      if (!result?.success || !Array.isArray(result.data)) {
        alert(result?.message || 'Bulk screening failed.');
        return;
      }
      setBulkResults(result.data as BulkScreeningRow[]);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } }; message?: string };
      alert(err?.response?.data?.detail || err?.message || 'Error during bulk screening');
    } finally {
      setIsBulkScreening(false);
    }
  };

  const handleDownloadBulkSheet = () => {
    if (!bulkResults || bulkResults.length === 0) return;
    const header = ['Rank', 'Filename', 'Candidate Name', 'Email', 'Score', 'Recommendation'];
    const rows = bulkResults.map((row, index) => {
      const score = row.overall_score ?? row.score?.overall_score ?? '';
      const recommendation = row.score?.recommendation ?? '';
      return [
        String(index + 1),
        row.filename ?? '',
        row.candidate_name ?? '',
        row.candidate_email ?? '',
        score === null ? '' : String(score),
        recommendation,
      ];
    });
    const escapeCsv = (value: string) => {
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const csvContent = [header, ...rows]
      .map((cols) => cols.map((col) => escapeCsv(String(col ?? ''))).join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk_resume_scores_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleScheduleMeeting = async () => {
    if (!scheduleQuery) {
      alert('Please enter meeting details');
      return;
    }

    setIsScheduling(true);
    try {
      // Extract email from screening result if available
      const participants = screeningResult?.candidate_data?.email 
        ? [screeningResult.candidate_data.email, 'hr@company.com']
        : ['hr@company.com'];

      const result = await agentsService.scheduleMeeting(scheduleQuery, participants);
      if (result.success && result.data) {
        setMeetingResult(result.data.meeting);
        setScheduleQuery(''); // Clear input
      } else {
        alert('Scheduling failed: ' + (result.message || 'Unknown error'));
      }
    } catch (error: any) {
      alert('Error scheduling meeting: ' + (error.message || 'Unknown error'));
    } finally {
      setIsScheduling(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-100';
    if (score >= 60) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  };

  const getRecommendationColor = (rec: string) => {
    if (rec.toLowerCase() === 'hire') return 'bg-green-500 text-white';
    if (rec.toLowerCase() === 'maybe') return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
  };

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Hire New Employee</h1>
        <p className="text-gray-600">Upload resume and screen candidates</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Resume Upload & Screening */}
        <div className="space-y-6">
          {/* Step 1: Upload Resume */}
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <FileText className="w-5 h-5" />
                Upload Resume
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Job Role
                  </label>
                  {rolesLoading ? (
                    <div className="text-sm text-gray-500 mb-4">Loading job roles...</div>
                  ) : rolesErrorMessage ? (
                    <div className="text-sm text-red-600 mb-4">{rolesErrorMessage}</div>
                  ) : roleOptions && roleOptions.length > 0 ? (
                    <>
                      <select
                        value={selectedRoleIndex}
                        onChange={(e) => setSelectedRoleIndex(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      >
                        <option value="">-- Select a Job Role --</option>
                        {roleOptions.map((role, idx) => (
                          <option key={`${role.role}-${role.department}-${idx}`} value={idx}>
                            {role.role}
                            {role.department && role.department !== 'N/A' ? ` (${role.department})` : ''}
                            {typeof role.count === 'number' && role.count > 1 ? ` • ${role.count}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedRole && (
                        <div className="text-sm text-gray-600 mb-3 bg-gray-50 p-3 rounded border border-gray-200">
                          <div><span className="font-medium">Role:</span> {selectedRole.role}</div>
                          <div><span className="font-medium">Department:</span> {selectedRole.department || 'N/A'}</div>
                          {typeof selectedRole.count === 'number' && (
                            <div><span className="font-medium">Employees in role:</span> {selectedRole.count}</div>
                          )}
                        </div>
                      )}
                    </>
                  ) : jobsLoading ? (
                    <div className="text-sm text-gray-500 mb-4">Loading jobs...</div>
                  ) : jobs && jobs.length > 0 ? (
                    <>
                      <select
                        value={jobId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setJobId(value);
                          if (value) {
                            const idx = roleOptions.findIndex((role) => role.role === value);
                            if (idx >= 0) setSelectedRoleIndex(String(idx));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      >
                        <option value="">-- Select a Job Role --</option>
                        {jobs.map((job: any) => (
                          <option key={job.job_id} value={job.job_id}>
                            {job.position || job.JobTitle || job.role || 'Unknown Role'}
                            {job.department ? ` (${job.department})` : ''}
                          </option>
                        ))}
                      </select>
                      {jobInfo && (
                        <div className="text-sm text-gray-600 mb-3 bg-gray-50 p-3 rounded border border-gray-200">
                          <div><span className="font-medium">Position:</span> {jobInfo.Position || jobInfo.position}</div>
                          <div><span className="font-medium">Department:</span> {jobInfo.Department || jobInfo.department}</div>
                          {Array.isArray(jobInfo.RequiredSkills) && jobInfo.RequiredSkills.length > 0 && (
                            <div className="mt-1"><span className="font-medium">Required Skills:</span> {jobInfo.RequiredSkills.slice(0,5).join(', ')}{jobInfo.RequiredSkills.length>5?'…':''}</div>
                          )}
                          {jobInfo.Status && (
                            <div><span className="font-medium">Status:</span> {jobInfo.Status}</div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-yellow-700 mb-4 space-y-2 bg-yellow-50 p-3 rounded border border-yellow-200">
                      <div>No jobs found in database. Please add jobs first.</div>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await jobsService.seedBasic();
                            await queryClient.invalidateQueries({ queryKey: ['jobs-list'] });
                          } catch (e) {
                            alert('Failed to seed sample jobs. Check server logs.');
                          }
                        }}
                        className="mt-2"
                      >
                        Seed sample jobs
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resume Upload
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                    <input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx"
                      onChange={handleResumeUpload}
                      className="hidden"
                      id="resume-upload"
                    />
                    <label
                      htmlFor="resume-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-700">
                        Click to upload resume
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        TXT, PDF, DOC, DOCX (Max 5MB)
                      </p>
                    </label>
                  </div>
                </div>

                {resumeText && (
                  <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto border border-gray-200">
                    <p className="text-xs font-medium mb-2 text-gray-700">Resume Preview:</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {resumeText.substring(0, 500)}...
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleScreenResume();
                  }}
                  disabled={!resumeText || (!jobId && !selectedRole) || isScreening}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isScreening ? (
                    <>Screening...</>
                  ) : (
                    <>Screen Resume</>
                  )}
                </Button>
              </CardContent>
            </Card>

          {/* Bulk Resume Screening */}
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <FileText className="w-5 h-5" />
                Bulk Resume Screening (2–50 files)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Multiple Resumes
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                  <input
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    multiple
                    onChange={handleBulkFilesChange}
                    className="hidden"
                    id="bulk-resume-upload"
                  />
                  <label
                    htmlFor="bulk-resume-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-700">
                      Click to upload 2 to 50 resumes
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      TXT, PDF, DOC, DOCX (text content used for scoring)
                    </p>
                  </label>
                  {bulkFiles.length > 0 && (
                    <p className={`mt-3 text-xs ${bulkFiles.length >= 2 && bulkFiles.length <= 50 ? 'text-gray-600' : 'text-amber-600'}`}>
                      Selected {bulkFiles.length} file{bulkFiles.length === 1 ? '' : 's'}
                      {bulkFiles.length === 1 && ' — add at least one more for bulk screening (2–50).'}
                      {bulkFiles.length > 50 && ' — only the first 50 will be used.'}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={handleBulkScreenResumes}
                disabled={bulkFiles.length < 2 || bulkFiles.length > 50 || isBulkScreening}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isBulkScreening ? 'Screening all resumes…' : 'Run Bulk Screening'}
              </Button>

              {bulkResults && bulkResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm text-gray-700">
                      {bulkResults.length} resumes screened. Top 10 highlighted for consideration.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadBulkSheet}
                      className="border-gray-300 text-gray-700"
                    >
                      Download CSV sheet
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-80 border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm text-left">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 border-b text-gray-800">Rank</th>
                          <th className="px-3 py-2 border-b text-gray-800">Filename</th>
                          <th className="px-3 py-2 border-b text-gray-800">Candidate Name</th>
                          <th className="px-3 py-2 border-b text-gray-800">Email</th>
                          <th className="px-3 py-2 border-b text-gray-800">Score</th>
                          <th className="px-3 py-2 border-b text-gray-800">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkResults.map((row, index) => {
                          const score = row.overall_score ?? row.score?.overall_score ?? null;
                          const recommendation = row.score?.recommendation ?? (row.error || '—');
                          const isTop10 = index < 10;
                          return (
                            <tr
                              key={row.screening_id || row.filename || index}
                              className={isTop10 ? 'bg-blue-50' : 'bg-white'}
                            >
                              <td className="px-3 py-2 border-b text-gray-700 font-medium">{index + 1}</td>
                              <td className="px-3 py-2 border-b text-gray-700">{row.filename}</td>
                              <td className="px-3 py-2 border-b text-gray-700">
                                {row.candidate_name ?? '—'}
                              </td>
                              <td className="px-3 py-2 border-b text-gray-700">
                                {row.candidate_email ?? '—'}
                              </td>
                              <td className="px-3 py-2 border-b text-gray-700">
                                {score !== null ? score : '—'}
                              </td>
                              <td className="px-3 py-2 border-b text-gray-700">
                                {recommendation}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Screening Results */}
          {screeningResult && (
            <div>
              <Card className="border border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <CheckCircle className="w-5 h-5" />
                    Screening Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Overall Score */}
                  <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${getScoreColor(screeningResult.score.overall_score)} mb-4`}>
                      <span className="text-2xl font-bold">
                        {screeningResult.score.overall_score}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Overall Score</p>
                    <Badge className={getRecommendationColor(screeningResult.score.recommendation)}>
                      {screeningResult.score.recommendation.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Candidate Info */}
                  {screeningResult.candidate_data && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-2">Candidate Information</h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700"><span className="font-medium">Name:</span> {screeningResult.candidate_data.name || 'N/A'}</p>
                        <p className="text-gray-700"><span className="font-medium">Email:</span> {screeningResult.candidate_data.email || 'N/A'}</p>
                        <p className="text-gray-700"><span className="font-medium">Experience:</span> {screeningResult.candidate_data.experience_years || 0} years</p>
                        {screeningResult.candidate_data.skills && (
                          <div>
                            <span className="font-medium">Skills:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {screeningResult.candidate_data.skills.slice(0, 5).map((skill, idx) => (
                                <Badge key={idx} className="bg-blue-100 text-blue-800">{skill}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Strengths */}
                  {screeningResult.score.strengths && screeningResult.score.strengths.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Strengths
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {screeningResult.score.strengths.map((strength, idx) => (
                          <li key={idx}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing Skills */}
                  {screeningResult.score.missing_skills && screeningResult.score.missing_skills.length > 0 && (
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Missing Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {screeningResult.score.missing_skills.map((skill, idx) => (
                          <Badge key={idx} className="bg-yellow-100 text-yellow-800">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Evaluation Reason</h4>
                    <p className="text-sm text-gray-700">{screeningResult.score.reason || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Column: Schedule Meeting */}
        <div className="space-y-6">
          <div>
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Calendar className="w-5 h-5" />
                  Schedule Interview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Details
                  </label>
                  <Input
                    placeholder="e.g., Schedule interview tomorrow at 2 PM"
                    value={scheduleQuery}
                    onChange={(e) => setScheduleQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleScheduleMeeting()}
                    className="border-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    You can use natural language: "Schedule interview tomorrow at 2 PM"
                  </p>
                </div>

                {screeningResult?.candidate_data?.email && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800 border border-blue-200">
                    Candidate email will be automatically added: {screeningResult.candidate_data.email}
                  </div>
                )}

                <Button
                  onClick={handleScheduleMeeting}
                  disabled={!scheduleQuery || isScheduling}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isScheduling ? (
                    <>Scheduling...</>
                  ) : (
                    <>Schedule Meeting</>
                  )}
                </Button>

                {/* Meeting Result */}
                {meetingResult && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Meeting Scheduled Successfully!
                    </h4>
                    <div className="space-y-1 text-sm text-gray-700">
                      <p><span className="font-medium">Date:</span> {meetingResult.InterviewDate}</p>
                      <p><span className="font-medium">Time:</span> {meetingResult.InterviewTime}</p>
                      <p><span className="font-medium">Duration:</span> {meetingResult.Duration} minutes</p>
                      <p className="text-xs text-gray-600 mt-2">
                        All participants have been notified via email.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setScheduleQuery('Schedule interview tomorrow at 10 AM');
                  }}
                >
                  Tomorrow 10 AM
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setScheduleQuery('Schedule interview next week Monday at 2 PM');
                  }}
                >
                  Next Monday 2 PM
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setScheduleQuery('Schedule interview for this Friday at 3 PM');
                  }}
                >
                  This Friday 3 PM
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

