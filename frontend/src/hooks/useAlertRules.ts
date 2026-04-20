import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AlertConditions {
  categories?: string[];
  regions?: string[];
  threatLevels?: string[];
  keywords?: string[];
}

export interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  conditions: AlertConditions;
  notification_method: 'in_app' | 'email' | 'both';
  is_active: boolean;
  created_at: string;
}

export interface CreateAlertRuleInput {
  name: string;
  conditions: AlertConditions;
  notification_method?: 'in_app' | 'email' | 'both';
  is_active?: boolean;
}

export function useAlertRules() {
  const { user } = useAuth();
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlertRules = useCallback(async () => {
    if (!user) {
      setAlertRules([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedData = (data || []).map(r => ({
        ...r,
        conditions: r.conditions as unknown as AlertConditions,
        notification_method: r.notification_method as AlertRule['notification_method']
      }));
      
      setAlertRules(typedData);
    } catch (err) {
      console.error('Error fetching alert rules:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createAlertRule = async (input: CreateAlertRuleInput) => {
    if (!user) throw new Error('Must be logged in');

    const { data, error } = await supabase
      .from('alert_rules')
      .insert([{
        user_id: user.id,
        name: input.name,
        conditions: JSON.parse(JSON.stringify(input.conditions)),
        notification_method: input.notification_method || 'in_app',
        is_active: input.is_active ?? true,
      }])
      .select()
      .single();

    if (error) throw error;

    const newRule = {
      ...data,
      conditions: data.conditions as unknown as AlertConditions,
      notification_method: data.notification_method as AlertRule['notification_method']
    };
    
    setAlertRules(prev => [newRule, ...prev]);
    return newRule;
  };

  const updateAlertRule = async (id: string, input: Partial<CreateAlertRuleInput>) => {
    if (!user) throw new Error('Must be logged in');

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.conditions !== undefined) updateData.conditions = input.conditions as unknown as Record<string, unknown>;
    if (input.notification_method !== undefined) updateData.notification_method = input.notification_method;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const { data, error } = await supabase
      .from('alert_rules')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    const updatedRule = {
      ...data,
      conditions: data.conditions as unknown as AlertConditions,
      notification_method: data.notification_method as AlertRule['notification_method']
    };
    
    setAlertRules(prev => prev.map(r => r.id === id ? updatedRule : r));
    return updatedRule;
  };

  const deleteAlertRule = async (id: string) => {
    if (!user) throw new Error('Must be logged in');

    const { error } = await supabase
      .from('alert_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    setAlertRules(prev => prev.filter(r => r.id !== id));
  };

  const toggleAlertRule = async (id: string, isActive: boolean) => {
    return updateAlertRule(id, { is_active: isActive });
  };

  useEffect(() => {
    fetchAlertRules();
  }, [fetchAlertRules]);

  return {
    alertRules,
    loading,
    createAlertRule,
    updateAlertRule,
    deleteAlertRule,
    toggleAlertRule,
    refetch: fetchAlertRules,
  };
}
