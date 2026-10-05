'use client'

import { useState, useEffect } from 'react'
import { Info, Edit2, Save, X, Plus } from 'lucide-react'

// Sellout ▸ Süpervizör / Jr. Süpervizör / Merch sekmelerinde aylık açıklama notu.
// Not, seçili dönem + sekmeye aittir; sayfayı gören herkes okur, yalnızca admin düzenler.
export function SelloutAciklama({
  donem, sekme, isAdmin, profileId,
}: {
  donem: string
  sekme: 'sup' | 'jr' | 'merch'
  isAdmin: boolean
  profileId: string
}) {
  const [metin, setMetin] = useState('')
  const [edit, setEdit] = useState(false)
  const [taslak, setTaslak] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let iptal = false
    setEdit(false)
    setMetin('')
    fetch(`/api/sellout-aciklama?donem=${donem}&sekme=${sekme}`)
      .then(r => r.json())
      .then(d => { if (!iptal) setMetin(d.metin ?? '') })
      .catch(() => { if (!iptal) setMetin('') })
    return () => { iptal = true }
  }, [donem, sekme])

  const kaydet = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sellout-aciklama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donem, sekme, metin: taslak, updated_by: profileId }),
      })
      if (res.ok) {
        setMetin(taslak.trim())
        setEdit(false)
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Kaydedilemedi')
      }
    } finally {
      setSaving(false)
    }
  }

  if (edit) {
    return (
      <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
        <textarea
          value={taslak}
          onChange={e => setTaslak(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Bu dönem için açıklama / not…"
          className="w-full text-xs border border-amber-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:border-amber-400 resize-y"
        />
        <div className="mt-1.5 flex justify-end gap-1.5">
          <button
            onClick={() => setEdit(false)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
          >
            <X size={11} /> İptal
          </button>
          <button
            onClick={kaydet}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-brand-700 text-white rounded-md hover:bg-brand-600 disabled:opacity-60"
          >
            <Save size={11} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    )
  }

  if (!metin) {
    if (!isAdmin) return null
    return (
      <button
        onClick={() => { setTaslak(''); setEdit(true) }}
        className="mb-2 flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-700"
      >
        <Plus size={11} /> Açıklama ekle
      </button>
    )
  }

  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <Info size={13} className="mt-0.5 flex-none text-amber-600" />
      <p className="flex-1 text-xs text-amber-900 whitespace-pre-wrap">{metin}</p>
      {isAdmin && (
        <button
          onClick={() => { setTaslak(metin); setEdit(true) }}
          className="flex-none text-amber-600 hover:text-amber-800"
          title="Açıklamayı düzenle"
        >
          <Edit2 size={12} />
        </button>
      )}
    </div>
  )
}
