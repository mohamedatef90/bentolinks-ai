import React, { useState } from 'react';
import { FilterState, SourceType } from '../types';

interface FilterBarProps {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  availableTags: string[];
  availableTopics: string[];
  onSaveAsSmartCollection: (name: string) => void;
}

const SOURCE_TYPES: SourceType[] = ['article', 'youtube', 'reel', 'tweet', 'pdf', 'rss', 'reddit', 'podcast', 'other'];
const READ_STATUSES: FilterState['read_status'] = ['unread', 'reading', 'read'];
const SORTS: { value: NonNullable<FilterState['sort']>; label: string }[] = [
  { value: 'date_desc', label: 'Newest' },
  { value: 'date_asc', label: 'Oldest' },
  { value: 'title_asc', label: 'Title A-Z' },
];

const chipClass = (active: boolean) =>
  `px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
    active ? 'bg-neon-accent text-black' : 'bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10'
  }`;

function toggleInArray<T>(arr: T[] | undefined, value: T): T[] | undefined {
  const next = arr?.includes(value) ? arr.filter(v => v !== value) : [...(arr ?? []), value];
  return next.length ? next : undefined;
}

const FilterBar: React.FC<FilterBarProps> = ({ filter, onChange, availableTags, availableTopics, onSaveAsSmartCollection }) => {
  const [savingName, setSavingName] = useState<string | null>(null);

  const hasActiveFilters = !!(
    filter.source_type?.length || filter.read_status?.length || filter.tags?.length ||
    filter.topic || filter.is_starred
  );

  const submitSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savingName?.trim()) return;
    onSaveAsSmartCollection(savingName.trim());
    setSavingName(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {SOURCE_TYPES.map(type => (
          <button key={type} onClick={() => onChange({ ...filter, source_type: toggleInArray(filter.source_type, type) })}
            className={chipClass(!!filter.source_type?.includes(type))}>
            {type}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {READ_STATUSES!.map(status => (
          <button key={status} onClick={() => onChange({ ...filter, read_status: toggleInArray(filter.read_status, status) })}
            className={chipClass(!!filter.read_status?.includes(status))}>
            {status}
          </button>
        ))}
        <button onClick={() => onChange({ ...filter, is_starred: !filter.is_starred || undefined })}
          className={chipClass(!!filter.is_starred)}>
          <i className="fa-solid fa-star mr-1.5 text-[9px]"></i>Starred
        </button>

        {availableTopics.length > 0 && (
          <select
            value={filter.topic || ''}
            onChange={(e) => onChange({ ...filter, topic: e.target.value || undefined })}
            className="bg-white/5 border border-white/5 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 focus:outline-none cursor-pointer"
          >
            <option value="">All topics</option>
            {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <div className="ml-auto flex items-center gap-3">
          <select
            value={filter.sort || 'date_desc'}
            onChange={(e) => onChange({ ...filter, sort: e.target.value as FilterState['sort'] })}
            className="bg-white/5 border border-white/5 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 focus:outline-none cursor-pointer"
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {hasActiveFilters && (
            savingName === null ? (
              <button
                onClick={() => setSavingName('')}
                className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all whitespace-nowrap"
              >
                <i className="fa-solid fa-bookmark mr-1.5 text-[9px]"></i>Save as Smart Collection
              </button>
            ) : (
              <form onSubmit={submitSave} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={savingName}
                  onChange={(e) => setSavingName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setSavingName(null)}
                  placeholder="Collection name"
                  className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-[10px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-neon-accent w-40"
                />
                <button type="submit" className="px-3 py-2 rounded-full bg-neon-accent text-black text-[10px] font-black uppercase">Save</button>
                <button type="button" onClick={() => setSavingName(null)} className="px-3 py-2 text-zinc-600 hover:text-white text-[10px] font-black uppercase">Cancel</button>
              </form>
            )
          )}
        </div>
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {availableTags.slice(0, 24).map(tag => (
            <button key={tag} onClick={() => onChange({ ...filter, tags: toggleInArray(filter.tags, tag) })}
              className={`px-3 py-1 rounded-full text-[9px] font-bold lowercase tracking-wide transition-all ${
                filter.tags?.includes(tag) ? 'bg-neon-accent text-black' : 'bg-white/[0.04] text-zinc-500 hover:text-white'
              }`}>
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
