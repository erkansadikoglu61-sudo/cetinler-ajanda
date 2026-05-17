'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, Task, TaskNote } from '@/lib/supabase'

export function useTasks(
  visibleIds: string[],
  year: number,
  month: number
) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  // Array referansı her render'da değiştiği için string'e çevirerek karşılaştır
  const idsKey = visibleIds.join(',')

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = new Date(year, month + 1, 0)
    const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .in('pid', ids)
      .gte('date', startDate)
      .lte('date', endDateStr)
      .order('date', { ascending: true })
      .order('time', { ascending: true, nullsFirst: true })

    if (!error && data) setTasks(data as Task[])
    setLoading(false)
  }, [idsKey, year, month])

  useEffect(() => {
    load()
  }, [load])

  const tasksForDay = useCallback(
    (dateStr: string, filterPid?: string | null): Task[] => {
      return tasks.filter(
        t => t.date === dateStr && (!filterPid || t.pid === filterPid)
      )
    },
    [tasks]
  )

  const addTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task | null> => {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()
    if (!error && data) {
      await load()
      return data as Task
    }
    return null
  }

  const updateTask = async (id: string, updates: Partial<Task>): Promise<boolean> => {
    const { error } = await supabase.from('tasks').update(updates).eq('id', id)
    if (!error) await load()
    return !error
  }

  const deleteTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) await load()
    return !error
  }

  const checkIn = async (taskId: string, userId: string): Promise<boolean> => {
    const ts = new Date().toISOString()
    let lat: number | null = null
    let lng: number | null = null
    let checkin_address: string | null = null

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude

      // Koordinatı adrese çevir (Nominatim / OpenStreetMap)
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`,
          { headers: { 'User-Agent': 'CetinlerAjanda/1.0' } }
        )
        const geo = await geoRes.json()
        const a = (geo.address ?? {}) as Record<string, string>
        const parts = [
          a.road ?? a.pedestrian ?? a.path ?? a.highway,
          a.suburb ?? a.neighbourhood ?? a.quarter,
          [a.town ?? a.district ?? a.county, a.city ?? a.province].filter(Boolean).join('/'),
        ].filter(Boolean)
        checkin_address = parts.join(', ') || geo.display_name || null
      } catch {
        // Adres çevrimi başarısız olursa koordinat zaten kaydedilir
      }
    } catch {
      // Konum alınamazsa null koordinatlarla devam et
    }

    // Önce adresle dene, kolon yoksa adreis olmadan kaydet
    const ok = await updateTask(taskId, {
      checkin_ts: ts,
      checkin_lat: lat,
      checkin_lng: lng,
      checkin_by: userId,
      checkin_address,
    })
    if (!ok && checkin_address !== undefined) {
      // checkin_address kolonu henüz eklenmemişse adreis olmadan kaydet
      return updateTask(taskId, {
        checkin_ts: ts,
        checkin_lat: lat,
        checkin_lng: lng,
        checkin_by: userId,
      })
    }
    return ok
  }

  return { tasks, loading, tasksForDay, addTask, updateTask, deleteTask, checkIn, reload: load }
}

export function useNotes(taskId: string | null) {
  const [notes, setNotes] = useState<TaskNote[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('task_notes')
      .select('*, profiles(full_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    if (!error && data) setNotes(data as TaskNote[])
    setLoading(false)
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  const addNote = async (authorId: string, text: string): Promise<boolean> => {
    if (!taskId || !text.trim()) return false
    const { error } = await supabase.from('task_notes').insert({
      task_id: taskId,
      author_id: authorId,
      text: text.trim(),
    })
    if (!error) await load()
    return !error
  }

  return { notes, loading, addNote, reload: load }
}
