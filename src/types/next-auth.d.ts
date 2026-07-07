import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      mustChangePassword: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    mustChangePassword: boolean;
  }
}
