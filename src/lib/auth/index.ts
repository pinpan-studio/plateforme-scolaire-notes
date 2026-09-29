import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { ApiError } from "@/server/errors";
import { loginSchema } from "@/server/schemas";
import { hashPassword } from "./password";
import { SESSION_MAX_AGE } from "./session";
import { authenticate } from "./credentials";

export { authenticate, revokeSession, sessionCookie, clearedCookie } from "./credentials";
export { hashPassword, SESSION_MAX_AGE };

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        motDePasse: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          motDePasse: credentials?.motDePasse,
        });
        if (!parsed.success) return null;
        try {
          const result = await authenticate(parsed.data.email, parsed.data.motDePasse, "authjs", false);
          if (result.status !== "ok") return null;
          return {
            id: result.utilisateur.id,
            email: result.utilisateur.email,
            name: `${result.utilisateur.prenom} ${result.utilisateur.nom}`,
            role: result.utilisateur.role,
            enseignantId: result.utilisateur.enseignantId,
          };
        } catch (error) {
          if (error instanceof ApiError) return null;
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.enseignantId = user.enseignantId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = typeof token.role === "string" ? token.role : "";
        session.user.enseignantId = typeof token.enseignantId === "string" ? token.enseignantId : null;
      }
      return session;
    },
  },
});
