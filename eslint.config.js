// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // RSVPReader drives playback on the UI thread with Reanimated shared values,
    // which are mutated via `.value =` by design. The React Compiler rules that
    // eslint-config-expo 57 enables (react-hooks/immutability, set-state-in-effect)
    // flag this idiomatic Reanimated usage as illegal mutation. Relax them here
    // only — they stay fully enforced everywhere else.
    files: ["src/components/RSVPReader.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "warn",
    },
  }
]);
