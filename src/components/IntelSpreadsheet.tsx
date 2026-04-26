import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { CreateNewsItemInput } from '@/hooks/useNewsItems';
import { ThreatLevel, ConfidenceLevel, ActorType, SourceCredibility } from '@/types/news';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface IntelSpreadsheetProps {
  onCreate: (input: CreateNewsItemInput) => Promise<unknown>;
  onClose: () => void;
}

interface IntelRow extends CreateNewsItemInput {
  _id: string;
  _status: 'pending' | 'saving' | 'saved' | 'error';
}

const categories = ['security', 'diplomacy', 'economy', 'conflict', 'humanitarian', 'technology'] as const;
const threatLevels: ThreatLevel[] = ['low', 'elevated', 'high', 'critical'];
const confidenceLevels: ConfidenceLevel[] = ['verified', 'developing', 'breaking'];
const actorTypes: ActorType[] = ['state', 'non-state', 'organization'];
const sourceCredibilities: SourceCredibility[] = ['high', 'medium', 'low'];
const regions = ['Europe', 'North America', 'South America', 'Asia Pacific', 'Middle East', 'Africa', 'Central Asia', 'South Asia', 'Oceania', 'Arctic', 'Caucasus'];

const createEmptyRow = (): IntelRow => ({
  _id: crypto.randomUUID(),
  _status: 'pending',
  title: '',
  summary: '',
  url: '',
  source: '',
  sourceCredibility: 'medium',
  lat: 0,
  lon: 0,
  country: '',
  region: 'Europe',
  tags: [],
  confidenceScore: 0.8,
  confidenceLevel: 'developing',
  threatLevel: 'low',
  actorType: 'organization',
  category: 'security',
});

export function IntelSpreadsheet({ onCreate, onClose }: IntelSpreadsheetProps) {
  const [rows, setRows] = useState<IntelRow[]>([createEmptyRow()]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const addRow = useCallback(() => {
    setRows(prev => [...prev, createEmptyRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows(prev => prev.filter(row => row._id !== id));
  }, []);

  const updateRow = useCallback((id: string, field: keyof CreateNewsItemInput, value: unknown) => {
    setRows(prev => prev.map(row => 
      row._id === id ? { ...row, [field]: value } : row
    ));
  }, []);

  const isRowValid = (row: IntelRow): boolean => {
    return !!(row.title && row.summary && row.url && row.source && row.country);
  };

  const saveAllRows = async () => {
    const validRows = rows.filter(isRowValid);
    
    if (validRows.length === 0) {
      toast({
        title: 'No valid rows',
        description: 'Please fill in required fields (Title, Summary, URL, Source, Country)',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of validRows) {
      setRows(prev => prev.map(r => 
        r._id === row._id ? { ...r, _status: 'saving' } : r
      ));

      try {
        const { _id, _status, ...input } = row;
        await onCreate(input);
        setRows(prev => prev.map(r => 
          r._id === row._id ? { ...r, _status: 'saved' } : r
        ));
        successCount++;
      } catch {
        setRows(prev => prev.map(r => 
          r._id === row._id ? { ...r, _status: 'error' } : r
        ));
        errorCount++;
      }
    }

    setSaving(false);

    if (successCount > 0) {
      toast({
        title: 'Intel Created',
        description: `${successCount} intel item(s) saved successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });
    }

    // Remove saved rows and add a fresh row if all succeeded
    setTimeout(() => {
      setRows(prev => {
        const remaining = prev.filter(r => r._status !== 'saved');
        return remaining.length === 0 ? [createEmptyRow()] : remaining;
      });
    }, 1000);
  };

  const getRowBgClass = (status: IntelRow['_status']) => {
    switch (status) {
      case 'saving': return 'bg-muted/50';
      case 'saved': return 'bg-intel-emerald/10';
      case 'error': return 'bg-destructive/10';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold">Bulk Intel Entry</h2>
          <p className="text-xs text-muted-foreground">
            Add multiple intel items spreadsheet-style. Required: Title, Summary, URL, Source, Country
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="w-4 h-4" />
            Add Row
          </Button>
          <Button 
            size="sm" 
            onClick={saveAllRows} 
            disabled={saving}
            className="gap-1"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Spreadsheet */}
      <ScrollArea className="flex-1">
        <div className="min-w-[1800px]">
          {/* Column Headers */}
          <div className="grid grid-cols-[40px_180px_200px_120px_120px_100px_100px_100px_100px_100px_100px_80px_80px_80px_60px] gap-1 p-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground sticky top-0 z-10">
            <div className="px-1">#</div>
            <div className="px-1">Title *</div>
            <div className="px-1">Summary *</div>
            <div className="px-1">Source *</div>
            <div className="px-1">URL *</div>
            <div className="px-1">Country *</div>
            <div className="px-1">Region</div>
            <div className="px-1">Category</div>
            <div className="px-1">Threat</div>
            <div className="px-1">Confidence</div>
            <div className="px-1">Actor</div>
            <div className="px-1">Lat</div>
            <div className="px-1">Lon</div>
            <div className="px-1">Cred.</div>
            <div className="px-1"></div>
          </div>

          {/* Data Rows */}
          {rows.map((row, index) => (
            <div 
              key={row._id} 
              className={`grid grid-cols-[40px_180px_200px_120px_120px_100px_100px_100px_100px_100px_100px_80px_80px_80px_60px] gap-1 p-1 border-b border-border/50 ${getRowBgClass(row._status)}`}
            >
              <div className="flex items-center justify-center text-xs text-muted-foreground">
                {index + 1}
              </div>
              
              <Input
                value={row.title}
                onChange={(e) => updateRow(row._id, 'title', e.target.value)}
                placeholder="Title"
                className="h-8 text-xs"
                disabled={row._status === 'saving' || row._status === 'saved'}
              />
              
              <Input
                value={row.summary}
                onChange={(e) => updateRow(row._id, 'summary', e.target.value)}
                placeholder="Summary"
                className="h-8 text-xs"
                disabled={row._status === 'saving' || row._status === 'saved'}
              />
              
              <Input
                value={row.source}
                onChange={(e) => updateRow(row._id, 'source', e.target.value)}
                placeholder="Source"
                className="h-8 text-xs"
                disabled={row._status === 'saving' || row._status === 'saved'}
              />
              
              <Input
                value={row.url}
                onChange={(e) => updateRow(row._id, 'url', e.target.value)}
                placeholder="https://..."
                className="h-8 text-xs"
                disabled={row._status === 'saving' || row._status === 'saved'}
              />
              
              <Input
                value={row.country}
                onChange={(e) => updateRow(row._id, 'country', e.target.value)}
                placeholder="Country"
                className="h-8 text-xs"
                disabled={row._status === 'saving' || row._status === 'saved'}
              />
              
              <Select
                value={row.region}
                onValueChange={(value) => updateRow(row._id, 'region', value)}
                disabled={row._status === 'saving' || row._status === 'saved'}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {regions.map(r => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={row.category}
                onValueChange={(value) => updateRow(row._id, 'category', value as typeof row.category)}
                disabled={row._status === 'saving' || row._status === 'saved'}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={row.threatLevel}
                onValueChange={(value) => updateRow(row._id, 'threatLevel', value as ThreatLevel)}
                disabled={row._status === 'saving' || row._status === 'saved'}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {threatLevels.map(t => (
                    <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={row.confidenceLevel}
                onValueChange={(value) => updateRow(row._id, 'confidenceLevel', value as ConfidenceLevel)}
                disabled={row._status === 'saving' || row._status === 'saved'}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {confidenceLevels.map(c => (
                    <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={row.actorType}
                onValueChange={(value) => updateRow(row._id, 'actorType', value as ActorType)}
                disabled={row._status === 'saving' || row._status === 'saved'}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actorTypes.map(a => (
                    <SelectItem key={a} value={a} className="text-xs capitalize">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Input
                type="number"
                step="any"
                value={row.lat}
                onChange={(e) => updateRow(row._id, 'lat', parseFloat(e.target.value) || 0)}
                placeholder="Lat"
                className="h-8 text-xs"
                disabled={row._status === 'saving' || row._status === 'saved'}
              />
              
              <Input
                type="number"
                step="any"
                value={row.lon}
                onChange={(e) => updateRow(row._id, 'lon', parseFloat(e.target.value) || 0)}
                placeholder="Lon"
                className="h-8 text-xs"
                disabled={row._status === 'saving' || row._status === 'saved'}
              />
              
              <Select
                value={row.sourceCredibility}
                onValueChange={(value) => updateRow(row._id, 'sourceCredibility', value as SourceCredibility)}
                disabled={row._status === 'saving' || row._status === 'saved'}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceCredibilities.map(s => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeRow(row._id)}
                disabled={rows.length === 1 || row._status === 'saving'}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
        <span>{rows.length} row(s) | {rows.filter(isRowValid).length} valid</span>
        <span>Press Tab to move between cells</span>
      </div>
    </div>
  );
}
