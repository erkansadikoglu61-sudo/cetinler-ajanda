'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { requestNotificationPermission, sendBrowserNotification } from '@/lib/notifications'

export function useRealtimeNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId) return

    // Browser notification izni iste
    requestNotificationPermission()

    // Realtime subscription - kullanıcının görevlerine eklenen notları dinle
    const channel = supabase
      .channel('task-notes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_notes',
        },
        async (payload) => {
          const note = payload.new as any

          // Not ekleyen kişi sen değilsen
          if (note.author_id === userId) return

          // Bu notun görevi sana ait mi kontrol et
          const { data: task } = await supabase
            .from('tasks')
            .select('pid, type, customer, profiles(full_name, email)')
            .eq('id', note.task_id)
            .single()

          if (task?.pid === userId) {
            // Sana ait görev!
            const { data: author } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', note.author_id)
              .single()

            const title = 'Göreve Yeni Not Eklendi'
            const body = `${author?.full_name || 'Bir kullanıcı'} "${task.type}${task.customer ? ' - ' + task.customer : ''}" görevine not ekledi`

            // 1. Browser notification (tarayıcı açıksa)
            sendBrowserNotification(title, body)

            // 2. Email notification (her zaman)
            if (task.profiles?.email) {
              try {
                await fetch('/api/send-email-notification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: task.profiles.email,
                    taskType: task.type,
                    taskCustomer: task.customer,
                    authorName: author?.full_name || 'Bir kullanıcı',
                    noteText: note.text,
                  }),
                })
              } catch (error) {
                console.error('Email gönderilemedi:', error)
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}
