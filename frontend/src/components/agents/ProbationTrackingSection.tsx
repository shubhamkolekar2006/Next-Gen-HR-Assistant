/**
 * Probation Tracking - Employees in probation, confirm workflow
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, UserCheck, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { probationService } from '@/services/api';

export const ProbationTrackingSection = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['probation-list'],
    queryFn: () => probationService.list(),
  });

  const confirmMutation = useMutation({
    mutationFn: (employeeId: string) => probationService.confirm(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['probation-list'] });
    },
  });

  const employees = data?.data ?? [];

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Employees in Probation (90 days)
        </CardTitle>
        <p className="text-sm text-gray-600">
          Monitor probation periods. Confirm employees who have completed their probation successfully.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-gray-500">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="text-gray-500">
            No employees currently in probation. Ensure employees have <code className="bg-gray-100 px-1 rounded">DateOfJoining</code> set.
          </p>
        ) : (
          <div className="space-y-3">
            {employees.map((emp: any) => (
              <div
                key={emp.employee_id}
                className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100/80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{emp.name}</p>
                    <p className="text-sm text-gray-600">
                      {emp.department} • {emp.position}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Joined: {emp.join_date}
                      </span>
                      <span>Probation ends: {emp.probation_end}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className={
                      emp.days_remaining <= 14
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }
                  >
                    {emp.days_remaining} days left
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => confirmMutation.mutate(emp.employee_id)}
                    disabled={confirmMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Confirm
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
