import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthForm } from '@/components/auth/AuthForm';
import { Shield, BarChart3, Users, MessageSquare, Database, Plane } from 'lucide-react';
import pfLogo from '@/assets/pf-logo.png';
import pfPattern from '@/assets/pf-pattern.png';

const features = [
  { 
    icon: Plane, 
    title: 'Flight Management', 
    description: 'Seamless charter request handling with real-time status tracking' 
  },
  { 
    icon: Shield, 
    title: 'Role-Based Access', 
    description: 'Strict data segregation between Sales, Operations, and Admin' 
  },
  { 
    icon: MessageSquare, 
    title: 'Integrated Chat', 
    description: 'Flight-specific and team messaging for seamless coordination' 
  },
  { 
    icon: Database, 
    title: 'Aircraft Database', 
    description: 'Comprehensive fleet and operator management system' 
  },
  { 
    icon: BarChart3, 
    title: 'Analytics', 
    description: 'Performance metrics and business intelligence dashboards' 
  },
  { 
    icon: Users, 
    title: 'Client Management', 
    description: 'VIP profiles and complete flight history tracking' 
  },
];

const navLinks = [
  { label: 'Home', path: '/' },
  { label: 'Contact Us', path: '/contact' },
];

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, mustChangePassword } = useAuth();

  // Redirect authenticated users to dashboard or change password page
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, mustChangePassword, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background pattern */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{ 
            backgroundImage: `url(${pfPattern})`,
            backgroundSize: '400px',
            backgroundRepeat: 'repeat'
          }}
        />
        
        <div className="relative">
          {/* Nav */}
          <nav className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 gap-4">
            <div className="flex items-center min-w-0">
              <img src={pfLogo} alt="Private Fleet" className="h-16 sm:h-24 md:h-40 lg:h-56" />
            </div>
            <div className="flex items-center gap-3 md:gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-sm md:text-base text-foreground hover:text-primary font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Hero Content */}
          <div className="px-4 md:px-8 py-8 md:py-16 max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center">
              {/* Left - Marketing */}
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20 mb-6">
                  <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-sm font-medium text-foreground">
                    Enterprise Charter Management
                  </span>
                </div>
                <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-6 leading-tight">
                  Elevate Your
                  <span className="block text-accent">Charter Operations</span>
                </h1>
                <p className="text-base md:text-xl text-foreground mb-6 max-w-xl leading-relaxed">
                  A unified platform connecting Sales and Operations teams with 
                  real-time collaboration, secure data segregation, and seamless 
                  flight management.
                </p>
              </div>

              {/* Right - Auth Form */}
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-sm p-6 md:p-8 rounded-2xl bg-primary/5 backdrop-blur-sm border border-primary/20">
                  <AuthForm />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 md:py-24 px-4 md:px-8 relative overflow-hidden">
        {/* Background pattern */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{ 
            backgroundImage: `url(${pfPattern})`,
            backgroundSize: '300px',
            backgroundRepeat: 'repeat'
          }}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-primary mb-4">
              Built for Premium Charter Operations
            </h2>
            <p className="text-base md:text-lg text-foreground max-w-2xl mx-auto">
              Every feature designed to streamline your workflow while maintaining 
              strict role-based data governance.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="h-12 w-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/30 transition-colors">
                  <feature.icon className="h-6 w-6 text-accent group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-display font-semibold text-lg text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/20 py-6 md:py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-2">
            <img src={pfLogo} alt="Private Fleet" className="h-16 md:h-24" />
            <span className="text-xs md:text-sm text-foreground">
              Private Fleet Services © 2026. Enterprise Charter Management.
            </span>
          </div>
          <p className="text-xs md:text-sm text-foreground">
            Built with precision for the aviation industry.
          </p>
        </div>
      </footer>
    </div>
  );
}
