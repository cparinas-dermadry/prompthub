'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { MapPinIcon, LocateFixedIcon, XIcon, Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSessionStore } from '@/store/session.store';
import { updateSession } from '@/lib/api';
import { COUNTRIES, countryNameForCode } from '@/lib/countries';
import type { PromptLocation } from '@prompthub/types';

interface LocationPickerProps {
  sessionId: string;
}

/**
 * Per-session "test from here" location picker.
 *
 * Mounted in the workspace header. Sets the session's `location` field via
 * PATCH /sessions/:id; every prompt sent under this session inherits it
 * server-side (invisible system framing + native web-search `user_location`
 * for search-capable models).
 *
 * The picker is NOT placed near the prompt input on purpose — location is a
 * per-session knob, not a per-prompt one. Two open sessions in different
 * tabs can hold different locations without clobbering each other.
 *
 * Save semantics:
 *   - "Apply" button persists the staged changes via updateSession + the
 *     optimistic patchSession store update.
 *   - "Clear" sends `location: null` to drop the session location entirely.
 *   - Closing the popover without clicking Apply discards staged changes.
 */
export function LocationPicker({ sessionId }: LocationPickerProps) {
  const { getToken } = useAuth();
  const current = useSessionStore((s) => s.currentSession?.location ?? null);
  const patchSession = useSessionStore((s) => s.patchSession);

  const [open, setOpen] = useState(false);
  // Staged form state — only committed to the store/server on Apply.
  // Resets to the current persisted value every time the popover opens.
  const [draft, setDraft] = useState<Partial<PromptLocation>>(() => current ?? {});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset draft to the persisted value every time the popover opens, so
  // half-finished edits from a prior visit don't leak in.
  const onOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setDraft(current ?? {});
        setError(null);
      }
      setOpen(next);
    },
    [current],
  );

  const chipLabel = useMemo(() => {
    if (!current) return 'No location';
    return (
      current.label ??
      [current.city, current.region, countryNameForCode(current.country)]
        .filter(Boolean)
        .join(', ')
    );
  }, [current]);

  /**
   * Browser geolocation → BigDataCloud reverse-geocode → fill the form.
   * BigDataCloud's client endpoint is keyless and returns countryCode,
   * principalSubdivision (region), and city. We discard precise lat/lng
   * after the reverse-geocode call — they're never persisted.
   */
  const useMyLocation = useCallback(() => {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          if (!res.ok) throw new Error(`Reverse-geocode HTTP ${res.status}`);
          const json = (await res.json()) as {
            countryCode?: string;
            principalSubdivision?: string;
            city?: string;
            locality?: string;
          };
          const country = (json.countryCode ?? '').toUpperCase();
          if (!country || country.length !== 2) {
            throw new Error('Reverse-geocode returned no country code');
          }
          const tz =
            Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
          setDraft({
            country,
            region: json.principalSubdivision || undefined,
            city: json.city || json.locality || undefined,
            timezone: tz,
          });
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'Could not resolve your location.',
          );
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(err.message || 'Location permission denied.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }, []);

  const apply = useCallback(async () => {
    setError(null);
    const country = (draft.country ?? '').trim().toUpperCase();
    if (!country || country.length !== 2 || !/^[A-Z]{2}$/.test(country)) {
      setError('Country is required (2-letter ISO code, e.g. SG, US, PH).');
      return;
    }

    // Auto-fill a sensible label if the user didn't supply one.
    const labelFallback = [
      draft.city,
      draft.region,
      countryNameForCode(country),
    ]
      .filter(Boolean)
      .join(', ');

    const next: PromptLocation = {
      country,
      ...(draft.region ? { region: draft.region } : {}),
      ...(draft.city ? { city: draft.city } : {}),
      ...(draft.timezone ? { timezone: draft.timezone } : {}),
      label: draft.label?.trim() || labelFallback,
    };

    setSaving(true);
    // Optimistic local update so the chip changes instantly even before the
    // PATCH resolves. If the server rejects we roll back below.
    const previous = current;
    patchSession({ location: next });
    try {
      await updateSession(getToken, sessionId, { location: next });
      setOpen(false);
    } catch (e) {
      patchSession({ location: previous });
      setError(e instanceof Error ? e.message : 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  }, [draft, current, getToken, patchSession, sessionId]);

  const clear = useCallback(async () => {
    setError(null);
    setSaving(true);
    const previous = current;
    patchSession({ location: null });
    try {
      await updateSession(getToken, sessionId, { location: null });
      setDraft({});
      setOpen(false);
    } catch (e) {
      patchSession({ location: previous });
      setError(e instanceof Error ? e.message : 'Failed to clear location.');
    } finally {
      setSaving(false);
    }
  }, [current, getToken, patchSession, sessionId]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-navy font-semibold hover:text-navy hover:bg-surface"
          />
        }
      >
        <MapPinIcon className="h-4 w-4" />
        <span className="max-w-[180px] truncate">{chipLabel}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Test from a location</PopoverTitle>
          <PopoverDescription>
            Every prompt in this session is sent as if from here. Your typed
            message is never changed.
          </PopoverDescription>
        </PopoverHeader>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium">Country</label>
          <select
            value={draft.country ?? ''}
            onChange={(e) =>
              setDraft((d) => ({ ...d, country: e.target.value || undefined }))
            }
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="">— Select a country —</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
          {draft.country && !COUNTRIES.some((c) => c.code === draft.country) && (
            <p className="text-xs text-muted-foreground">
              Using custom ISO-2 code “{draft.country}”.
            </p>
          )}

          <label className="mt-1 text-xs font-medium">Region (optional)</label>
          <Input
            value={draft.region ?? ''}
            placeholder="e.g. Ontario, NSW"
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                region: e.target.value || undefined,
              }))
            }
          />

          <label className="mt-1 text-xs font-medium">City (optional)</label>
          <Input
            value={draft.city ?? ''}
            placeholder="e.g. Toronto, Manila"
            onChange={(e) =>
              setDraft((d) => ({ ...d, city: e.target.value || undefined }))
            }
          />

          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="gap-1.5"
          >
            {locating ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixedIcon className="h-4 w-4" />
            )}
            {locating ? 'Locating…' : 'Use my location'}
          </Button>

          {error && (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={clear}
              disabled={saving || !current}
              className="gap-1 text-muted-foreground"
            >
              <XIcon className="h-4 w-4" />
              Clear
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={apply}
                disabled={saving || !draft.country}
              >
                {saving ? 'Saving…' : 'Apply'}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
