import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getAdminApp } from '@/lib/firebase-admin'
import { getAuth } from 'firebase-admin/auth'

export const authOptions: NextAuthOptions = {
  providers: [
    // Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in .env.local)
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    // Firebase ID token login (for Firebase Auth users)
    CredentialsProvider({
      id: 'firebase',
      name: 'Firebase',
      credentials: {
        idToken: { label: 'Firebase ID Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.idToken) return null
        try {
          const auth = getAuth(getAdminApp())
          const decoded = await auth.verifyIdToken(credentials.idToken)
          return {
            id: decoded.uid,
            email: decoded.email || null,
            name: decoded.name || decoded.email?.split('@')[0] || 'User',
            image: decoded.picture || null,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).uid = token.uid
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
