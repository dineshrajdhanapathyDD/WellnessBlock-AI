/**
 * AuthBlock - Local authentication block.
 * AWS Mapping: Amazon Cognito (UserPool + UserPoolClient)
 * 
 * Provides:
 * - signIn(email, password) -> AuthSession
 * - signOut() -> void
 * - getCurrentUser() -> User | null
 * - requireAuth() -> AuthSession (throws 401 if not authenticated)
 */

import { Block, BlockDefinition } from '../core/block';
import { blockRegistry } from '../core/registry';
import { User, UserRole, AuthSession, SignInInput, SignInResult } from '../schemas/auth';

// Deterministic test users
export interface LocalUser {
  id: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

const TEST_USERS: LocalUser[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'alice@example.com',
    name: 'Alice',
    password: 'password123',
    role: 'USER',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'bob@example.com',
    name: 'Bob',
    password: 'password123',
    role: 'USER',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'admin@example.com',
    name: 'Admin',
    password: 'admin123',
    role: 'ADMIN',
  },
];

// In-memory session store (keyed by session token)
const sessions: Map<string, AuthSession> = new Map();

export class AuthBlockImpl extends Block {
  readonly definition: BlockDefinition = {
    id: 'auth-block',
    name: 'AuthBlock',
    description: 'Authentication and authorization using local deterministic users. Maps to Amazon Cognito in AWS.',
    awsServiceMapping: [
      {
        serviceName: 'Amazon Cognito',
        serviceDescription: 'User authentication, authorization, and user management',
      },
    ],
    cloudFormationMapping: {
      resources: {
        UserPool: {
          type: 'AWS::Cognito::UserPool',
          properties: {
            UserPoolName: 'WellnessBlockUserPool',
            AutoVerifiedAttributes: ['email'],
            UsernameAttributes: ['email'],
            Policies: {
              PasswordPolicy: {
                MinimumLength: 8,
                RequireUppercase: true,
                RequireLowercase: true,
                RequireNumbers: true,
              },
            },
            Schema: [
              {
                Name: 'email',
                AttributeDataType: 'String',
                Required: true,
                Mutable: true,
              },
              {
                Name: 'name',
                AttributeDataType: 'String',
                Required: true,
                Mutable: true,
              },
            ],
          },
        },
        UserPoolClient: {
          type: 'AWS::Cognito::UserPoolClient',
          properties: {
            ClientName: 'WellnessBlockClient',
            UserPoolId: { Ref: 'UserPool' },
            ExplicitAuthFlows: [
              'ALLOW_USER_PASSWORD_AUTH',
              'ALLOW_REFRESH_TOKEN_AUTH',
            ],
            GenerateSecret: false,
          },
        },
      },
    },
  };

  getTestUsers(): LocalUser[] {
    return TEST_USERS;
  }

  findUserByEmail(email: string): LocalUser | undefined {
    return TEST_USERS.find(u => u.email === email);
  }

  findUserById(id: string): LocalUser | undefined {
    return TEST_USERS.find(u => u.id === id);
  }

  signIn(input: SignInInput): SignInResult {
    const user = this.findUserByEmail(input.email);
    if (!user || user.password !== input.password) {
      return { success: false, error: 'Invalid email or password' };
    }

    const sessionToken = `session-${user.id}-${Date.now()}`;
    const authSession: AuthSession = {
      userId: user.id,
      email: user.email,
      role: user.role,
      authenticatedAt: new Date().toISOString(),
    };

    sessions.set(sessionToken, authSession);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  signOut(sessionToken: string): void {
    sessions.delete(sessionToken);
  }

  getSession(sessionToken: string): AuthSession | null {
    return sessions.get(sessionToken) || null;
  }

  createSessionToken(userId: string): string {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    const sessionToken = `session-${user.id}-${Date.now()}`;
    const authSession: AuthSession = {
      userId: user.id,
      email: user.email,
      role: user.role,
      authenticatedAt: new Date().toISOString(),
    };
    sessions.set(sessionToken, authSession);
    return sessionToken;
  }

  requireAuth(sessionToken: string | undefined): AuthSession {
    if (!sessionToken) {
      const error: any = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }
    const session = this.getSession(sessionToken);
    if (!session) {
      const error: any = new Error('Invalid or expired session');
      error.statusCode = 401;
      throw error;
    }
    return session;
  }
}

export const authBlock = new AuthBlockImpl();
blockRegistry.register(authBlock);
