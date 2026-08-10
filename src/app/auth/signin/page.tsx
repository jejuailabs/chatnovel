'use client'

import { signIn, getProviders } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

type Providers = Awaited<ReturnType<typeof getProviders>>

export default function SignInPage() {
  const [providers, setProviders] = useState<Providers>(null)

  useEffect(() => {
    getProviders().then(setProviders)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <CardTitle>IP Creator Studio</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">로그인하여 프로젝트를 시작하세요</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers &&
            Object.values(providers)
              .filter((p) => p.id !== 'firebase')
              .map((provider) => (
                <Button
                  key={provider.id}
                  onClick={() => signIn(provider.id, { callbackUrl: '/' })}
                  className="w-full"
                  variant="outline"
                >
                  {provider.name}으로 로그인
                </Button>
              ))}

          {/* Dev mode: skip auth */}
          {!process.env.NEXT_PUBLIC_REQUIRE_AUTH && (
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center mb-2">개발 모드</p>
              <Button
                onClick={() => window.location.href = '/'}
                variant="ghost"
                className="w-full text-xs"
              >
                인증 없이 계속
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
