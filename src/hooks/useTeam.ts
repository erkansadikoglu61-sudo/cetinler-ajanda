'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Profile, BsySupervisor } from '@/lib/supabase'

export function useTeam(currentProfile: Profile | null) {
  const [team, setTeam] = useState<Profile[]>([])
  const [bsyLinks, setBsyLinks] = useState<BsySupervisor[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [profilesRes, linksRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('bsy_supervisors').select('*'),
    ])
    if (profilesRes.data) setTeam(profilesRes.data as Profile[])
    if (linksRes.data) setBsyLinks(linksRes.data as BsySupervisor[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleIds = useCallback((): string[] => {
    if (!currentProfile) return []
    if (currentProfile.role === 'admin') return team.map(p => p.id)
    if (currentProfile.role === 'bsy') {
      const linked = bsyLinks
        .filter(l => l.bsy_id === currentProfile.id)
        .map(l => l.sup_id)
      return [currentProfile.id, ...linked]
    }
    if (currentProfile.role === 'sup') {
      const jrs = team
        .filter(p => p.manager_id === currentProfile.id)
        .map(p => p.id)
      return [currentProfile.id, ...jrs]
    }
    return [currentProfile.id]
  }, [currentProfile, team, bsyLinks])

  const profileById = useCallback(
    (id: string): Profile | undefined => team.find(p => p.id === id),
    [team]
  )

  const updateBsyLink = async (bsyId: string, supIds: string[]) => {
    await supabase.from('bsy_supervisors').delete().eq('bsy_id', bsyId)
    if (supIds.length > 0) {
      await supabase.from('bsy_supervisors').insert(
        supIds.map(supId => ({ bsy_id: bsyId, sup_id: supId }))
      )
    }
    await load()
  }

  const upsertProfile = async (p: Partial<Profile> & { id: string }) => {
    const { error } = await supabase.from('profiles').upsert(p)
    if (!error) await load()
    return error
  }

  return {
    team,
    bsyLinks,
    loading,
    visibleIds,
    profileById,
    updateBsyLink,
    upsertProfile,
    reload: load,
  }
}
