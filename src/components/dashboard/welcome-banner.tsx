'use client'

import React, { useState, useMemo } from 'react'
import { X, Sparkles, Sun, Moon, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { User } from '@/lib/types'

interface WelcomeBannerProps {
  user: User | null
}

const TIPS = [
  'Используйте Ctrl+K для быстрого доступа к палитре команд',
  'Нажмите ? чтобы увидеть все доступные горячие клавиши',
  'Вы можете создавать документы из готовых шаблонов',
  'Используйте массовый выбор для работы с несколькими документами',
  'Система поддерживает автоматическую нумерацию документов',
  'Настройте типы документов в панели администратора',
  'Добавляйте комментарии к документам для совместной работы',
]

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours()
  if (hour < 6) return { text: 'Доброй ночи', icon: <Moon className="h-5 w-5" /> }
  if (hour < 12) return { text: 'Доброе утро', icon: <Sun className="h-5 w-5" /> }
  if (hour < 18) return { text: 'Добрый день', icon: <Clock className="h-5 w-5" /> }
  return { text: 'Добрый вечер', icon: <Moon className="h-5 w-5" /> }
}

function getRoleDescription(role: string): string {
  switch (role) {
    case 'ADMIN': return 'Управляйте документами, процессами и настройками системы'
    case 'ADVANCED': return 'Создавайте, согласовывайте и контролируйте документы'
    default: return 'Создавайте документы и отслеживайте их статус'
  }
}

export default function WelcomeBanner({ user }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('welcome_banner_dismissed') === 'true'
  })

  const tipIndex = useMemo(() => Math.floor(Math.random() * TIPS.length), [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('welcome_banner_dismissed', 'true')
  }

  if (dismissed || !user) return null

  const greeting = getGreeting()
  const tip = TIPS[tipIndex]

  return (
    <div className="animate-slide-in-right glass rounded-xl p-4 mb-4 group relative overflow-hidden">
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
            {greeting.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">
              {greeting.text}, {user.name.split(' ')[0]}!
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {getRoleDescription(user.role)}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground/80">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="truncate">{tip}</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
