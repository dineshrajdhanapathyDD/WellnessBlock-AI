/**
 * Runtime Resolver
 * 
 * Selects local or AWS implementations based on BLOCK_RUNTIME environment variable.
 * The application code imports from here and gets the correct adapter transparently.
 */

import { IAuthBlockAdapter, IDataBlockAdapter, IAiInsightBlockAdapter } from './interfaces';
import { runtimeConfig } from './config';

// Local adapters
import { LocalAuthAdapter } from './adapters/local/auth-adapter';
import { LocalDataAdapter } from './adapters/local/data-adapter';
import { LocalAiInsightAdapter } from './adapters/local/ai-insight-adapter';

// Existing local implementations
import { authBlock as localAuthBlock } from '../blocks/auth-block';
import { dataBlock as localDataBlock } from '../blocks/data-block';
import { aiInsightBlock as localAiInsightBlock } from '../blocks/ai-insight-block';

export interface ResolvedRuntime {
  auth: IAuthBlockAdapter;
  data: IDataBlockAdapter;
  aiInsight: IAiInsightBlockAdapter;
  isAws: boolean;
}

let resolvedRuntime: ResolvedRuntime | null = null;

/**
 * Resolves the Block runtime based on BLOCK_RUNTIME environment variable.
 * 
 * - 'local' (default): Uses existing local implementations (no AWS credentials needed)
 * - 'aws': Uses production AWS adapters (Cognito, DynamoDB, Bedrock)
 */
export function resolveRuntime(): ResolvedRuntime {
  if (resolvedRuntime) return resolvedRuntime;

  if (runtimeConfig.runtime === 'aws') {
    // Lazy-load AWS adapters to avoid importing AWS SDK when running locally
    const { CognitoAuthAdapter } = require('./adapters/aws/auth-adapter');
    const { DynamoDBDataAdapter } = require('./adapters/aws/data-adapter');
    const { BedrockAiInsightAdapter } = require('./adapters/aws/ai-insight-adapter');

    const auth: IAuthBlockAdapter = new CognitoAuthAdapter();
    const data: IDataBlockAdapter = new DynamoDBDataAdapter();
    const aiInsight: IAiInsightBlockAdapter = new BedrockAiInsightAdapter(data);

    resolvedRuntime = { auth, data, aiInsight, isAws: true };

    console.log('  Runtime: AWS (Cognito + DynamoDB + Bedrock)');
  } else {
    const auth: IAuthBlockAdapter = new LocalAuthAdapter(localAuthBlock);
    const data: IDataBlockAdapter = new LocalDataAdapter(localDataBlock);
    const aiInsight: IAiInsightBlockAdapter = new LocalAiInsightAdapter(localAiInsightBlock);

    resolvedRuntime = { auth, data, aiInsight, isAws: false };

    console.log('  Runtime: Local (in-memory auth + JSON files + deterministic AI)');
  }

  return resolvedRuntime;
}
