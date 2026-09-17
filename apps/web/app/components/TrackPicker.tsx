'use client';

import React, { useState, useRef, useEffect } from 'react';
import { searchTracks, Track } from '../lib/tracks';

interface TrackPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TrackPicker({ value, onChange, placeholder = 'Search track...' }: TrackPickerProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      setResults(searchTracks(query));
      setActiveIndex(-1);
    }
  }, [query, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    onChange(e.target.value); // fallback so user can still type any value
  };

  const handleSelect = (trackName: string) => {
    setQuery(trackName);
    onChange(trackName);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex].name);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getCountryFlag = (country: string) => (country === 'AU' ? '🇦🇺' : '🇳🇿');
  const getTypeIcon = (type: string) => {
    if (type === 'greyhound') return '🐕';
    if (type === 'harness') return '🏇';
    return '🐎';
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-background py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {results.map((track, idx) => (
            <li
              key={track.id}
              className={`cursor-pointer select-none px-3 py-2 text-foreground flex items-center justify-between hover:bg-accent hover:text-accent-foreground ${activeIndex === idx ? 'bg-accent text-accent-foreground' : ''}`}
              onClick={() => handleSelect(track.name)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <div className="flex items-center gap-2">
                <span>{track.name}</span>
                <span className="text-xs text-muted-foreground">{track.state}</span>
              </div>
              <div className="flex gap-1 opacity-80">
                <span title={track.type}>{getTypeIcon(track.type)}</span>
                <span title={track.country}>{getCountryFlag(track.country)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
