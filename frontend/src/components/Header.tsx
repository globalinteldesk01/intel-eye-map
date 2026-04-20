import { Button } from '@/components/ui/button';
import { Menu, LogOut, User, Clock, Home, MessageSquare } from 'lucide-react';
import globalIntelLogo from '@/assets/global-intel-desk-logo.png';
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
import { NewsItem } from '@/types/news';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { UserSettings } from '@/components/UserSettings';
import { CountryWatchlist } from '@/components/CountryWatchlist';

interface HeaderProps {
  onToggleSidebar: () => void;
  newsItems?: NewsItem[];
  onSelectItem?: (item: NewsItem) => void;
  onToggleChat?: () => void;
  chatOpen?: boolean;
}

export function Header({ 
  onToggleSidebar, 
  newsItems = [],
  onSelectItem,
  onToggleChat,
  chatOpen = false,
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
    <header className="h-14 bg-[hsl(210,100%,30%)] flex items-center justify-between px-4 shadow-lg">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          <img src={globalIntelLogo} alt="Global Intel Desk" className="h-9 w-auto" />
          <div className="border-l border-white/30 pl-3">
            <h1 className="text-lg font-bold tracking-wide text-white uppercase">Global Intel Desk</h1>
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm" 
          className={`h-8 text-white hover:bg-white/10 ${location.pathname === '/' ? 'bg-white/15' : ''}`}
          onClick={() => navigate('/')}
        >
          <Home className="w-4 h-4 mr-1.5" />
          Dashboard
        </Button>
        <Button 
          variant="ghost"
          size="sm" 
          className={`h-8 text-white hover:bg-white/10 ${location.pathname === '/timeline' ? 'bg-white/15' : ''}`}
          onClick={() => navigate('/timeline')}
        >
          <Clock className="w-4 h-4 mr-1.5" />
          Timeline
        </Button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        {/* Chat Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleChat}
          className={`h-8 text-white hover:bg-white/10 relative ${chatOpen ? 'bg-green-500/20 text-green-300' : ''}`}
        >
          <MessageSquare className="w-4 h-4 mr-1.5" />
          Intel Chat
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
        </Button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        <CountryWatchlist />
        <NotificationsPanel newsItems={newsItems} onSelectItem={onSelectItem} />
        <UserSettings />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10">
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
