import { useState } from 'react';
import {
  Briefcase,
  UserCheck,
  Clock3,
  Calendar,
  Coins,
  TrendingUp,
  Shield,
  HeartPulse,
  Laptop2,
  LogOut,
  Scale,
  Bot,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type PolicySection = {
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  policies: string[];
};

const policySections: PolicySection[] = [
  {
    title: 'Employment & Hiring Policies',
    description:
      'Guidelines covering recruitment, selection, verification, and employment classifications across the organisation.',
    icon: Briefcase,
    accent: '',
    policies: [
      'Recruitment and Selection Policy',
      'Equal Employment Opportunity (EEO) Policy',
      'Background Verification Policy',
      'Employee Classification Policy (Full-time, Intern, Contract, etc.)',
      'Offer Letter and Appointment Policy',
      'Probation and Confirmation Policy',
    ],
  },
  {
    title: 'Employee Conduct & Workplace Ethics',
    description:
      'Policies that uphold professional behaviour, integrity, and respectful collaboration in every interaction.',
    icon: UserCheck,
    accent: '',
    policies: [
      'Code of Conduct Policy',
      'Anti-Harassment and Anti-Discrimination Policy',
      'Workplace Behavior and Discipline Policy',
      'Professional Ethics and Integrity Policy',
      'Conflict of Interest Policy',
      'Dress Code and Personal Appearance Policy',
      'Workplace Bullying and Grievance Redressal Policy',
    ],
  },
  {
    title: 'Attendance & Working Hours',
    description:
      'Frameworks for attendance tracking, scheduling flexibility, and productive work routines.',
    icon: Clock3,
    accent: '',
    policies: [
      'Attendance and Time Tracking Policy',
      'Working Hours and Break Policy',
      'Overtime Policy',
      'Work-from-Home / Remote Work Policy',
      'Flexible Working Hours Policy',
    ],
  },
  {
    title: 'Leave & Holidays',
    description:
      'Comprehensive leave structures, statutory entitlements, and company-wide holiday governance.',
    icon: Calendar,
    accent: '',
    policies: [
      'Leave Policy (Casual, Sick, Earned, etc.)',
      'Maternity Leave Policy',
      'Paternity Leave Policy',
      'Compensatory Off Policy',
      'Public Holidays Policy',
      'Bereavement Leave Policy',
    ],
  },
  {
    title: 'Compensation & Benefits',
    description:
      'Structures that reward contribution, safeguard well-being, and ensure transparent payroll practices.',
    icon: Coins,
    accent: '',
    policies: [
      'Salary Structure Policy',
      'Incentive and Bonus Policy',
      'Payroll and Deductions Policy',
      'Reimbursement and Expense Policy',
      'Employee Benefits Policy (Health Insurance, PF, etc.)',
      'Gratuity and Retirement Benefits Policy',
    ],
  },
  {
    title: 'Performance & Growth',
    description:
      'Enablement programmes focused on capability building, career advancement, and performance culture.',
    icon: TrendingUp,
    accent: '',
    policies: [
      'Performance Appraisal Policy',
      'Promotion and Career Progression Policy',
      'Training and Development Policy',
      'Skill Enhancement / Upskilling Policy',
      'Performance Improvement Plan (PIP) Policy',
    ],
  },
  {
    title: 'IT, Security & Data Policies',
    description:
      'Protocols guarding digital infrastructure, information assets, and responsible technology use.',
    icon: Shield,
    accent: '',
    policies: [
      'IT and Internet Usage Policy',
      'Data Protection and Privacy Policy',
      'Cybersecurity and Confidentiality Policy',
      'Social Media and Communication Policy',
      'Use of Company Assets Policy',
    ],
  },
  {
    title: 'Health, Safety & Well-being',
    description:
      'Initiatives that prioritise physical safety, mental wellness, and emergency readiness for all employees.',
    icon: HeartPulse,
    accent: '',
    policies: [
      'Workplace Health and Safety Policy',
      'Fire Safety and Emergency Response Policy',
      'Mental Health and Well-being Policy',
      'Ergonomics and Office Safety Policy',
    ],
  },
  {
    title: 'Remote & Hybrid Work',
    description:
      'Guidance for distributed teams on collaboration, communication, and remote-first effectiveness.',
    icon: Laptop2,
    accent: '',
    policies: [
      'Work-from-Home Policy',
      'Hybrid Work Policy',
      'Remote Team Collaboration Policy',
      'Digital Communication Policy',
    ],
  },
  {
    title: 'Separation & Exit',
    description:
      'Processes managing employee transitions, knowledge transfer, and compliant offboarding.',
    icon: LogOut,
    accent: '',
    policies: [
      'Resignation Policy',
      'Exit Interview Policy',
      'Clearance and Handover Policy',
      'Termination and Disciplinary Action Policy',
      'Final Settlement Policy',
    ],
  },
  {
    title: 'Legal & Compliance',
    description:
      'Mandatory policies aligned with statutory, ethical, and regulatory obligations worldwide.',
    icon: Scale,
    accent: '',
    policies: [
      'Whistleblower Policy',
      'Anti-Bribery and Corruption Policy',
      'Equal Opportunity and Diversity Policy',
      'POSH (Prevention of Sexual Harassment) Policy',
      'Non-Disclosure Agreement (NDA) Policy',
      'Employment Contract Policy',
    ],
  },
  {
    title: 'Modern & AI-Driven Policies',
    description:
      'Forward-looking guardrails supporting responsible AI, innovation, and inclusive growth mindsets.',
    icon: Bot,
    accent: '',
    policies: [
      'AI Ethics and Data Handling Policy',
      'Remote Collaboration and Productivity Policy',
      'Diversity, Equity & Inclusion (DEI) Policy',
      'Innovation and Research Policy',
      'Intellectual Property Rights (IPR) Policy',
    ],
  },
];


export const Policies = () => {
  const [openSection, setOpenSection] = useState<string | null>(policySections[0]?.title ?? null);

  const toggleSection = (title: string) => {
    setOpenSection(prev => (prev === title ? null : title));
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            TalentFlow Policy Hub
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-blue-600">
            Policies & Governance Framework
          </h1>
          <p className="max-w-3xl text-base md:text-lg text-gray-700 leading-relaxed">
            Explore the complete catalogue of TalentFlow HR policies spanning hiring, conduct,
            compensation, compliance, and our modern AI-first operating ethos. Each section offers
            ready-to-reference guidelines for employees, managers, and partners.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {policySections.map((section) => {
            const Icon = section.icon;
            const isOpen = openSection === section.title;
            return (
              <Card key={section.title} className="h-full border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full items-start gap-4 rounded-lg px-5 py-6 text-left focus:outline-none"
                  aria-expanded={isOpen}
                  aria-controls={`${section.title}-policies`}
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h2 className="text-lg font-semibold text-gray-900 md:text-xl">
                          {section.title}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {section.description}
                        </p>
                      </div>
                      <div className="mt-1 rounded-full border border-gray-300 bg-white p-2 text-gray-700">
                        <ChevronDown
                          className={`h-4 w-4 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div id={`${section.title}-policies`}>
                    <CardContent className="pt-0 pb-6">
                      <ul className="space-y-2.5">
                        {section.policies.map((policy) => (
                          <li
                            key={policy}
                            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900"
                          >
                            <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-600"></span>
                            <span>{policy}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
    
  );
};

