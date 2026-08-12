/**
 * Local AuthBlock Adapter
 * 
 * Wraps the existing AuthBlockImpl to conform to IAuthBlockAdapter.
 * No changes to existing local logic - just async interface compliance.
 */

import { IAuthBlockAdapter } from '../../interfaces';
import { AuthSession, SignInInput, SignInResult, User } from '../../../schemas/auth';
import { AuthBlockImpl } from '../../../blocks/auth-block';

export class LocalAuthAdapter implements IAuthBlockAdapter {
  private impl: AuthBlockImpl;

  constructor(impl: AuthBlockImpl) {
    this.impl = impl;
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    return this.impl.signIn(input);
  }

  async signOut(sessionToken: string): Promise<void> {
    this.impl.signOut(sessionToken);
  }

  async getSession(sessionToken: string): Promise<AuthSession | null> {
    return this.impl.getSession(sessionToken);
  }

  async createSessionToken(userId: string): Promise<string> {
    return this.impl.createSessionToken(userId);
  }

  async requireAuth(sessionToken: string | undefined): Promise<AuthSession> {
    return this.impl.requireAuth(sessionToken);
  }

  async findUserById(id: string): Promise<User | null> {
    const user = this.impl.findUserById(id);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
