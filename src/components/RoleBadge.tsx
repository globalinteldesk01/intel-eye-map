import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { AppRole } from '@/hooks/useUserRole';

interface RoleBadgeProps {
  role: AppRole | null;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  if (!role) return null;

  return (
    <Badge variant="outline" className="text-[10px] font-mono uppercase bg-intel-cyan/20 text-intel-cyan border-intel-cyan/30">
      <Shield className="w-3 h-3 mr-1" />
      Analyst
    </Badge>
  );
}
