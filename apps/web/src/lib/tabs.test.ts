import { describe, expect, it } from 'vitest';
import { getVisibleTabs } from './tabDefinitions';

describe('getVisibleTabs', () => {
  it('keeps all four destinations when faith is enabled', () => {
    expect(getVisibleTabs(true).map(({ to }) => to)).toEqual(['/', '/habits', '/prayers', '/more']);
  });

  it('removes only the faith destination when faith is disabled', () => {
    expect(getVisibleTabs(false).map(({ to }) => to)).toEqual(['/', '/habits', '/more']);
  });
});
