import { useState, useMemo } from 'react';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, Check, CheckCheck, AlertTriangle, Info, AlertCircle, ExternalLink, Trash2 } from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { NewsItem } from '@/types/news';

// Safely decode HTML entities using DOMParser (prevents XSS)
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return doc.documentElement.textContent || text;
};

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  alert: <AlertCircle className="w-4 h-4 text-red-400" />,
  success: <Check className="w-4 h-4 text-green-400" />,
};

interface NotificationsPanelProps {
  newsItems?: NewsItem[];
  onSelectItem?: (item: NewsItem) => void;
}

export function NotificationsPanel({ newsItems = [], onSelectItem }: NotificationsPanelProps) {
  const { notifications, loading, unreadCount, deleteNotification, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  // Always sort newest-first by created_at so today's freshly fetched intel
  // is on top, then yesterday, then earlier days. Cap at 30 visible items.
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [notifications]);

  const latestNotifications = sortedNotifications.slice(0, 30);

  // Group by day bucket: Today → Yesterday → MMM d
  const groupedNotifications = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    const map = new Map<string, Notification[]>();
    const order: string[] = [];
    for (const n of latestNotifications) {
      const d = new Date(n.created_at);
      const label = isToday(d)
        ? 'Today'
        : isYesterday(d)
          ? 'Yesterday'
          : format(d, 'MMM d, yyyy');
      if (!map.has(label)) {
        map.set(label, []);
        order.push(label);
      }
      map.get(label)!.push(n);
    }
    for (const label of order) groups.push({ label, items: map.get(label)! });
    return groups;
  }, [latestNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    // Navigate to the intel item if it exists
    if (notification.news_item_id && onSelectItem) {
      const newsItem = newsItems.find(item => item.id === notification.news_item_id);
      if (newsItem) {
        onSelectItem(newsItem);
        setOpen(false); // Close the notification panel
      }
    }
    
    // Delete the notification after viewing
    await deleteNotification(notification.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-intel-red rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
              onClick={markAllAsRead}
            >
              <CheckCheck className="w-3 h-3" />
              Clear all
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : latestNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div>
              {groupedNotifications.map((group) => (
                <div key={group.label} className="divide-y divide-border">
                  <div className="sticky top-0 z-10 px-3 py-1.5 bg-background/95 backdrop-blur border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>{group.label}</span>
                    <span className="text-[10px] text-muted-foreground/70">{group.items.length}</span>
                  </div>
                  {group.items.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-3 cursor-pointer hover:bg-secondary/50 transition-colors group',
                        !notification.is_read && 'bg-primary/5'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {typeIcons[notification.type] || typeIcons.info}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">
                          {decodeHtmlEntities(notification.title)}
                        </p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {notification.news_item_id && onSelectItem && (
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          {!notification.is_read && (
                            <Badge variant="secondary" className="bg-primary/20 text-primary text-[10px] px-1">
                              New
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                        {decodeHtmlEntities(notification.message)}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                        {notification.news_item_id && onSelectItem && (
                          <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to view intel →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
