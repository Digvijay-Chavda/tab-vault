import { exportBackup, importBackup } from '../../core/data-io';
import { getSettings, saveSettings } from '../../core/settings';
import { formatGroupRules, parseGroupRules } from '../../core/settings-schema';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $('status');
const say = (msg: string) => {
  status.textContent = msg;
  setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 4000);
};

async function load(): Promise<void> {
  const s = await getSettings();
  $<HTMLInputElement>('idle').value = String(s.idleMinutes);
  $<HTMLInputElement>('pinned').checked = s.suspendPinned;
  $<HTMLInputElement>('audible').checked = s.suspendAudible;
  $<HTMLInputElement>('snapshots').checked = s.autoSnapshots;
  $<HTMLInputElement>('warndupes').checked = s.warnDuplicates;
  $<HTMLTextAreaElement>('whitelist').value = s.whitelist.join('\n');
  $<HTMLInputElement>('autogroup').checked = s.autoGroup;
  $<HTMLInputElement>('mingroup').value = String(s.minGroupSize);
  $<HTMLTextAreaElement>('grouprules').value = formatGroupRules(s.groupRules);
}

$('save').addEventListener('click', async () => {
  const saved = await saveSettings({
    idleMinutes: Number($<HTMLInputElement>('idle').value),
    suspendPinned: $<HTMLInputElement>('pinned').checked,
    suspendAudible: $<HTMLInputElement>('audible').checked,
    autoSnapshots: $<HTMLInputElement>('snapshots').checked,
    warnDuplicates: $<HTMLInputElement>('warndupes').checked,
    whitelist: $<HTMLTextAreaElement>('whitelist').value.split('\n'),
    autoGroup: $<HTMLInputElement>('autogroup').checked,
    minGroupSize: Number($<HTMLInputElement>('mingroup').value),
    groupRules: parseGroupRules($<HTMLTextAreaElement>('grouprules').value),
  });
  await load(); // show the sanitized values that were actually stored
  say(saved.idleMinutes === 0 ? 'Saved. Auto-suspend is off.' : 'Saved.');
});

$('export').addEventListener('click', async () => {
  const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `tabvault-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

$('import').addEventListener('click', () => $<HTMLInputElement>('file').click());
$<HTMLInputElement>('file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const r = await importBackup(await file.text());
    await load();
    say(`Imported ${r.sessions} sessions and ${r.workspaces} workspaces.`);
  } catch (err) {
    say(err instanceof Error ? err.message : 'Import failed.');
  }
});

void load();
