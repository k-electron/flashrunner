// DISPOSABLE SCAFFOLD CONTENT — deleted by feature 001-deck-runs.
import { describe, expect, it } from 'vitest';
import { greeting } from '@/demo/greeting';

describe('greeting', () => {
  it('addresses the name it is given', () => {
    expect(greeting('Ada')).toBe('Hello, Ada!');
  });

  it('does not swallow an empty name', () => {
    expect(greeting('')).toBe('Hello, !');
  });
});
