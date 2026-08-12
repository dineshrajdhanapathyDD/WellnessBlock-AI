/**
 * AWS AuthBlock Adapter - Amazon Cognito
 * 
 * Production implementation using Cognito User Pools.
 * Block ID: auth-block (preserved)
 * 
 * Maps:
 *   signIn()          -> Cognito InitiateAuth (USER_PASSWORD_AUTH)
 *   signOut()         -> Cognito GlobalSignOut
 *   getSession()      -> Cognito GetUser (validates access token)
 *   requireAuth()     -> Token validation + user attributes
 *   createSessionToken() -> Cognito AdminInitiateAuth
 *   findUserById()    -> Cognito AdminGetUser
 * 
 * Identity comes from the Cognito JWT - never from frontend input.
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { IAuthBlockAdapter } from '../../interfaces';
import { AuthSession, SignInInput, SignInResult, User, UserRole } from '../../../schemas/auth';
import { runtimeConfig } from '../../config';

export class CognitoAuthAdapter implements IAuthBlockAdapter {
  private client: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;

  // Token-to-session cache (access tokens from Cognito)
  private tokenCache: Map<string, { session: AuthSession; expiresAt: number }> = new Map();

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: runtimeConfig.aws.region,
    });
    this.userPoolId = runtimeConfig.aws.cognito.userPoolId;
    this.clientId = runtimeConfig.aws.cognito.clientId;
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: input.email,
          PASSWORD: input.password,
        },
      });

      const response = await this.client.send(command);

      if (!response.AuthenticationResult?.AccessToken) {
        return { success: false, error: 'Authentication failed' };
      }

      const accessToken = response.AuthenticationResult.AccessToken;

      // Get user details from the access token
      const userCommand = new GetUserCommand({ AccessToken: accessToken });
      const userResponse = await this.client.send(userCommand);

      const attrs = userResponse.UserAttributes || [];
      const sub = attrs.find(a => a.Name === 'sub')?.Value || '';
      const email = attrs.find(a => a.Name === 'email')?.Value || input.email;
      const name = attrs.find(a => a.Name === 'name')?.Value || email.split('@')[0];
      const role = (attrs.find(a => a.Name === 'custom:role')?.Value || 'USER') as UserRole;

      // Cache the session
      const session: AuthSession = {
        userId: sub,
        email,
        role,
        authenticatedAt: new Date().toISOString(),
      };

      const expiresAt = Date.now() + (response.AuthenticationResult.ExpiresIn || 3600) * 1000;
      this.tokenCache.set(accessToken, { session, expiresAt });

      return {
        success: true,
        user: { id: sub, email, name, role },
      };
    } catch (err: any) {
      if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
        return { success: false, error: 'Invalid email or password' };
      }
      return { success: false, error: err.message || 'Authentication failed' };
    }
  }

  async signOut(sessionToken: string): Promise<void> {
    try {
      this.tokenCache.delete(sessionToken);
      const command = new GlobalSignOutCommand({ AccessToken: sessionToken });
      await this.client.send(command);
    } catch (err) {
      // Best effort - token may already be invalid
      this.tokenCache.delete(sessionToken);
    }
  }

  async getSession(sessionToken: string): Promise<AuthSession | null> {
    // Check cache first
    const cached = this.tokenCache.get(sessionToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.session;
    }

    // Validate with Cognito
    try {
      const command = new GetUserCommand({ AccessToken: sessionToken });
      const response = await this.client.send(command);

      const attrs = response.UserAttributes || [];
      const sub = attrs.find(a => a.Name === 'sub')?.Value || '';
      const email = attrs.find(a => a.Name === 'email')?.Value || '';
      const role = (attrs.find(a => a.Name === 'custom:role')?.Value || 'USER') as UserRole;

      const session: AuthSession = {
        userId: sub,
        email,
        role,
        authenticatedAt: new Date().toISOString(),
      };

      // Cache for 5 minutes
      this.tokenCache.set(sessionToken, { session, expiresAt: Date.now() + 300_000 });
      return session;
    } catch (err) {
      this.tokenCache.delete(sessionToken);
      return null;
    }
  }

  async createSessionToken(userId: string): Promise<string> {
    // In AWS mode, the token IS the Cognito access token.
    // This method is mainly used for local compatibility.
    // In production, the token comes from signIn().
    try {
      const command = new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: userId,
          PASSWORD: 'ADMIN_GENERATED_SESSION',
        },
      });
      const response = await this.client.send(command);
      return response.AuthenticationResult?.AccessToken || '';
    } catch (err) {
      throw new Error(`Cannot create session for user ${userId}: admin auth failed`);
    }
  }

  async requireAuth(sessionToken: string | undefined): Promise<AuthSession> {
    if (!sessionToken) {
      const error: any = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const session = await this.getSession(sessionToken);
    if (!session) {
      const error: any = new Error('Invalid or expired session');
      error.statusCode = 401;
      throw error;
    }

    return session;
  }

  async findUserById(id: string): Promise<User | null> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: id,
      });
      const response = await this.client.send(command);

      const attrs = response.UserAttributes || [];
      const sub = attrs.find(a => a.Name === 'sub')?.Value || id;
      const email = attrs.find(a => a.Name === 'email')?.Value || '';
      const name = attrs.find(a => a.Name === 'name')?.Value || '';
      const role = (attrs.find(a => a.Name === 'custom:role')?.Value || 'USER') as UserRole;

      return { id: sub, email, name, role };
    } catch (err) {
      return null;
    }
  }
}
