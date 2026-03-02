import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signUpSchema = loginSchema.extend({
  displayName: z.string().trim().min(2, { message: "Name must be at least 2 characters" }),
});

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  
  const { signIn, signUp, signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Clear any stale/invalid session when landing on auth page
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || (!session && localStorage.getItem('sb-cffoarjgagfhinkoszrf-auth-token'))) {
        // Stale token detected — clear it
        localStorage.removeItem('sb-cffoarjgagfhinkoszrf-auth-token');
        signOut();
      }
    });
  }, []);

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const validateForm = () => {
    const schema = isSignUp ? signUpSchema : loginSchema;
    const data = isSignUp ? { email, password, displayName } : { email, password };
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string; displayName?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field as keyof typeof fieldErrors] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const { error } = isSignUp 
        ? await signUp(email, password, displayName)
        : await signIn(email, password);
      
      if (error) {
        let message = error.message;
        if (error.message.includes('Invalid login credentials')) {
          message = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('User already registered')) {
          message = 'An account with this email already exists. Please sign in.';
        }
        toast({
          title: 'Authentication Failed',
          description: message,
          variant: 'destructive',
        });
      } else if (isSignUp) {
        toast({
          title: 'Account Created',
          description: 'Welcome! You are now signed in.',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="absolute inset-0 grid-pattern opacity-50"></div>
        <div className="relative z-10 text-center max-w-lg">
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
              <Shield className="w-20 h-20 text-primary relative" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 text-foreground tracking-tight">
            Intel Dashboard
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Real-time global intelligence monitoring and analysis platform for security professionals
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-4 text-left">
            <div className="p-5 rounded-xl bg-card/50 backdrop-blur border border-border">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
              </div>
              <h3 className="font-semibold text-sm mb-1">Live Monitoring</h3>
              <p className="text-xs text-muted-foreground">Real-time global event tracking and alerts</p>
            </div>
            <div className="p-5 rounded-xl bg-card/50 backdrop-blur border border-border">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                <Lock className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Secure Access</h3>
              <p className="text-xs text-muted-foreground">End-to-end encrypted communications</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <Shield className="w-8 h-8 text-primary" />
            <span className="font-bold text-xl">Intel Dashboard</span>
          </div>

          <div className="bg-card rounded-2xl border border-border p-8 shadow-lg">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-muted-foreground text-sm mt-2">
                {isSignUp ? 'Register to access the intelligence platform' : 'Sign in to your analyst account'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="John Smith"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10 h-12 bg-secondary/30 border-border focus:border-primary"
                      disabled={loading}
                    />
                  </div>
                  {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="analyst@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-secondary/30 border-border focus:border-primary"
                    disabled={loading}
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-secondary/30 border-border focus:border-primary"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-12 font-semibold text-base"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </span>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrors({});
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
                disabled={loading}
              >
                {isSignUp ? (
                  <>Already have an account? <span className="font-medium text-primary">Sign in</span></>
                ) : (
                  <>Don't have an account? <span className="font-medium text-primary">Create one</span></>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Secure connection • TLS 1.3 encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}