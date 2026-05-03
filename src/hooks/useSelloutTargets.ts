'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ProfileTarget {
  id?: string
  donem: string
  profile_id: string
  grup: string
  hedef: number
  entered_by?: string
}

export interface MerchTarget {
  id?: string
  donem: string
  merch_name: string
  supervisor_name?: string
  grup: string
  hedef: number
  entered_by?: string
}

export function useSelloutTargets(donem: string) {
  const [profileTargets, setProfileTargets] = useState<ProfileTarget[]>([])
  const [merchTargets, setMerchTargets]     = useState<MerchTarget[]>([])
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)

  const load = useCallback(async () => {
    if (!donem) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/sellout-targets?donem=${donem}`)
      const json = await res.json()
      setProfileTargets(json.profile_targets ?? [])
      setMerchTargets(json.merch_targets ?? [])
    } finally {
      setLoading(false)
    }
  }, [donem])

  useEffect(() => { load() }, [load])

  const getProfileHedef = useCallback(
    (profileId: string, grup: string): number =>
      profileTargets.find(t => t.profile_id === profileId && t.grup === grup)?.hedef ?? 0,
    [profileTargets]
  )

  const getMerchHedef = useCallback(
    (merchName: string, grup: string): number =>
      merchTargets.find(t => t.merch_name === merchName && t.grup === grup)?.hedef ?? 0,
    [merchTargets]
  )

  const upsertProfileTargets = async (targets: ProfileTarget[]): Promise<boolean> => {
    setSaving(true)
    try {
      const res = await fetch('/api/sellout-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'profile', targets }),
      })
      if (res.ok) { await load(); return true }
      return false
    } finally { setSaving(false) }
  }

  const upsertMerchTargets = async (targets: MerchTarget[]): Promise<boolean> => {
    setSaving(true)
    try {
      const res = await fetch('/api/sellout-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'merch', targets }),
      })
      if (res.ok) { await load(); return true }
      return false
    } finally { setSaving(false) }
  }

  return {
    profileTargets, merchTargets, loading, saving,
    getProfileHedef, getMerchHedef,
    upsertProfileTargets, upsertMerchTargets,
    reload: load,
  }
}
