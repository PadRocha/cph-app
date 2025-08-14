interface IKey {
  readonly line: string;
  readonly brand: string;
}

interface Key {
  readonly _id: string;
  readonly code: string;
}

interface ILine {
  readonly code: string;
  readonly desc: string;
}

interface Line extends ILine {
  readonly _id: string;
}

interface IBrand {
  readonly code: string;
  readonly desc: string;
}

interface Brand extends IBrand {
  readonly _id: string;
}

interface StatusInfo {
  readonly defective: number;
  readonly found: number;
  readonly photographed: number;
  readonly prepared: number;
  readonly edited: number;
  readonly saved: number;
}

interface IUser {
  // (sin cambios)
}

/** ← mantengo tu User tal cual (roles: string[]) */
interface User {
  identifier: string;
  nickname: string;
  roles?: string[];
}

/** NUEVO: alias de roles tipados para el front (no rompe a User) */
type AuthRole = 'READ' | 'WRITE' | 'EDIT' | 'GRANT' | 'ADMIN';

export type { Brand, IBrand, IKey, ILine, IUser, Key, Line, StatusInfo, User, AuthRole };
