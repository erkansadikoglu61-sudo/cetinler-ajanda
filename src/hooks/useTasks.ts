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

  const checkIn = async (taskId: string, userId: string): Promise<{ ok: boolean; hasLocation: boolean; hasAddress: boolean }> => {
    const ts = new Date().toISOString()
    let lat: number | null = null
    let lng: number | null = null
    let checkin_address: string | null = null
    let hasLocation = false
    let hasAddress = false

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 0,
        })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
      hasLocation = true

      // Koordinatı adrese çevir (Nominatim / OpenStreetMap)
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`
        )
        const geo = await geoRes.json()
        const a = (geo.address ?? {}) as Record<string, string>
        const parts = [
          a.road ?? a.pedestrian ?? a.path ?? a.highway,
          a.suburb ?? a.neighbourhood ?? a.quarter,
          [a.town ?? a.district ?? a.county, a.city ?? a.province].filter(Boolean).join('/'),
        ].filter(Boolean)
        checkin_address = parts.join(', ') || geo.display_name || null
        if (checkin_address) hasAddress = true
      } catch {
        // Adres çevrimi başarısız olursa koordinat yine de kaydedilir
      }
    } catch {
      // Konum alınamazsa null koordinatlarla devam et
    }

    const ok = await updateTask(taskId, {
      checkin_ts: ts,
      checkin_lat: lat,
      checkin_lng: lng,
      checkin_by: userId,
      checkin_address,
    })
    return { ok, hasLocation, hasAddress }
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
    if (!error) {
      await load()

      // Görevi oluşturan kullanıcıya push notification gönder
      try {
        // Görev bilgisini al
        const { data: task } = await supabase
          .from('tasks')
          .select('pid, type, customer')
          .eq('id', taskId)
          .single()

        if (task && task.pid !== authorId) {
          // Görev sahibinin push token'ını al
          const { data: profile } = await supabase
            .from('profiles')
            .select('push_token, full_name')
            .eq('id', task.pid)
            .single()

          if (profile?.push_token) {
            // Not ekleyen kullanıcının adını al
            const { data: author } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', authorId)
              .single()

            // Push notification gönder
            await fetch('/api/send-push-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pushTokens: [profile.push_token],
                title: 'Göreve Yeni Not Eklendi',
                body: `${author?.full_name || 'Bir kullanıcı'} "${task.type}${task.customer ? ' - ' + task.customer : ''}" görevine not ekledi: ${text.trim().substring(0, 100)}${text.trim().length > 100 ? '...' : ''}`,
                data: { taskId, type: 'task_note_added' },
              }),
            })
          }
        }
      } catch (error) {
        console.error('Push notification gönderilirken hata:', error)
        // Hata olsa bile not ekleme işlemi başarılı sayılır
      }
    }
    return !error
  }

  return { notes, loading, addNote, reload: load }
}
