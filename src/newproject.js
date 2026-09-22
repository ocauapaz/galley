// "New project" dialog: template, name and location. Resolves { name, location, tpl } or null.
import { documentDir } from '@tauri-apps/api/path'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { TEMPLATES } from './snippets.js'
import { h, esc, modal } from './ui.js'

export async function askNewProject() {
  const docs = await documentDir().catch(() => '')
  return modal('New project', close => {
    let tpl = TEMPLATES[0].id
    const name = h('input.input', { value: 'my-document', 'aria-label': 'Project name', spellcheck: false, autofocus: true })
    const loc = h('input.input', { value: docs, 'aria-label': 'Location', spellcheck: false })
    const err = h('div.field-error', { role: 'alert' })
    const cards = h('div.tpl-grid', { role: 'radiogroup', 'aria-label': 'Template' }, TEMPLATES.map(t => h('button.tpl-card', {
      role: 'radio', 'aria-checked': String(t.id === tpl), 'data-tpl': t.id,
      html: `<span class="tpl-page" aria-hidden="true"><i></i><i></i><i></i><i></i></span><strong>${esc(t.name)}</strong><small>${esc(t.desc)}</small>`,
      on: { click: e => { tpl = t.id; cards.querySelectorAll('.tpl-card').forEach(c => c.setAttribute('aria-checked', String(c === e.currentTarget))) } },
    })))
    const submit = () => {
      const n = name.value.trim(), l = loc.value.trim()
      if (!n || /[<>:"/\\|?*]/.test(n)) { err.textContent = 'Choose a valid folder name.'; return }
      if (!l) { err.textContent = 'Choose where to create the project.'; return }
      close({ name: n, location: l, tpl })
    }
    name.addEventListener('keydown', e => { if (e.key === 'Enter') submit() })
    return h('div.new-project', {},
      h('label.field-label', { text: 'Template' }), cards,
      h('label.field-label', { text: 'Project name' }), name,
      h('label.field-label', { text: 'Location' }),
      h('div.path-field', {}, loc, h('button.btn', { text: 'Browse…', on: { click: async () => {
        const p = await openDialog({ directory: true, defaultPath: loc.value || undefined })
        if (p) loc.value = p
      } } })),
      err,
      h('div.modal-actions', {}, h('button.btn', { text: 'Cancel', on: { click: () => close(null) } }), h('button.btn.primary', { text: 'Create project', on: { click: submit } })))
  }, { wide: true })
}
