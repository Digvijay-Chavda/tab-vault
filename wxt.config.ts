import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: ({ browser }) => ({
    name: 'TabVault',
    description: 'Fast, private tab and session manager with search. Suspends idle tabs, saves sessions, finds anything.',
    // Firefox has no tabGroups permission; the code checks for the API before using it.
    permissions: ['tabs', ...(browser === 'firefox' ? [] : ['tabGroups']), 'storage', 'alarms', 'sessions', 'downloads'],
    action: { default_title: 'Open TabVault' },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' },
        description: 'Open TabVault',
      },
      'stash-tab': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Stash the current tab (save it for later and close it)',
      },
      panic: {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Panic: suspend every tab except the active ones',
      },
      'group-tabs': {
        suggested_key: { default: 'Alt+Shift+G' },
        description: 'Group this window\'s tabs',
      },
    },
    ...(browser === 'firefox' ? { browser_specific_settings: { gecko: { id: 'tabvault@digvijay-chavda.github.io', strict_min_version: '128.0' } } } : {}),
  }),
});
