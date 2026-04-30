import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClientAssignment {
  countries: string[];
  regions: string[];
  services: string[];
  is_active: boolean;
}

export function useClientAssignment() {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<ClientAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAssignment(null);
      setLoading(false);
      return;
    }
    supabase
      .from('client_assignments')
      .select('countries, regions, services, is_active')
      .eq('client_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setAssignment(data as ClientAssignment | null);
        setLoading(false);
      });
  }, [user]);

  const hasService = (svc: string) =>
    !assignment ? true : assignment.services?.includes(svc);

  return { assignment, loading, hasService };
}
