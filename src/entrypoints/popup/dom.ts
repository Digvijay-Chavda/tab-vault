// Shared popup helpers. Everything here builds DOM with textContent / static SVG only: page titles and URLs are untrusted.

// ---------- icons: static, hard-coded SVG markup only (never built from page data) ----------
const ICONS = {
  logo: '<path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z"/><path d="M12 11v9M4 7.5l8 3.5 8-3.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  group: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="6" rx="1.5"/><rect x="14" y="14" width="7" height="6" rx="1.5"/>',
  ungroup: '<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/><path d="M14 7h7M3 17h7"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  pin: '<path d="M12 17v5M8 3h8l-1.5 7 3 3H6.5l3-3z"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  empty: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  stash: '<path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4"/>',
  note: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  sort: '<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  windows: '<rect x="3" y="5" width="12" height="10" rx="1.5"/><path d="M9 19h10a2 2 0 0 0 2-2V9"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/>',
  cmd: '<path d="m5 8 4 4-4 4M12 17h7"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
} as const;
export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name]; // static constants above; nothing user-controlled reaches here
  return svg;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
}

export function button(label: string, onClick: () => void | Promise<void>, opts: { title?: string; cls?: string; icon?: IconName } = {}): HTMLButtonElement {
  const b = el('button', { title: opts.title ?? label, className: opts.cls ?? '' });
  if (opts.icon) b.append(icon(opts.icon));
  b.append(label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    void onClick();
  });
  return b;
}

export function iconButton(name: IconName, label: string, onClick: (anchor: HTMLButtonElement) => void | Promise<void>, opts: { cls?: string; pressed?: boolean } = {}): HTMLButtonElement {
  const b = el('button', { title: label, className: opts.cls ?? '', ariaLabel: label });
  if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
  b.append(icon(name));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    void onClick(b);
  });
  return b;
}

// ---------- pop-up menu ----------
export interface MenuItem {
  label: string;
  run: () => void | Promise<void>;
  icon?: IconName;
  danger?: boolean;
}

let closeMenu: (() => void) | undefined;

/** Opens a small menu next to `anchor`. Closes on outside click, Escape, or choosing an item. */
export function openMenu(anchor: HTMLElement, items: MenuItem[]): void {
  closeMenu?.();
  const menu = el('div', { className: 'menu', role: 'menu' });
  const close = () => {
    menu.remove();
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    closeMenu = undefined;
  };
  const onOutside = (e: Event) => { if (!menu.contains(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  for (const it of items) {
    const b = el('button', { className: it.danger ? 'danger' : '', role: 'menuitem' });
    if (it.icon) b.append(icon(it.icon));
    b.append(it.label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      void it.run();
    });
    menu.append(b);
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(6, Math.min(window.innerWidth - m.width - 6, r.right - m.width))}px`;
  menu.style.top = `${r.bottom + m.height + 6 > window.innerHeight ? Math.max(6, r.top - m.height - 4) : r.bottom + 4}px`;
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
  closeMenu = close;
  menu.querySelector('button')?.focus();
}

// ---------- inline form dialog (prompt() is unreliable inside extension popups) ----------
export interface Field {
  label: string;
  value?: string;
  placeholder?: string;
  /** A fixed list turns the field into a dropdown; the value returned is the option's `value`. */
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
}

/** Resolves with the field values in order, or null when cancelled. */
export function askForm(title: string, fields: Field[], submit = 'Save'): Promise<string[] | null> {
  return new Promise((resolve) => {
    const inputs = fields.map((f) => {
      if (f.options) {
        const sel = el('select', { ariaLabel: f.label }, ...f.options.map((o) => el('option', { value: o.value, textContent: o.label })));
        sel.value = f.value ?? f.options[0]!.value;
        return sel;
      }
      return el('input', { type: 'text', value: f.value ?? '', placeholder: f.placeholder ?? '', maxLength: f.maxLength ?? 200, ariaLabel: f.label });
    });
    const form = el('form', { className: 'dialog', role: 'dialog', ariaLabel: title },
      el('h3', { textContent: title }),
      ...fields.flatMap((f, i) => [el('label', { textContent: f.label }), inputs[i]!]),
      el('div', { className: 'dialog-actions' },
        el('button', { type: 'button', textContent: 'Cancel' }),
        el('button', { type: 'submit', textContent: submit, className: 'primary' }),
      ),
    );
    const overlay = el('div', { className: 'overlay' }, form);
    const done = (v: string[] | null) => { overlay.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    form.addEventListener('submit', (e) => { e.preventDefault(); done(inputs.map((i) => i.value)); });
    form.querySelector<HTMLButtonElement>('button[type=button]')!.addEventListener('click', () => done(null));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) done(null); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    inputs[0]?.focus();
    if (inputs[0] instanceof HTMLInputElement) inputs[0].select();
  });
}
