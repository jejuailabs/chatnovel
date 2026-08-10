'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import HeaderBar from '@/components/header-bar'
import Footer from '@/components/footer'
import ProjectList from '@/components/project-list'
import GenesisEngine from '@/components/genesis-engine'
import ProductionEngine from '@/components/production-engine'
import Dashboard from '@/components/dashboard'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
})

export default function Home() {
  const currentView = useAppStore((s) => s.currentView)

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <HeaderBar />
        <main className="flex-1">
          {currentView === 'welcome' && <ProjectList />}
          {currentView === 'genesis' && <GenesisEngine />}
          {currentView === 'production' && <ProductionEngine />}
          {currentView === 'dashboard' && <Dashboard />}
        </main>
        <Footer />
      </div>
    </QueryClientProvider>
  )
}
