/**
 * aws-blocks - The typed frontend API surface.
 * 
 * All frontend-used namespaces are exported from this file.
 * The frontend may ONLY use typed exports from aws-blocks.
 * No fetch(), axios, direct database calls, or manual API transport.
 */

// Core
export { Block, BlockDefinition, AwsServiceMapping, CloudFormationResource, CloudFormationMapping } from './core/block';
export { blockRegistry } from './core/registry';

// Schemas
export * from './schemas/auth';
export * from './schemas/wellness';
export * from './schemas/insight';

// Blocks
export { authBlock, dataBlock, apiBlock, aiInsightBlock, cloudFormationBlock } from './blocks';
export type { ApiContext, ApiHandler, ApiRoute } from './blocks';
export type { CloudFormationTemplate, BlockArchitectureInfo } from './blocks';

// Client API (typed methods used by the frontend)
export { wellnessApi } from './client';
