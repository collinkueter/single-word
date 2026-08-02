import { useEffect } from 'react';
import * as Updates from 'expo-updates';

export function useOTAUpdate() {
  useEffect(() => {
    if (!Updates.isEnabled) return;

    async function checkAndApply() {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Network unavailable or update server unreachable — silently ignore
      }
    }

    checkAndApply();
  }, []);
}
