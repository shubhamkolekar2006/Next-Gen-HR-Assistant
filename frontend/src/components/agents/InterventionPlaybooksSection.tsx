/**
 * Intervention Playbooks - High-risk employees, suggested actions, apply interventions
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, AlertTriangle, Loader2, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { interventionsService } from '@/services/api';

const RISK_LEVELS = ['High', 'Medium', 'Low'] as const;

export const InterventionPlaybooksSection = () => {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: playbooksData } = useQuery({
    queryKey: ['intervention-playbooks'],
    queryFn: () => interventionsService.getPlaybooks(),
  });

  const { data: highRiskData, isLoading: highRiskLoading } = useQuery({
    queryKey: ['intervention-high-risk'],
    queryFn: () => interventionsService.getHighRisk(),
  });

  const applyMutation = useMutation({
    mutationFn: (payload: { employee_id: string; intervention_type: string; notes?: string }) =>
      interventionsService.apply(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intervention-high-risk'] });
      setSelectedEmployee(null);
      setSelectedPlaybook(null);
      setNotes('');
    },
  });

  const playbooks = playbooksData?.data ?? {};
  const highRisk = highRiskData?.data ?? [];

  const handleApply = () => {
    if (!selectedEmployee || !selectedPlaybook) return;
    applyMutation.mutate({
      employee_id: selectedEmployee,
      intervention_type: selectedPlaybook,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* High-risk employees */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            High-Risk Employees
          </CardTitle>
          <p className="text-sm text-gray-600">
            Employees with attrition risk &gt;= 50%. Run attrition prediction via chatbot first to populate.
          </p>
        </CardHeader>
        <CardContent>
          {highRiskLoading ? (
            <p className="text-gray-500">Loading…</p>
          ) : highRisk.length === 0 ? (
            <p className="text-gray-500">
              No high-risk employees. Ask the AI chatbot &quot;show top 5 high risk employees&quot; to run attrition prediction.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {highRisk.map((emp: any) => (
                <div
                  key={emp.employee_id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedEmployee === emp.employee_id
                      ? 'bg-violet-50 border-violet-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedEmployee(emp.employee_id)}
                >
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.employee_id}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      emp.risk_level === 'High'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : emp.risk_level === 'Medium'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-green-100 text-green-800 border-green-200'
                    }
                  >
                    {emp.risk_score}% • {emp.risk_level}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Playbooks by risk level */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Suggested Intervention Playbooks
          </CardTitle>
          <p className="text-sm text-gray-600">
            Select an employee above, then choose and apply a playbook.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {RISK_LEVELS.map((level) => {
            const items = (playbooks[level] ?? []) as Array<{ id: string; title: string; description: string }>;
            if (items.length === 0) return null;
            return (
              <div key={level}>
                <p className="text-sm font-semibold text-gray-700 mb-2">{level} Risk</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPlaybook === p.id
                          ? 'bg-violet-50 border-violet-300'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedPlaybook(p.id)}
                    >
                      <p className="font-medium text-sm">{p.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{p.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this intervention…"
              className="max-w-md"
            />
          </div>
          <Button
            onClick={handleApply}
            disabled={!selectedEmployee || !selectedPlaybook || applyMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {applyMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            Apply Intervention
          </Button>
          {applyMutation.isSuccess && (
            <p className="text-sm text-green-600">Intervention recorded successfully.</p>
          )}
          {applyMutation.isError && (
            <p className="text-sm text-red-600">{String(applyMutation.error)}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
