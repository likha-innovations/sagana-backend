export interface RequestUser {
  id: string;
  role: string;
  barangayId: string | null;
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
