import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/types/charter';
import pfLogo from '@/assets/pf-logo.png';
import pfPattern from '@/assets/pf-pattern.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo login - in production this would validate credentials
    login('sales');
    navigate('/dashboard');
  };

  const handleDemoLogin = (role: UserRole) => {
    login(role);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-[0.05]"
        style={{ 
          backgroundImage: `url(${pfPattern})`,
          backgroundSize: '350px',
          backgroundRepeat: 'repeat'
        }}
      />
      
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link to="/">
          <img src={pfLogo} alt="Private Fleet" className="h-32" />
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/" className="text-foreground hover:text-primary font-medium transition-colors">
            Home
          </Link>
          <Link to="/contact" className="text-foreground hover:text-primary font-medium transition-colors">
            Contact Us
          </Link>
        </div>
      </nav>

      {/* Login Form */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-12">
        <Card className="w-full max-w-md bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                Sign In
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Demo Access — Select Role
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDemoLogin('sales')}
                >
                  Sales
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDemoLogin('operations')}
                >
                  Operations
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDemoLogin('admin')}
                >
                  Admin
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
