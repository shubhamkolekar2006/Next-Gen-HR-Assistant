/**
 * Policy Workflows - Create campaigns, track acknowledgments
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { policyWorkflowsService, employeeService } from '@/services/api';

const SAMPLE_POLICIES = [
  'Code of Conduct Policy',
  'Anti-Harassment and Anti-Discrimination Policy',
  'Data Protection and Privacy Policy',
  'Leave Policy (Casual, Sick, Earned)',
  'Work-from-Home / Remote Work Policy',
  'Probation and Confirmation Policy',
];

export const PolicyWorkflowsSection = () => {
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedPolicies, setSelectedPolicies] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['policy-campaigns'],
    queryFn: () => policyWorkflowsService.listCampaigns(),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-list-policy'],
    queryFn: () => employeeService.getAll({ page: 1, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; policies: string[]; employee_ids?: string[]; due_date?: string }) =>
      policyWorkflowsService.createCampaign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-campaigns'] });
      setName('');
      setDueDate('');
      setSelectedPolicies([]);
      setSelectedEmployees([]);
    },
  });

  const togglePolicy = (p: string) => {
    setSelectedPolicies((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const employees = employeesData?.data ?? [];
  const campaigns = campaignsData?.data ?? [];

  const handleCreate = () => {
    if (!name.trim() || selectedPolicies.length === 0) return;
    createMutation.mutate({
      name: name.trim(),
      policies: selectedPolicies,
      employee_ids: selectedEmployees.length > 0 ? selectedEmployees : undefined,
      due_date: dueDate || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Create campaign */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Policy Acknowledgment Campaign
          </CardTitle>
          <p className="text-sm text-gray-600">
            Select policies and optionally target employees. Track completion in campaigns below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q1 2025 Policy Acknowledgment"
              className="max-w-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Policies</label>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_POLICIES.map((p) => (
                <Button
                  key={p}
                  variant={selectedPolicies.includes(p) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => togglePolicy(p)}
                  className={selectedPolicies.includes(p) ? 'bg-emerald-600' : ''}
                >
                  {selectedPolicies.includes(p) && <CheckCircle className="w-4 h-4 mr-1" />}
                  {p.length > 30 ? p.slice(0, 28) + '…' : p}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Employees (optional – leave empty for all)
            </label>
            <select
              multiple
              value={selectedEmployees}
              onChange={(e) =>
                setSelectedEmployees(
                  Array.from(e.target.selectedOptions, (o) => o.value)
                )
              }
              className="w-full max-w-md h-24 border border-gray-300 rounded-md p-2 text-sm"
            >
              {employees.slice(0, 50).map((emp: any) => (
                <option key={emp.Employee_ID || emp._id} value={emp.Employee_ID || emp.EmployeeID || emp._id}>
                  {emp.Name} ({emp.Department})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !name.trim() || selectedPolicies.length === 0}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create Campaign
          </Button>
          {createMutation.isSuccess && (
            <p className="text-sm text-green-600">Campaign created successfully.</p>
          )}
          {createMutation.isError && (
            <p className="text-sm text-red-600">{String(createMutation.error)}</p>
          )}
        </CardContent>
      </Card>

      {/* Campaigns list */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Active Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <p className="text-gray-500">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-gray-500">No campaigns yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c: any) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-gray-600">
                      {c.policies?.length ?? 0} policies • Due: {c.due_date || 'Not set'}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    {c.status || 'active'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
