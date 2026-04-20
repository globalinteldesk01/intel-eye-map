import { useState } from 'react';
import { useAlertRules, CreateAlertRuleInput, AlertConditions } from '@/hooks/useAlertRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Bell, 
  Plus, 
  MoreVertical, 
  Trash2,
  Zap,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const categories = ['security', 'diplomacy', 'economy', 'conflict', 'humanitarian', 'technology'];
const regions = ['Europe', 'North America', 'Asia Pacific', 'Middle East', 'Africa'];
const threatLevels = ['low', 'elevated', 'high', 'critical'];

export function AlertRulesManager() {
  const { alertRules, loading, createAlertRule, deleteAlertRule, toggleAlertRule } = useAlertRules();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedThreatLevels, setSelectedThreatLevels] = useState<string[]>([]);
  const [notificationMethod, setNotificationMethod] = useState<'in_app' | 'email' | 'both'>('in_app');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setCreating(true);
    try {
      await createAlertRule({
        name: name.trim(),
        conditions: {
          categories: selectedCategories,
          regions: selectedRegions,
          threatLevels: selectedThreatLevels,
        },
        notification_method: notificationMethod,
      });
      toast({
        title: 'Alert rule created',
        description: 'You will be notified when matching intel arrives.',
      });
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create alert rule.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setName('');
    setSelectedCategories([]);
    setSelectedRegions([]);
    setSelectedThreatLevels([]);
    setNotificationMethod('in_app');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAlertRule(id);
      toast({
        title: 'Alert rule deleted',
        description: 'The alert rule has been removed.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete alert rule.',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await toggleAlertRule(id, isActive);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update alert rule.',
        variant: 'destructive',
      });
    }
  };

  const toggleItem = (item: string, list: string[], setList: (items: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const getConditionCount = (conditions: AlertConditions) => {
    let count = 0;
    if (conditions.categories?.length) count += conditions.categories.length;
    if (conditions.regions?.length) count += conditions.regions.length;
    if (conditions.threatLevels?.length) count += conditions.threatLevels.length;
    return count;
  };

  return (
    <div className="intel-card">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Alert Rules</h3>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="ruleName">Rule Name</Label>
                <Input
                  id="ruleName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Critical Security Alerts"
                />
              </div>

              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-1">
                  {categories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                      className="cursor-pointer capitalize"
                      onClick={() => toggleItem(cat, selectedCategories, setSelectedCategories)}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Regions</Label>
                <div className="flex flex-wrap gap-1">
                  {regions.map((region) => (
                    <Badge
                      key={region}
                      variant={selectedRegions.includes(region) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleItem(region, selectedRegions, setSelectedRegions)}
                    >
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Threat Levels</Label>
                <div className="flex flex-wrap gap-1">
                  {threatLevels.map((level) => (
                    <Badge
                      key={level}
                      variant={selectedThreatLevels.includes(level) ? 'default' : 'outline'}
                      className="cursor-pointer capitalize"
                      onClick={() => toggleItem(level, selectedThreatLevels, setSelectedThreatLevels)}
                    >
                      {level}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notification Method</Label>
                <Select value={notificationMethod} onValueChange={(v) => setNotificationMethod(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_app">In-App Only</SelectItem>
                    <SelectItem value="email">Email Only</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                  {creating ? 'Creating...' : 'Create Rule'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-48">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : alertRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <AlertCircle className="w-6 h-6 mb-2 opacity-50" />
            <p className="text-xs">No alert rules yet</p>
            <p className="text-[10px]">Create rules to get notified</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {alertRules.map((rule) => (
              <div key={rule.id} className="p-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{rule.name}</p>
                      <Badge 
                        variant={rule.is_active ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {rule.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {getConditionCount(rule.conditions)} conditions
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(rule.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDelete(rule.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
