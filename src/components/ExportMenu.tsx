import { NewsItem } from '@/types/news';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { exportToCSV, exportToPDF, exportToJSON } from '@/utils/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface ExportMenuProps {
  items: NewsItem[];
  filename?: string;
}

export function ExportMenu({ items, filename = 'intel-report' }: ExportMenuProps) {
  const { toast } = useToast();

  const handleExport = (type: 'csv' | 'pdf' | 'json') => {
    if (items.length === 0) {
      toast({ title: 'No data', description: 'No items to export', variant: 'destructive' });
      return;
    }

    try {
      switch (type) {
        case 'csv':
          exportToCSV(items, filename);
          break;
        case 'pdf':
          exportToPDF(items, filename);
          break;
        case 'json':
          exportToJSON(items, filename);
          break;
      }
      toast({ title: 'Export successful', description: `Exported ${items.length} items as ${type.toUpperCase()}` });
    } catch (error) {
      toast({ title: 'Export failed', description: 'Could not export data', variant: 'destructive' });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
          <FileText className="w-4 h-4 mr-2" />
          PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          CSV Spreadsheet
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')} className="cursor-pointer">
          <FileJson className="w-4 h-4 mr-2" />
          JSON Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
