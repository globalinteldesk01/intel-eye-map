import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Comment {
  id: string;
  news_item_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useComments(newsItemId: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchComments = useCallback(async () => {
    if (!newsItemId) return;
    
    setLoading(true);
    try {
      // Fetch comments without join since we don't have a FK constraint
      const { data, error } = await supabase
        .from('intel_comments')
        .select('*')
        .eq('news_item_id', newsItemId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately for the comment authors
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const commentsWithProfiles: Comment[] = (data || []).map(c => ({
        ...c,
        profile: profileMap.get(c.user_id) || undefined,
      }));
      
      setComments(commentsWithProfiles);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [newsItemId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const addComment = async (content: string) => {
    if (!newsItemId) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({ title: 'Error', description: 'Must be logged in to comment', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('intel_comments')
        .insert({
          news_item_id: newsItemId,
          user_id: userData.user.id,
          content,
        });

      if (error) throw error;
      
      toast({ title: 'Comment added' });
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' });
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('intel_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      
      toast({ title: 'Comment deleted' });
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({ title: 'Error', description: 'Failed to delete comment', variant: 'destructive' });
    }
  };

  return { comments, loading, addComment, deleteComment, refetch: fetchComments };
}
