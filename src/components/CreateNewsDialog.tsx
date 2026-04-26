import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { CreateNewsItemInput } from '@/hooks/useNewsItems';
import { IntelSpreadsheet } from '@/components/IntelSpreadsheet';

interface CreateNewsDialogProps {
  onCreate: (input: CreateNewsItemInput) => Promise<unknown>;
}

export function CreateNewsDialog({ onCreate }: CreateNewsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="w-4 h-4" />
          Add Intel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[1920px] max-h-[90vh] p-0">
        <IntelSpreadsheet onCreate={onCreate} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
