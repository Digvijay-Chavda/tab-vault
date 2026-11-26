import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'TabVault',
    description: 'Fast, private tab and session manager with search. Suspends idle tabs, saves sessions, finds anything.',
    permissions: ['tabs', 'tabGroups', 'storage', 'alarms', 'sessions'],
    action: { default_title: 'Open TabVault' },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
        description: 'Open TabVault',
      },
    },
  },
});
