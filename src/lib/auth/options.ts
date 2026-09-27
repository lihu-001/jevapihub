import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { getDatabase } from "../../db/database";
import { ensureOAuthUser, findOAuthUser } from "./accounts";

const providers: NextAuthOptions["providers"] = [];
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(GitHubProvider({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }));
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !["github", "google"].includes(account.provider)) return false;
      const id = await ensureOAuthUser(getDatabase(), account.provider, account.providerAccountId, user);
      return id !== null;
    },
    async jwt({ token, account }) {
      if (account) token.userId = await findOAuthUser(getDatabase(), account.provider, account.providerAccountId) ?? undefined;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
};
