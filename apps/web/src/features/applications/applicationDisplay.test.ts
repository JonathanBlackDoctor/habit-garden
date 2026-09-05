import { describe, expect, it } from 'vitest';
import type { ApplicationDoc } from 'shared/types/firestore';
import { groupApplicationsByStatus } from './applicationDisplay';

const application = (id: string, status: ApplicationDoc['status']) => ({ id, status });

describe('groupApplicationsByStatus', () => {
  it('keeps every saved status visible in its editorial group', () => {
    const grouped = groupApplicationsByStatus([
      application('active', 'active'),
      application('settled', 'completed'),
      application('paused', 'lapsed'),
      application('archived', 'archived'),
    ]);

    expect(grouped.active.map(({ id }) => id)).toEqual(['active']);
    expect(grouped.settled.map(({ id }) => id)).toEqual(['settled']);
    expect(grouped.paused.map(({ id }) => id)).toEqual(['paused']);
    expect(grouped.archived.map(({ id }) => id)).toEqual(['archived']);
  });

  it('returns empty groups without requiring data migration', () => {
    expect(groupApplicationsByStatus([])).toEqual({ active: [], settled: [], paused: [], archived: [] });
  });
});
