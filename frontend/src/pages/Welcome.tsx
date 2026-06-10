import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, ArrowRight, Sparkles, TrendingUp, Shield } from 'lucide-react';

export const Welcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: 'Employee Management',
      description: 'Comprehensive employee database and profiles',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Automation',
      description: 'Intelligent agents for HR processes',
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Real-time analytics and predictions',
    },
    {
      icon: Shield,
      title: 'Secure & Compliant',
      description: 'Enterprise-grade security',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-blue-600 p-4 rounded-xl shadow-sm">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-gray-900">Next-Gen HR</h1>
              <p className="text-gray-600">TalentFlow Platform</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Welcome to the System
            </h2>
            {user && (
              <p className="text-lg text-gray-700">
                Hello, <span className="font-semibold text-blue-600">{user.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-8">
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="space-y-4 text-center">
                <p className="text-gray-700 leading-relaxed">
                  You're now logged into the Next-Gen HR TalentFlow Platform. This intelligent
                  human resources management system helps you streamline hiring, manage employees,
                  and make data-driven decisions with ease.
                </p>
                <p className="text-gray-600">
                  Get started by exploring the dashboard to view analytics, manage your workforce,
                  or use our AI-powered agents to automate HR tasks.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={feature.title} 
                  className="border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => navigate('/app/dashboard')}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-base font-medium shadow-sm"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};