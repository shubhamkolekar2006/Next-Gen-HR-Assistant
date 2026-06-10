import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart3, FileText, Settings, UserPlus, Bot, X, Sparkles } from 'lucide-react';

const navigation = [
  { name: 'AI Orchestrator', href: '/app/orchestrator', icon: Sparkles },
  { name: 'Agent Dashboard', href: '/app/agents', icon: Bot },
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Employees', href: '/app/employees', icon: Users },
  { name: 'Hire Employee', href: '/app/hire', icon: UserPlus },
  { name: 'Analytics', href: '/app/analytics', icon: BarChart3 },
  { name: 'Policies', href: '/app/policies', icon: FileText },
  { name: 'Settings', href: '/app/settings', icon: Settings },
];

type SidebarProps = {
  onNavigate?: () => void;
  onClose?: () => void;
};

export const Sidebar = ({ onNavigate, onClose }: SidebarProps) => {
  const navItemClasses = useMemo(
    () =>
      ({
        active: 'bg-blue-600 text-white border-blue-600',
        idle: 'bg-white text-gray-700 border-gray-200',
      }),
    []
  );

  return (
    <div className="w-72 h-full bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Next-Gen HR
            </h1>
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-gray-500">TalentFlow</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <nav className="flex-1 px-5 py-6 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                [
                  'group relative flex items-center gap-3 rounded-lg border px-4 py-3',
                  isActive ? navItemClasses.active : navItemClasses.idle,
                  'focus:outline-none',
                ].join(' ')
              }
              onClick={onNavigate}
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isActive ? 'bg-white/20' : 'bg-gray-100'
                    }`}>
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                    </div>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">
            Productivity Tip
          </p>
          <p className="text-sm text-gray-700">
            Customize your HR workflows and agent automations to unlock the full potential of Next-Gen HR.
          </p>
        </div>
      </nav>
    </div>
  );
};

