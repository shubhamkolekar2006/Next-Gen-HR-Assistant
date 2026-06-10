import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Mail, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { agentsService } from '@/services/api';

const WORKFLOW_STEPS = [
  {
    id: 'parse_request',
    name: 'Parse Request',
    description: 'Extract meeting details from natural language',
    api: '',
  },
  {
    id: 'find_slots',
    name: 'Find Available Slots',
    description: 'Check calendar and find available time slots',
    api: '',
  },
  {
    id: 'schedule',
    name: 'Schedule Meeting',
    description: 'Create meeting record and send calendar invites',
    api: '',
  },
];

export const MeetingSchedulerAgentInterface = () => {
  const [query, setQuery] = useState('');
  const [participants, setParticipants] = useState('');
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleScheduleMeeting = async () => {
    setLoading(true);
    try {
      const participantList = participants
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);
      
      const response = await agentsService.scheduleMeeting(
        query || `Schedule meeting with ${participantList.join(', ')}`,
        participantList.length > 0 ? participantList : undefined,
        parseInt(duration) || 60
      );
      setResult(response);
    } catch (error: any) {
      setResult({ success: false, error: error.message || 'Failed to schedule meeting' });
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
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Meeting Scheduler Agent
            </h2>
            <p className="text-slate-600 mt-1">Automated interview scheduling with conflict resolution</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Workflow Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {WORKFLOW_STEPS.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border-2 border-slate-200 rounded-lg p-5 cursor-pointer transition-all duration-200 ease-out group bg-white hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-md"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-slate-700 group-hover:text-slate-900 transition-colors duration-200">
                      {step.name}
                    </h4>
                    <Badge variant="secondary" className="text-xs shrink-0">Step {index + 1}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 group-hover:text-slate-700 leading-relaxed transition-colors duration-200">
                    {step.description}
                  </p>
                  {step.api ? (
                    <div className="mt-2 bg-slate-100 rounded px-2 py-1 text-xs font-mono text-slate-700">
                      {step.api}
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-500" />
              Schedule Meeting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Natural Language Query (optional)
                </label>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Schedule interview with john@example.com tomorrow at 2 PM"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Participants (comma-separated emails)
                </label>
                <Input
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  placeholder="john@example.com, hr@company.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Duration (minutes)
                </label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="60"
                />
              </div>

              <Button
                onClick={handleScheduleMeeting}
                disabled={loading || (!query && !participants)}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
              >
                {loading ? 'Scheduling...' : 'Schedule Meeting'}
              </Button>

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200"
                >
                  {result.success && result.data?.meeting ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-700">Meeting Scheduled!</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <p><strong>Date:</strong> {result.data.meeting.InterviewDate}</p>
                        <p><strong>Time:</strong> {result.data.meeting.InterviewTime}</p>
                        <p><strong>Duration:</strong> {result.data.meeting.Duration} minutes</p>
                        <p><strong>Subject:</strong> {result.data.meeting.Subject}</p>
                        <p className="text-blue-600 mt-2">✓ Calendar invites sent to all participants</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-600">{result.error || result.message || 'Scheduling failed'}</p>
                  )}
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

