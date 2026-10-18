import { describe, expect, it } from 'vitest';
import { getVisibleTabs } from './tabDefinitions';

describe('getVisibleTabs', () => {
  it('keeps all four destinations when faith is enabled', () => {
    expect(getVisibleTabs(true).map(({ to }) => to)).toEqual(['/', '/habits', '/prayers', '/more']);
  });

  it('removes only the faith destination when faith is disabled', () => {
    expect(getVisibleTabs(false).map(({ to }) => to)).toEqual(['/', '/habits', '/more']);
  });

  it('shows only habits and prayer in the editorial design', () => {
    expect(getVisibleTabs(true, 'editorial').map(({ to, label }) => ({ to, label }))).toEqual([
      { to: '/', label: '습관' },
      { to: '/prayers', label: '기도' },
    ]);
  });

  it('shows only habits in editorial mode when prayer is disabled', () => {
    expect(getVisibleTabs(false, 'editorial').map(({ to }) => to)).toEqual(['/']);
  });

  it('preserves all classic destinations explicitly', () => {
    expect(getVisibleTabs(true, 'classic').map(({ to }) => to)).toEqual(['/', '/habits', '/prayers', '/more']);
  });
});
