'use client';

/** The browser's side of Better Auth: only ever used to sign in. */
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
