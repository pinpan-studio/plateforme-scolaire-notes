import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    enseignantId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      enseignantId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    enseignantId?: string | null;
    sv?: number;
    prenom?: string;
    nom?: string;
  }
}
