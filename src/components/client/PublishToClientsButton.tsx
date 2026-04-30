import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';

interface Props {
  newsItemId: string;
}

export function PublishToClientsButton({ newsItemId }: Props) {
  const { user } = useAuth();
  const { isAnalyst } = useUserRole();
  const { toast } = useToast();
  const [published, setPublished] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('news_items')
      .select('is_published_to_clients')
      .eq('id', newsItemId)
      .maybeSingle()
      .then(({ data }) => setPublished(!!data?.is_published_to_clients));
  }, [newsItemId]);

  if (!isAnalyst) return null;

  const toggle = async () => {
    if (!user) return;
    setBusy(true);
    const next = !published;
    const { error } = await supabase
      .from('news_items')
      .update({
        is_published_to_clients: next,
        published_to_clients_at: next ? new Date().toISOString() : null,
        published_by: next ? user.id : null,
      })
      .eq('id', newsItemId);
    setBusy(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setPublished(next);
    toast({
      title: next ? 'Published to clients' : 'Unpublished',
      description: next ? 'Assigned clients can now see this intel.' : 'Hidden from clients.',
    });
  };

  return (
    <Button
      variant={published ? 'default' : 'outline'}
      size="sm"
      onClick={toggle}
      disabled={busy || published === null}
      className="gap-1.5"
    >
      {published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
      {published ? 'Published to clients' : 'Publish to clients'}
    </Button>
  );
}
