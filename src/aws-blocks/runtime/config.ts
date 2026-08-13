/**
 * Runtime Configuration
 * 
 * Determines whether the application runs against local implementations
 * or real AWS services. Controlled via BLOCK_RUNTIME environment variable.
 * 
 * BLOCK_RUNTIME=local  -> Local implementations (default, no AWS credentials needed)
 * BLOCK_RUNTIME=aws    -> Production AWS services (Cognito, DynamoDB, Bedrock)
 */

export type BlockRuntime = 'local' | 'aws';

export interface RuntimeConfig {
  runtime: BlockRuntime;
  aws: {
    region: string;
    cognito: {
      userPoolId: string;
      clientId: string;
    };
    dynamodb: {
      tableName: string;
    };
    bedrock: {
      modelId: string;
    };
    apiGateway: {
      url: string;
    };
  };
}

function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const runtime = (getEnv('BLOCK_RUNTIME', 'local') as BlockRuntime);

  return {
    runtime,
    aws: {
      region: getEnv('AWS_REGION', 'us-east-1'),
      cognito: {
        userPoolId: getEnv('COGNITO_USER_POOL_ID'),
        clientId: getEnv('COGNITO_CLIENT_ID'),
      },
      dynamodb: {
        tableName: getEnv('DYNAMODB_TABLE_NAME', 'WellnessRecords'),
      },
      bedrock: {
        modelId: getEnv('BEDROCK_MODEL_ID', 'amazon.nova-lite-v1:0'),
      },
      apiGateway: {
        url: getEnv('API_URL', 'http://localhost:3000'),
      },
    },
  };
}

export const runtimeConfig = loadRuntimeConfig();
