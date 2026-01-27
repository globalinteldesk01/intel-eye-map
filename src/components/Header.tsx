import { Button } from '@/components/ui/button';
import { Radio, Menu, LogOut, User, Clock, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { CreateNewsDialog } from '@/components/CreateNewsDialog';
import { CreateNewsItemInput } from '@/hooks/useNewsItems';
import { ExportMenu } from '@/components/ExportMenu';
import { NewsItem } from '@/types/news';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { UserSettings } from '@/components/UserSettings';

interface HeaderProps {
  onToggleSidebar: () => void;
  showSidebar: boolean;
  onCreateNews?: (input: CreateNewsItemInput) => Promise<unknown>;
  newsItems?: NewsItem[];
}

export function Header({ 
  onToggleSidebar, 
  showSidebar, 
  onCreateNews, 
  newsItems = [],
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Signed out',
      description: 'You have been logged out successfully.',
    });
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Radio className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-intel-emerald rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Global Intel Desk</h1>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              OSINT Monitoring Platform
            </p>
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {onCreateNews && (
          <CreateNewsDialog onCreate={onCreateNews} />
        )}
        <Button 
          variant={location.pathname === '/' ? 'secondary' : 'ghost'}
          size="icon" 
          className="h-8 w-8"
          onClick={() => navigate('/')}
          title="Dashboard"
        >
          <Home className="w-4 h-4" />
        </Button>
        <Button 
          variant={location.pathname === '/timeline' ? 'secondary' : 'ghost'}
          size="icon" 
          className="h-8 w-8"
          onClick={() => navigate('/timeline')}
          title="Timeline View"
        >
          <Clock className="w-4 h-4" />
        </Button>
        <NotificationsPanel />
        <UserSettings />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <User className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Agent Profile</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
