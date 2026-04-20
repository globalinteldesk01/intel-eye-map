import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, User, Mail, Shield, Save, Camera, Key, Calendar, Clock, Bell, Lock, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export function UserSettings() {
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const { role } = useUserRole();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [criticalAlertsOnly, setCriticalAlertsOnly] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName || undefined,
        avatar_url: avatarUrl || undefined,
      });
      toast({
        title: 'Profile updated',
        description: 'Your settings have been saved successfully.',
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getRoleDescription = () => {
    switch (role) {
      case 'analyst':
        return 'Full access to create, edit, and manage intelligence reports';
      case 'client':
        return 'View-only access to executive dashboards and reports';
      default:
        return 'Standard user access';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border bg-secondary/30">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="w-5 h-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0">
              <TabsTrigger 
                value="profile" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <User className="w-4 h-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              >
                <Lock className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-0 p-6 space-y-6">
              {/* Avatar Section */}
              <div className="flex items-start gap-5">
                <div className="relative group">
                  <Avatar className="w-20 h-20 ring-2 ring-primary/20">
                    <AvatarImage src={avatarUrl || profile?.avatar_url || ''} />
                    <AvatarFallback className="text-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-semibold">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="avatarUrl" className="text-xs text-muted-foreground uppercase tracking-wider">
                    Avatar URL
                  </Label>
                  <Input
                    id="avatarUrl"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="bg-secondary/50 border-border focus:border-primary"
                  />
                </div>
              </div>

              <Separator />

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName" className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <User className="w-3.5 h-3.5" />
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name..."
                  className="bg-secondary/50 border-border focus:border-primary"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <Mail className="w-3.5 h-3.5" />
                  Email Address
                </Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-secondary/30 border-border text-muted-foreground"
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" />
                  Role & Permissions
                </Label>
                <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        {role || 'User'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getRoleDescription()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="p-4 bg-secondary/20 rounded-lg border border-border">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" />
                  Account Information
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Globe className="w-3 h-3" />
                      User ID
                    </span>
                    <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">
                      {user?.id?.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      Account Created
                    </span>
                    <span className="text-xs">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric' 
                      }) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Last Updated
                    </span>
                    <span className="text-xs">
                      {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: 'short', 
                        year: 'numeric' 
                      }) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Email Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive intelligence alerts via email
                    </p>
                  </div>
                  <Switch 
                    checked={emailNotifications} 
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive real-time browser notifications
                    </p>
                  </div>
                  <Switch 
                    checked={pushNotifications} 
                    onCheckedChange={setPushNotifications}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Critical Alerts Only</Label>
                    <p className="text-xs text-muted-foreground">
                      Only notify for high and critical threat levels
                    </p>
                  </div>
                  <Switch 
                    checked={criticalAlertsOnly} 
                    onCheckedChange={setCriticalAlertsOnly}
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-medium">Note:</span> Notification preferences are stored locally. 
                  Email notifications require additional backend configuration.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-0 p-6 space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Password</h4>
                      <p className="text-xs text-muted-foreground">Last changed: Never</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Change Password
                  </Button>
                </div>

                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10">
                      <Shield className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Two-Factor Authentication</h4>
                      <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Enable 2FA
                  </Button>
                </div>

                <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                  <h4 className="text-sm font-medium text-destructive mb-1">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Permanently delete your account and all associated data.
                  </p>
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/20">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
