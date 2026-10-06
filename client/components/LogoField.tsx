'use client';

import { useRef, useState } from 'react';
import { Field, TextInput } from '@/components/ui';

/** Over this and the browser's own storage starts refusing to keep it. */
const MAX_BYTES = 400 * 1024;

/**
 * Pick a logo, from a file or a web address.
 *
 * A chosen file is read into a data URI and kept with the rest of the
 * settings, so the invoice prints the mark whether or not the shop is online
 * and without the app needing somewhere to upload to. That only works while
 * the file is small, hence the cap — a letterhead mark is a few tens of
 * kilobytes, and anything approaching half a megabyte is a photograph that
 * someone meant to crop.
 */
export function LogoField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  function choose(file?: File | null) {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('That is not an image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${Math.round(file.size / 1024)} KB. Keep it under 400 KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ''));
    reader.onerror = () => setError('That file could not be read.');
    reader.readAsDataURL(file);
  }

  return (
    <Field label={label} className="sm:col-span-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-[11px] font-semibold text-ink-400">No image</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button className="btn-soft !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
              Choose image…
            </button>
            {value && (
              <button
                className="btn-soft !py-1.5 text-xs text-rose-600"
                onClick={() => {
                  onChange('');
                  setError('');
                }}
              >
                Remove
              </button>
            )}
          </div>
          {/* Or point at one already on the web, which keeps the settings
              small and lets a designer change the file without touching this. */}
          <TextInput
            value={value.startsWith('data:') ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={value.startsWith('data:') ? 'Image chosen from this device' : 'or paste an image URL'}
            disabled={value.startsWith('data:')}
            className="input-sm w-72"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            // Cleared so choosing the same file twice still fires.
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="mt-1 text-[11px] font-semibold text-rose-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-[11px] text-ink-500">{hint}</p>}
    </Field>
  );
}
