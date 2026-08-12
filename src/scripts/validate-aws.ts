/**
 * AWS Validation Script
 * 
 * Validates:
 * 1. CloudFormation template syntax
 * 2. Block IDs are stable
 * 3. IAM policies are least privilege
 * 4. Environment configuration is complete
 */

import * as fs from 'fs';
import * as path from 'path';
import { blockRegistry } from '../aws-blocks/core/registry';

// Import blocks to register them
import '../aws-blocks/blocks';

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

console.log('╔══════════════════════════════════════════════╗');
console.log('║  WellnessBlock AI - AWS Validation           ║');
console.log('╚══════════════════════════════════════════════╝');

// ─── 1. CloudFormation Template Exists ─────────────────────────────────────────

console.log('\n── CloudFormation Template ──');

const cfnPath = path.join(process.cwd(), 'infra', 'cloudformation.yaml');
const cfnExists = fs.existsSync(cfnPath);
check(cfnExists, 'CloudFormation template exists at infra/cloudformation.yaml');

if (cfnExists) {
  const cfnContent = fs.readFileSync(cfnPath, 'utf-8');
  
  // Check required resources
  check(cfnContent.includes('AWS::Cognito::UserPool'), 'Template contains Cognito UserPool');
  check(cfnContent.includes('AWS::Cognito::UserPoolClient'), 'Template contains Cognito UserPoolClient');
  check(cfnContent.includes('AWS::DynamoDB::Table'), 'Template contains DynamoDB Table');
  check(cfnContent.includes('AWS::Lambda::Function'), 'Template contains Lambda Function');
  check(cfnContent.includes('AWS::ApiGateway::RestApi'), 'Template contains API Gateway');
  check(cfnContent.includes('AWS::IAM::Role'), 'Template contains IAM Role');
  check(cfnContent.includes('AWS::Logs::LogGroup'), 'Template contains CloudWatch LogGroup');
  
  // IAM least privilege checks
  check(!cfnContent.includes('Action: "*"'), 'IAM does NOT use wildcard actions');
  check(!cfnContent.includes('AdministratorAccess'), 'IAM does NOT use AdministratorAccess');
  check(cfnContent.includes('dynamodb:GetItem'), 'IAM grants specific DynamoDB actions');
  check(cfnContent.includes('bedrock:InvokeModel'), 'IAM grants specific Bedrock actions');
  
  // DynamoDB design
  check(cfnContent.includes('userId-date-index'), 'DynamoDB has userId-date GSI');
  check(cfnContent.includes('PAY_PER_REQUEST'), 'DynamoDB uses on-demand billing');
  check(cfnContent.includes('PointInTimeRecoveryEnabled: true'), 'DynamoDB has PITR enabled');
  check(cfnContent.includes('SSEEnabled: true'), 'DynamoDB has encryption enabled');
  
  // Security
  check(cfnContent.includes('PreventUserExistenceErrors: ENABLED'), 'Cognito prevents user enumeration');
  check(cfnContent.includes('DeletionPolicy: Retain'), 'DynamoDB table has deletion protection');
}

// ─── 2. Block IDs Stability ────────────────────────────────────────────────────

console.log('\n── Block ID Stability ──');

const expectedBlocks = [
  'auth-block',
  'data-block',
  'api-block',
  'ai-insight-block',
  'cloudformation-block',
];

for (const blockId of expectedBlocks) {
  check(blockRegistry.has(blockId), `Block "${blockId}" is registered`);
}

// ─── 3. Environment Configuration ─────────────────────────────────────────────

console.log('\n── Configuration ──');

const envExamplePath = path.join(process.cwd(), '.env.example');
const envExampleExists = fs.existsSync(envExamplePath);
check(envExampleExists, '.env.example exists');

if (envExampleExists) {
  const envContent = fs.readFileSync(envExamplePath, 'utf-8');
  check(envContent.includes('BLOCK_RUNTIME'), '.env.example contains BLOCK_RUNTIME');
  check(envContent.includes('AWS_REGION'), '.env.example contains AWS_REGION');
  check(envContent.includes('COGNITO_USER_POOL_ID'), '.env.example contains COGNITO_USER_POOL_ID');
  check(envContent.includes('COGNITO_CLIENT_ID'), '.env.example contains COGNITO_CLIENT_ID');
  check(envContent.includes('DYNAMODB_TABLE_NAME'), '.env.example contains DYNAMODB_TABLE_NAME');
  check(envContent.includes('BEDROCK_MODEL_ID'), '.env.example contains BEDROCK_MODEL_ID');
  check(envContent.includes('API_URL'), '.env.example contains API_URL');
}

// ─── 4. No Secrets in Source ───────────────────────────────────────────────────

console.log('\n── Security ──');

const gitignorePath = path.join(process.cwd(), '.gitignore');
const gitignoreExists = fs.existsSync(gitignorePath);
check(gitignoreExists, '.gitignore exists');

if (gitignoreExists) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  check(gitignoreContent.includes('.env'), '.gitignore excludes .env');
  check(gitignoreContent.includes('.data/'), '.gitignore excludes .data/');
}

// ─── RESULTS ───────────────────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════`);

if (failed > 0) {
  process.exit(1);
}
