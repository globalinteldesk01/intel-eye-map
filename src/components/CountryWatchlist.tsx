import { useState } from 'react';
import { useCountryWatchlist } from '@/hooks/useCountryWatchlist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Globe, X, Plus, Search, MapPin } from 'lucide-react';

export function CountryWatchlist() {
  const { watchlist, activeCountries, addCountry, removeCountry, toggleCountry, allCountries, loading } = useCountryWatchlist();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const watchedNames = watchlist.map(w => w.country_name);
  const availableCountries = allCountries.filter(
    c => !watchedNames.includes(c) && c.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-white/80 hover:text-white hover:bg-white/10">
          <Globe className="h-4 w-4" />
          <span className="hidden md:inline">
            {activeCountries.length > 0 ? `${activeCountries.length} Countries` : 'All Countries'}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-[hsl(222,47%,11%)] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <MapPin className="h-5 w-5 text-cyan-400" />
            Country Watchlist
          </DialogTitle>
          <p className="text-sm text-white/50">
            {activeCountries.length === 0
              ? 'You receive alerts for ALL countries. Add countries below to filter.'
              : `Alerts are filtered to ${activeCountries.length} countries.`}
          </p>
        </DialogHeader>

        {/* Current watchlist */}
        {watchlist.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Your Watchlist</h4>
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {watchlist.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(checked) => toggleCountry(item.id, checked)}
                        className="scale-75"
                      />
                      <span className={`text-sm ${item.is_active ? 'text-white' : 'text-white/40 line-through'}`}>
                        {item.country_name}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCountry(item.id)}
                      className="h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-transparent"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Add countries */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Add Countries</h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <ScrollArea className="max-h-48">
            <div className="flex flex-wrap gap-1.5 p-1">
              {availableCountries.map(country => (
                <Badge
                  key={country}
                  variant="outline"
                  className="cursor-pointer border-white/20 text-white/60 hover:border-cyan-400 hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                  onClick={() => addCountry(country)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {country}
                </Badge>
              ))}
              {availableCountries.length === 0 && (
                <p className="text-xs text-white/30 p-2">No countries match your search.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
