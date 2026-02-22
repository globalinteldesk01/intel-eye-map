import { useState } from 'react';
import { NewsItem } from '@/types/news';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, MapPin, Clock, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { getViewableUrl } from '@/utils/urlUtils';

interface NewsListProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
}

const categoryColors: Record<string, string> = {
  security: 'bg-intel-cyan/20 text-intel-cyan border-intel-cyan/30',
  diplomacy: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  economy: 'bg-intel-emerald/20 text-intel-emerald border-intel-emerald/30',
  conflict: 'bg-intel-red/20 text-red-400 border-intel-red/30',
  humanitarian: 'bg-intel-amber/20 text-intel-amber border-intel-amber/30',
  technology: 'bg-intel-purple/20 text-purple-400 border-intel-purple/30',
};

const getConfidenceColor = (score: number) => {
  if (score >= 0.9) return 'text-intel-emerald';
  if (score >= 0.7) return 'text-intel-amber';
  return 'text-intel-red';
};

export function NewsList({ newsItems, onSelectItem, selectedItem }: NewsListProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : newsItems.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < newsItems.length - 1 ? prev + 1 : 0));
  };

  if (newsItems.length === 0) {
    return (
      <div className="intel-card h-full flex flex-col items-center justify-center">
        <p className="text-muted-foreground">No news items found</p>
      </div>
    );
  }

  const item = newsItems[currentIndex];

  return (
    <div className="intel-card h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" />
            Intel Feed
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            {currentIndex + 1} / {newsItems.length}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4">
        <article
          onClick={() => onSelectItem(item)}
          className={`flex-1 p-4 rounded-lg cursor-pointer transition-all ${
            selectedItem?.id === item.id
              ? 'bg-primary/10 border border-primary/30'
              : 'bg-secondary/30 border border-transparent hover:bg-secondary/50 hover:border-border'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <Badge
              variant="outline"
              className={`text-[10px] uppercase tracking-wider ${categoryColors[item.category]}`}
            >
              {item.category}
            </Badge>
            <span className={`text-[10px] font-mono ${getConfidenceColor(item.confidenceScore)}`}>
              {Math.round(item.confidenceScore * 100)}%
            </span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-base leading-tight mb-3">
            {item.title}
          </h3>

          {/* Summary */}
          <p className="text-sm text-muted-foreground mb-4">
            {item.summary}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {item.country}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
              </span>
            </div>
            <span className="font-mono">{item.source}</span>
          </div>

          {/* Source Link */}
          <a
            href={getViewableUrl(item.url, item.title, item.source)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            View Source
          </a>
        </article>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex gap-1">
            {newsItems.slice(0, Math.min(5, newsItems.length)).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
            {newsItems.length > 5 && (
              <span className="text-xs text-muted-foreground ml-1">...</span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNext}
            className="gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
