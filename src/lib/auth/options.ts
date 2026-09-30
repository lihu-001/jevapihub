import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getDatabase } from "../../db/database";
import { findPasswordUser, normalizeEmail, validatePassword } from "./password";
import { createWindowLimiter } from "../runtime/rate-limit";

const allowLogin = createWindowLimiter();

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [CredentialsProvider({
    name: "邮箱和密码",
    credentials: {
      email: { label: "邮箱", type: "email" },
      password: { label: "密码", type: "password" },
    },
    async authorize(credentials, request) {
      const address = (request.headers?.["x-forwarded-for"]?.split(",")[0] || request.headers?.["x-real-ip"] || "unknown").trim().slice(0, 128);
      if (!allowLogin(address, 10)) return null;
      const email = normalizeEmail(credentials?.email);
      const password = validatePassword(credentials?.password);
      if (!email || !password) return null;
      const userId = await findPasswordUser(getDatabase(), email, password);
      return userId ? { id: userId, email } : null;
    },
  })],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
};
