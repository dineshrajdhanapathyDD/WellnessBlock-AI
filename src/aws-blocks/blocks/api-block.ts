/**
 * ApiBlock - Typed API layer with authentication enforcement.
 * AWS Mapping: API Gateway + AWS Lambda
 * 
 * All API handlers receive the authenticated session - never trust frontend-supplied userId.
 * The backend derives the current user from the authenticated session.
 */

import { Block, BlockDefinition } from '../core/block';
import { blockRegistry } from '../core/registry';
import { AuthSession } from '../schemas/auth';
import { authBlock } from './auth-block';

export interface ApiContext {
  session: AuthSession;
  userId: string;
}

export type ApiHandler<TInput, TOutput> = (input: TInput, context: ApiContext) => TOutput | Promise<TOutput>;

export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: ApiHandler<any, any>;
  requiresAuth: boolean;
}

export class ApiBlockImpl extends Block {
  readonly definition: BlockDefinition = {
    id: 'api-block',
    name: 'ApiBlock',
    description: 'Typed API layer with authentication enforcement. Maps to API Gateway + AWS Lambda.',
    awsServiceMapping: [
      {
        serviceName: 'Amazon API Gateway',
        serviceDescription: 'Fully managed API creation, publishing, and security',
      },
      {
        serviceName: 'AWS Lambda',
        serviceDescription: 'Serverless compute for running API handlers',
      },
    ],
    cloudFormationMapping: {
      resources: {
        ApiGateway: {
          type: 'AWS::ApiGateway::RestApi',
          properties: {
            Name: 'WellnessBlockAPI',
            Description: 'WellnessBlock AI REST API',
            EndpointConfiguration: {
              Types: ['REGIONAL'],
            },
          },
        },
        WellnessFunction: {
          type: 'AWS::Lambda::Function',
          properties: {
            FunctionName: 'WellnessBlockHandler',
            Runtime: 'nodejs20.x',
            Handler: 'index.handler',
            MemorySize: 256,
            Timeout: 30,
            Environment: {
              Variables: {
                TABLE_NAME: { Ref: 'WellnessTable' },
                USER_POOL_ID: { Ref: 'UserPool' },
              },
            },
          },
        },
      },
    },
  };

  private routes: ApiRoute[] = [];

  registerRoute(route: ApiRoute): void {
    this.routes.push(route);
  }

  getRoutes(): ApiRoute[] {
    return [...this.routes];
  }

  /**
   * Build an ApiContext from a session token.
   * This is the ONLY way to get user context - never trust frontend-supplied userId.
   */
  buildContext(sessionToken: string | undefined): ApiContext {
    const session = authBlock.requireAuth(sessionToken);
    return {
      session,
      userId: session.userId,
    };
  }

  /**
   * Enforce that a record belongs to the authenticated user.
   * Throws 403 if ownership check fails.
   */
  enforceOwnership(recordUserId: string, contextUserId: string): void {
    if (recordUserId !== contextUserId) {
      const error: any = new Error('Access denied: you do not own this resource');
      error.statusCode = 403;
      throw error;
    }
  }
}

export const apiBlock = new ApiBlockImpl();
blockRegistry.register(apiBlock);
