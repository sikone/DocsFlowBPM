'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, Loader2, FileText, Shield } from 'lucide-react'

import { useStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Введите адрес электронной почты')
    .email('Введите корректный адрес электронной почты'),
  password: z
    .string()
    .min(1, 'Введите пароль')
    .min(4, 'Пароль должен содержать минимум 4 символа'),
  remember: z.boolean().default(false),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useStore()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  })

  const rememberValue = watch('remember')

  const onSubmit = async (data: LoginFormValues) => {
    clearError()
    await login(data.email, data.password)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[45%] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-white/8 blur-2xl" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          {/* Logo area */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 flex items-center justify-center shadow-2xl">
                <FileText className="w-10 h-10 text-slate-800" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                <Shield className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="text-center space-y-3">
              <h1 className="text-4xl xl:text-5xl font-bold text-white tracking-tight">
                DocFlow <span className="text-emerald-400">BPM</span>
              </h1>
              <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                Система управления документами и бизнес-процессами
              </p>
            </div>

            {/* Feature cards */}
            <div className="mt-10 space-y-4 w-full max-w-sm">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Управление документами</p>
                  <p className="text-slate-400 text-xs">Создание, маршрутизация и архивирование</p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Безопасность</p>
                  <p className="text-slate-400 text-xs">Ролевой доступ и аудит действий</p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0">
                  <svg
                    className="w-5 h-5 text-sky-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Автоматизация</p>
                  <p className="text-slate-400 text-xs">BPMN-процессы и уведомления</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Version badge */}
        <div className="absolute bottom-6 left-6">
          <span className="text-slate-500 text-xs font-mono">v1.0.0</span>
        </div>
      </div>

      {/* Right login form panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-md">
          {/* Mobile logo - only shown on mobile/tablet */}
          <div className="flex lg:hidden flex-col items-center gap-3 mb-8">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Shield className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                DocFlow <span className="text-emerald-600">BPM</span>
              </h1>
              <p className="text-slate-500 text-sm mt-1">Система управления документами</p>
            </div>
          </div>

          {/* Login card */}
          <Card className="border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-slate-900 text-center">
                Вход в систему
              </CardTitle>
              <p className="text-sm text-slate-500 text-center">
                Введите свои учётные данные для продолжения
              </p>
            </CardHeader>

            <CardContent className="space-y-5">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Error message */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 shrink-0 text-red-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {error}
                    </div>
                  </div>
                )}

                {/* Email field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">
                    Электронная почта
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      autoComplete="email"
                      className="pl-10 h-11 bg-white border-slate-200 focus-visible:border-slate-400 focus-visible:ring-slate-400/30"
                      disabled={isLoading}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <svg
                        className="h-3 w-3 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">
                    Пароль
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Введите пароль"
                      autoComplete="current-password"
                      className="pl-10 pr-10 h-11 bg-white border-slate-200 focus-visible:border-slate-400 focus-visible:ring-slate-400/30"
                      disabled={isLoading}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-sm"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <svg
                        className="h-3 w-3 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Remember me */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberValue}
                    onCheckedChange={(checked) =>
                      setValue('remember', checked === true, { shouldValidate: true })
                    }
                    disabled={isLoading}
                    className="border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900"
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm text-slate-600 font-normal cursor-pointer select-none"
                  >
                    Запомнить меня
                  </Label>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium text-base transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Вход...
                    </>
                  ) : (
                    'Войти'
                  )}
                </Button>
              </form>

              {/* Test credentials hint */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Тестовые учётные данные
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-mono font-medium">admin@bpmn.local</span>
                    <span className="text-slate-400">/</span>
                    <span className="font-mono">admin123</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-mono font-medium">employee@bpmn.local</span>
                    <span className="text-slate-400">/</span>
                    <span className="font-mono">emp123</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 mt-6">
            DocFlow BPM &copy; 2025. Все права защищены.
          </p>
        </div>
      </div>
    </div>
  )
}
