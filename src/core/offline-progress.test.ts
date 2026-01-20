/**
 * Tests for Offline Progress - Pure formatting functions
 *
 * These tests cover the pure functions in offline-progress.ts.
 * Store-dependent functions are not tested here as they require full store mocking.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDuration,
  formatRelativeTime,
  getMaxOfflineTimeString,
  getEfficiencyPercentString,
  MAX_OFFLINE_TIME_SECONDS,
  OFFLINE_EFFICIENCY_MULTIPLIER,
} from './offline-progress';

// ============================================================================
// formatDuration Tests
// ============================================================================

describe('formatDuration', () => {
  describe('seconds only (< 60s)', () => {
    it('should format 0 seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should format single digit seconds', () => {
      expect(formatDuration(5)).toBe('5s');
    });

    it('should format 59 seconds', () => {
      expect(formatDuration(59)).toBe('59s');
    });

    it('should floor fractional seconds', () => {
      expect(formatDuration(45.7)).toBe('45s');
    });
  });

  describe('minutes only (1-59m)', () => {
    it('should format exactly 1 minute', () => {
      expect(formatDuration(60)).toBe('1m');
    });

    it('should format 59 minutes', () => {
      expect(formatDuration(59 * 60)).toBe('59m');
    });

    it('should ignore remaining seconds when there are no hours', () => {
      // 5 minutes and 30 seconds = 330 seconds -> "5m"
      expect(formatDuration(5 * 60 + 30)).toBe('5m');
    });
  });

  describe('hours only', () => {
    it('should format exactly 1 hour', () => {
      expect(formatDuration(3600)).toBe('1h');
    });

    it('should format 8 hours', () => {
      expect(formatDuration(8 * 3600)).toBe('8h');
    });

    it('should format 24 hours', () => {
      expect(formatDuration(24 * 3600)).toBe('24h');
    });
  });

  describe('hours and minutes', () => {
    it('should format 1 hour 30 minutes', () => {
      expect(formatDuration(90 * 60)).toBe('1h 30m');
    });

    it('should format 2 hours 15 minutes', () => {
      expect(formatDuration(2 * 3600 + 15 * 60)).toBe('2h 15m');
    });

    it('should format 8 hours exactly (max offline time)', () => {
      expect(formatDuration(MAX_OFFLINE_TIME_SECONDS)).toBe('8h');
    });
  });

  describe('edge cases', () => {
    it('should handle very large durations', () => {
      // 100 hours = 360000 seconds
      expect(formatDuration(360000)).toBe('100h');
    });

    it('should handle duration at exactly 59 seconds', () => {
      expect(formatDuration(59)).toBe('59s');
    });

    it('should transition from seconds to minutes at 60s', () => {
      expect(formatDuration(59)).toBe('59s');
      expect(formatDuration(60)).toBe('1m');
    });

    it('should transition from minutes to hours at 3600s', () => {
      expect(formatDuration(3599)).toBe('59m');
      expect(formatDuration(3600)).toBe('1h');
    });
  });
});

// ============================================================================
// formatRelativeTime Tests
// ============================================================================

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('just now (< 60 seconds)', () => {
    it('should return "Just now" for 0 seconds ago', () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(now)).toBe('Just now');
    });

    it('should return "Just now" for 30 seconds ago', () => {
      const now = Date.now();
      const thirtySecondsAgo = now - 30 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(thirtySecondsAgo)).toBe('Just now');
    });

    it('should return "Just now" for 59 seconds ago', () => {
      const now = Date.now();
      const fiftyNineSecondsAgo = now - 59 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(fiftyNineSecondsAgo)).toBe('Just now');
    });
  });

  describe('minutes (1-59 minutes)', () => {
    it('should return "1m ago" for 1 minute ago', () => {
      const now = Date.now();
      const oneMinuteAgo = now - 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago');
    });

    it('should return "30m ago" for 30 minutes ago', () => {
      const now = Date.now();
      const thirtyMinutesAgo = now - 30 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30m ago');
    });

    it('should return "59m ago" for 59 minutes ago', () => {
      const now = Date.now();
      const fiftyNineMinutesAgo = now - 59 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59m ago');
    });
  });

  describe('hours (1-23 hours)', () => {
    it('should return "1h ago" for 1 hour ago', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');
    });

    it('should return "12h ago" for 12 hours ago', () => {
      const now = Date.now();
      const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(twelveHoursAgo)).toBe('12h ago');
    });

    it('should return "23h ago" for 23 hours ago', () => {
      const now = Date.now();
      const twentyThreeHoursAgo = now - 23 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h ago');
    });
  });

  describe('days (1-29 days)', () => {
    it('should return "1d ago" for 1 day ago', () => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');
    });

    it('should return "7d ago" for 1 week ago', () => {
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(oneWeekAgo)).toBe('7d ago');
    });

    it('should return "29d ago" for 29 days ago', () => {
      const now = Date.now();
      const twentyNineDaysAgo = now - 29 * 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(twentyNineDaysAgo)).toBe('29d ago');
    });
  });

  describe('months (1-11 months)', () => {
    it('should return "1mo ago" for 1 month ago', () => {
      const now = Date.now();
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(oneMonthAgo)).toBe('1mo ago');
    });

    it('should return "6mo ago" for 6 months ago', () => {
      const now = Date.now();
      const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(sixMonthsAgo)).toBe('6mo ago');
    });
  });

  describe('years', () => {
    it('should return "1y ago" for 1 year ago', () => {
      const now = Date.now();
      const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(oneYearAgo)).toBe('1y ago');
    });

    it('should return "2y ago" for 2 years ago', () => {
      const now = Date.now();
      const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000;
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(formatRelativeTime(twoYearsAgo)).toBe('2y ago');
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('MAX_OFFLINE_TIME_SECONDS', () => {
  it('should be 8 hours in seconds', () => {
    expect(MAX_OFFLINE_TIME_SECONDS).toBe(8 * 60 * 60);
  });
});

describe('OFFLINE_EFFICIENCY_MULTIPLIER', () => {
  it('should be 0.5 (50%)', () => {
    expect(OFFLINE_EFFICIENCY_MULTIPLIER.eq(0.5)).toBe(true);
  });
});

describe('getMaxOfflineTimeString', () => {
  it('should return "8 hours"', () => {
    expect(getMaxOfflineTimeString()).toBe('8 hours');
  });
});

describe('getEfficiencyPercentString', () => {
  it('should return "50%"', () => {
    expect(getEfficiencyPercentString()).toBe('50%');
  });
});
