import { useState } from 'react';
import { useWatchlists, CreateWatchlistInput } from '@/hooks/useWatchlists';
import { FilterState } from '@/types/news';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  List, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Play, 
  Users,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface WatchlistManagerProps {
  currentFilters: FilterState;
  onApplyFilters: (filters: FilterState) => void;
}

const emptyFilters: FilterState = {
  dateRange: { from: null, to: null },
  regions: [],
  countries: [],
  tags: [],
  sources: [],
  searchQuery: '',
  categories: [],
  threatLevels: [],
  confidenceLevels: [],
  actorTypes: [],
  timeRange: '24h',
};

export function WatchlistManager({ currentFilters, onApplyFilters }: WatchlistManagerProps) {
  const { watchlists, loading, createWatchlist, deleteWatchlist } = useWatchlists();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setCreating(true);
    try {
      await createWatchlist({
        name: name.trim(),
        description: description.trim() || undefined,
        filters: currentFilters,
        is_shared: isShared,
      });
      toast({
        title: 'Watchlist created',
        description: 'Your current filters have been saved.',
      });
      setCreateOpen(false);
      setName('');
      setDescription('');
      setIsShared(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create watchlist.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWatchlist(id);
      toast({
        title: 'Watchlist deleted',
        description: 'The watchlist has been removed.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete watchlist.',
        variant: 'destructive',
      });
    }
  };

  const handleApply = (filters: FilterState) => {
    onApplyFilters(filters);
    toast({
      title: 'Filters applied',
      description: 'Watchlist filters have been applied.',
    });
  };

  const getFilterCount = (filters: FilterState) => {
    let count = 0;
    if (filters.categories.length) count += filters.categories.length;
    if (filters.regions.length) count += filters.regions.length;
    if (filters.sources.length) count += filters.sources.length;
    if (filters.threatLevels.length) count += filters.threatLevels.length;
    if (filters.searchQuery) count += 1;
    return count;
  };

  return (
    <div className="intel-card">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Watchlists</h3>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Current Filters as Watchlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Critical Security Alerts"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this watchlist monitors..."
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="shared" className="text-sm">Share with team</Label>
                <Switch
                  id="shared"
                  checked={isShared}
                  onCheckedChange={setIsShared}
                />
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Current filters to save:</p>
                <div className="flex flex-wrap gap-1">
                  {currentFilters.categories.map(c => (
                    <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                  ))}
                  {currentFilters.regions.map(r => (
                    <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                  ))}
                  {currentFilters.searchQuery && (
                    <Badge variant="outline" className="text-[10px]">"{currentFilters.searchQuery}"</Badge>
                  )}
                  {getFilterCount(currentFilters) === 0 && (
                    <span className="text-xs text-muted-foreground">No filters applied</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                  {creating ? 'Saving...' : 'Save Watchlist'}
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
        ) : watchlists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Filter className="w-6 h-6 mb-2 opacity-50" />
            <p className="text-xs">No watchlists yet</p>
            <p className="text-[10px]">Save your current filters</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {watchlists.map((watchlist) => (
              <div key={watchlist.id} className="p-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{watchlist.name}</p>
                      {watchlist.is_shared && (
                        <Users className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    {watchlist.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {watchlist.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {getFilterCount(watchlist.filters)} filters
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(watchlist.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleApply(watchlist.filters)}>
                        <Play className="w-3 h-3 mr-2" />
                        Apply Filters
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(watchlist.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
