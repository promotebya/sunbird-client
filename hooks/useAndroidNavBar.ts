// hooks/useAndroidNavBar.ts
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { useTokens } from '../components/ThemeProvider';

export default function useAndroidNavBar(ready?: boolean) {
  const t = useTokens();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!ready) return; // ⬅️ wait until NavigationContainer is ready

    let mounted = true;

    const run = async () => {
      try {
        // Wait until JS & animations settle to avoid visual flashes
        await InteractionManager.runAfterInteractions();

        if (!mounted) return;

        // 1) Background first so no white strip shows
        await NavigationBar.setBackgroundColorAsync?.(t.colors.bg || '#FFFFFF').catch(() => {});

        // 2) Behavior: choose the safest option for old devices
        // (inset-touch is broadly compatible; overlay-swipe/inset-swipe can be finicky)
        await (NavigationBar as any).setBehaviorAsync?.('inset-touch').catch(() => {});

        // 3) Make sure it's visible (some ROMs default to transient)
        await (NavigationBar as any).setVisibilityAsync?.('visible').catch(() => {});

        // 4) Button style for contrast
        const preferLightIcons =
          typeof (t as any).isDark === 'boolean' ? (t as any).isDark : false;
        await (NavigationBar as any).setButtonStyleAsync?.(
          preferLightIcons ? 'light' : 'dark'
        ).catch(() => {});
      } catch {
        // Never block render if any vendor ROM API fails
      }
    };

    const id = setTimeout(run, 100); // give the first frame a beat
    return () => {
      mounted = false;
      clearTimeout(id);
    };
  }, [ready, t.colors.bg]);
}