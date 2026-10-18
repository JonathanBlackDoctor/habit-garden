import { useFaithEnabled, useUiDesign } from '@/lib/features';
import { getVisibleTabs, type TabDef } from '@/lib/tabDefinitions';

export type { TabDef } from '@/lib/tabDefinitions';

export function useVisibleTabs(): TabDef[] {
  const faithEnabled = useFaithEnabled();
  const uiDesign = useUiDesign();
  return getVisibleTabs(faithEnabled, uiDesign);
}
