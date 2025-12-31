import { Pipe, PipeTransform } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';

type LocalDateFormat = 'medium' | 'short' | 'yyyy/MM/dd' | 'yyyy/MM/dd HH:mm';

type NormalizedTemporal =
  | { readonly kind: 'instant'; readonly instant: Temporal.Instant }
  | { readonly kind: 'date'; readonly date: Temporal.PlainDate };

@Pipe({
  name: 'localDateTime',
})
export class LocalDateTimePipe implements PipeTransform {
  private static readonly midnight = Temporal.PlainTime.from('00:00');

  transform(value: unknown, format: LocalDateFormat = 'medium', timeZone?: string): string {
    const normalized = this.normalize(value);
    if (!normalized) {
      return '';
    }

    const zone = this.resolveTimeZone(timeZone);

    switch (format) {
      case 'yyyy/MM/dd':
        return this.formatDate(normalized, zone);
      case 'yyyy/MM/dd HH:mm':
        return this.formatDateTime(normalized, zone);
      case 'short':
        return this.formatShort(normalized, zone);
      case 'medium':
      default:
        return this.formatMedium(normalized, zone);
    }
  }

  private normalize(value: unknown): NormalizedTemporal | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? null
        : { kind: 'instant', instant: Temporal.Instant.from(value.toISOString()) };
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return null;
      }

      if (trimmed.includes('T')) {
        return this.parseDateTime(trimmed);
      }

      try {
        return { kind: 'date', date: Temporal.PlainDate.from(trimmed) };
      } catch {
        return this.parseDateTime(trimmed);
      }
    }

    return null;
  }

  private parseDateTime(value: string): NormalizedTemporal | null {
    try {
      return { kind: 'instant', instant: Temporal.Instant.from(value) };
    } catch {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      return { kind: 'instant', instant: Temporal.Instant.from(parsed.toISOString()) };
    }
  }

  private resolveTimeZone(preferred?: string): string {
    if (preferred && preferred.trim().length > 0) {
      return preferred;
    }

    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolved && resolved.trim().length > 0) {
        return resolved;
      }
    } catch {
      // Ignore resolution errors and fall back to UTC below.
    }

    return 'UTC';
  }

  private formatDate(value: NormalizedTemporal, timeZone: string): string {
    if (value.kind === 'date') {
      return this.composeDate(value.date.year, value.date.month, value.date.day);
    }

    const zoned = value.instant.toZonedDateTimeISO(timeZone);
    const date = zoned.toPlainDate();
    return this.composeDate(date.year, date.month, date.day);
  }

  private formatDateTime(value: NormalizedTemporal, timeZone: string): string {
    const zoned = this.ensureZoned(value, timeZone);
    return `${this.pad(zoned.year, 4)}/${this.pad(zoned.month)}/${this.pad(zoned.day)} ${this.pad(zoned.hour)}:${this.pad(zoned.minute)}`;
  }

  private formatMedium(value: NormalizedTemporal, timeZone: string): string {
    const zoned = this.ensureZoned(value, timeZone);
    return zoned.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  private formatShort(value: NormalizedTemporal, timeZone: string): string {
    const zoned = this.ensureZoned(value, timeZone);
    return zoned.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }

  private ensureZoned(value: NormalizedTemporal, timeZone: string): Temporal.ZonedDateTime {
    if (value.kind === 'instant') {
      return value.instant.toZonedDateTimeISO(timeZone);
    }

    return value.date.toZonedDateTime({ timeZone, plainTime: LocalDateTimePipe.midnight });
  }

  private composeDate(year: number, month: number, day: number): string {
    return `${this.pad(year, 4)}/${this.pad(month)}/${this.pad(day)}`;
  }

  private pad(value: number, length = 2): string {
    return value.toString().padStart(length, '0');
  }
}
