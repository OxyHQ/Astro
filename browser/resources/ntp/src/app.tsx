import {View, Text} from 'react-native';
import {BloomThemeProvider} from '@oxyhq/bloom/theme';
import {Button} from '@oxyhq/bloom';

// BloomThemeProvider wraps everything, including any loading branch.
// useTheme() throws when called outside it, and Bloom components call it
// internally -- so a provider mounted below a component that renders first is
// a runtime crash that no build or type check reports.
export function App() {
  return (
    <BloomThemeProvider mode="system" colorPreset="oxy">
      <View className="flex-1 items-center justify-center gap-6 p-8">
        <Text className="text-3xl font-semibold">Astro</Text>
        <Text className="text-base opacity-60">
          New tab, built with Bloom.
        </Text>
        <Button onPress={() => { window.location.href = 'astro://settings/'; }}>
          Open settings
        </Button>
      </View>
    </BloomThemeProvider>
  );
}
