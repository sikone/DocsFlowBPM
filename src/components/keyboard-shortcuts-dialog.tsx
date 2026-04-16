'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Keyboard } from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutItem[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Навигация',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Палитра команд' },
      { keys: ['Alt', '↑'], description: 'Перейти к панели управления' },
      { keys: ['Esc'], description: 'Закрыть диалог / Назад' },
    ],
  },
  {
    title: 'Документы',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'Новый документ' },
      { keys: ['Ctrl', 'S'], description: 'Сохранить документ' },
      { keys: ['Ctrl', 'F'], description: 'Поиск документов' },
      { keys: ['Ctrl', 'P'], description: 'Печать документа' },
      { keys: ['Delete'], description: 'Удалить выбранный' },
    ],
  },
  {
    title: 'Просмотр',
    shortcuts: [
      { keys: ['Ctrl', '\\'], description: 'Переключить тему' },
      { keys: ['Ctrl', 'B'], description: 'Переключить боковую панель' },
      { keys: ['?'], description: 'Показать справку по клавишам' },
    ],
  },
]

export default function KeyboardShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Keyboard className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Горячие клавиши</DialogTitle>
          <DialogDescription>
            Используйте клавиатурные сокращения для быстрой работы
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5 group"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <React.Fragment key={key}>
                          {i > 0 && (
                            <span className="text-xs text-muted-foreground mx-0.5">
                              +
                            </span>
                          )}
                          <kbd className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded bg-muted border border-border text-xs font-mono text-foreground shadow-sm group-hover:bg-accent group-hover:border-accent-foreground/20 transition-colors">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Нажмите{' '}
            <kbd className="inline-flex items-center justify-center h-5 px-1 rounded bg-muted border border-border text-[10px] font-mono mx-1">
              ?
            </kbd>{' '}
            для быстрого доступа
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
