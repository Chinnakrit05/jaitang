import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Auth.js v5 setup — Google OAuth only.
 *
 * Strategy: JWT sessions; Supabase is the source of truth for the user record.
 * On first sign-in, we upsert into public.users and stash users.id in the JWT
 * so all subsequent server actions can join transactions to a stable id.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const sb = getServerSupabase();
      const { error } = await sb.from("users").upsert(
        {
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        },
        { onConflict: "email" }
      );
      if (error) {
        console.error("[auth] upsert user failed:", error);
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const sb = getServerSupabase();
        const { data } = await sb
          .from("users")
          .select("id")
          .eq("email", user.email)
          .single();
        if (data?.id) token.userId = data.id as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
});
