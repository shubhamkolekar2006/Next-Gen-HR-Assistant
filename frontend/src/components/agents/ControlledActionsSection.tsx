/**
 * Controlled Actions - Request, approve, reject HR operations
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, CheckCircle, XCircle, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { actionRequestsService } from '@/services/api';

const ACTION_TYPES = [
  { id: 'salary_change', label: 'Salary Change', description: 'Request salary adjustment' },
  { id: 'role_update', label: 'Role Update', description: 'Change position or department' },
  { id: 'termination', label: 'Termination', description: 'Request employee termination' },
];

export const ControlledActionsSection = () => {
  const [actionType, setActionType] = useState('salary_change');
  const [employeeId, setEmployeeId] = useState('');
  const [payload, setPayload] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['action-requests-pending'],
    queryFn: () => actionRequestsService.listPending(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { action_type: string; employee_id: string; payload?: Record<string, unknown> }) =>
      actionRequestsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-requests-pending'] });
      setEmployeeId('');
      setPayload({});
    },
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => actionRequestsService.approve(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action-requests-pending'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => actionRequestsService.reject(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['action-requests-pending'] }),
  });

  const pending = pendingData?.data ?? [];

  const handleCreate = () => {
    if (!employeeId.trim()) return;
    const pl: Record<string, unknown> = { ...payload };
    createMutation.mutate({
      action_type: actionType,
      employee_id: employeeId.trim(),
      payload: Object.keys(pl).length ? pl : undefined,
    });
  };

  const payloadFields = actionType === 'salary_change'
    ? { new_salary: 'New Salary (e.g. 75000)', reason: 'Reason' }
    : actionType === 'role_update'
      ? { new_role: 'New Role/Position', new_department: 'New Department' }
      : { reason: 'Reason for termination', notice_period: 'Notice Period (days)' };

  return (
    <div className="space-y-6">
      {/* Create request */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Action Request
          </CardTitle>
          <p className="text-sm text-gray-600">
            Create a request that requires HR/manager approval. Each action is logged for compliance.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
            <select
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value);
                setPayload({});
              }}
              className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-slate-500"
            >
              {ACTION_TYPES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} – {a.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <Input
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. EMP-001 or Employee_ID"
              className="max-w-md"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Additional Details</label>
            {Object.entries(payloadFields).map(([key, label]) => (
              <Input
                key={key}
                value={payload[key] ?? ''}
                onChange={(e) => setPayload((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={label}
                className="max-w-md"
              />
            ))}
          </div>
          <Button
            onClick={handleCreate}
            disabled={!employeeId.trim() || createMutation.isPending}
            className="bg-slate-700 hover:bg-slate-800"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Request
          </Button>
          {createMutation.isSuccess && (
            <p className="text-sm text-green-600">Request created. Awaiting approval.</p>
          )}
          {createMutation.isError && (
            <p className="text-sm text-red-600">{String(createMutation.error)}</p>
          )}
        </CardContent>
      </Card>

      {/* Pending approvals */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Pending Approvals
          </CardTitle>
          <p className="text-sm text-gray-600">
            Review and approve or reject action requests.
          </p>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <p className="text-gray-500">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-gray-500">No pending approvals.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((req: any) => (
                <div
                  key={req._id}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {req.action_type?.replace('_', ' ')} – {req.employee_id}
                      </p>
                      <p className="text-sm text-gray-600">
                        Requested by {req.requested_by} • {req.created_at?.slice(0, 10)}
                      </p>
                      {req.payload && Object.keys(req.payload).length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {JSON.stringify(req.payload)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate({ id: req._id })}
                      disabled={rejectMutation.isPending}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(req._id)}
                      disabled={approveMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
