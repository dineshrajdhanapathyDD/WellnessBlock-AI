# WellnessBlock AI

A wellness tracking application built with a **Block-based architecture** that runs identically in local development and production AWS environments.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                       │
│              Dashboard  │  AI Insight                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                  Block Interfaces                             │
│   IAuthBlock  │  IDataBlock  │  IApiBlock  │  IAiInsight    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                 ┌──────────┴──────────┐
                 │  BLOCK_RUNTIME=?    │
                 └──────────┬──────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────────┐             ┌─────────────────────────┐
│   LOCAL Runtime     │             │    AWS Runtime           │
│                     │             │                          │
│ • In-memory auth    │             │ • Amazon Cognito         │
│ • JSON file storage │             │ • Amazon DynamoDB        │
│ • Express server    │             │ • AWS Lambda + API GW    │
│ • Deterministic AI  │             │ • Amazon Bedrock         │
│                     │             │ • CloudWatch Logs        │
└─────────────────────┘             └─────────────────────────┘
```

## Blocks

| Block | ID | Local Implementation | AWS Service | CloudFormation |
|-------|------|---------------------|-------------|----------------|
| **AuthBlock** | `auth-block` | In-memory sessions + test users | Amazon Cognito | `AWS::Cognito::UserPool`, `AWS::Cognito::UserPoolClient` |
| **DataBlock** | `data-block` | JSON file persistence | Amazon DynamoDB | `AWS::DynamoDB::Table` (GSI: userId-date-index) |
| **ApiBlock** | `api-block` | Express.js HTTP server | API Gateway + Lambda | `AWS::ApiGateway::RestApi`, `AWS::Lambda::Function` |
| **AiInsightBlock** | `ai-insight-block` | Deterministic summary generator | Amazon Bedrock (Claude) | `AWS::IAM::Role` (Bedrock invocation) |
| **CloudFormationBlock** | `cloudformation-block` | Template generator | AWS CloudFormation | - |

## Quick Start

### Local Development (No AWS Credentials Needed)

```bash
# Install dependencies
npm install

# Seed test data
npm run reset

# Start development server
npm run dev
```

Open http://localhost:3000

**Test users:**
- `alice@example.com` / `password123`
- `bob@example.com` / `password123`
- `admin@example.com` / `admin123`

### Run Contract Tests

```bash
npm test
```

### Validate AWS Configuration

```bash
npm run validate:aws
```

## Production Deployment (AWS)

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. AWS account with Bedrock model access enabled

### Configuration

Copy `.env.example` to `.env` and fill in production values:

```bash
BLOCK_RUNTIME=aws
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
DYNAMODB_TABLE_NAME=WellnessRecords-production
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
```

### Deploy Infrastructure

```bash
# Validate the CloudFormation template
aws cloudformation validate-template --template-body file://infra/cloudformation.yaml

# Deploy the stack
npm run deploy
```

This creates:
- Cognito User Pool + Client
- DynamoDB Table (PAY_PER_REQUEST, encrypted, PITR enabled)
- Lambda Function (Node.js 20.x)
- API Gateway (REST, regional)
- IAM Role (least privilege)
- CloudWatch Log Group (14-day retention)

### Post-Deployment

After deployment, retrieve the stack outputs:

```bash
aws cloudformation describe-stacks --stack-name WellnessBlockAI --query 'Stacks[0].Outputs'
```

Update your `.env` with the output values for `UserPoolId`, `UserPoolClientId`, `DynamoDBTableName`, and `ApiEndpoint`.

## Runtime Switch

The application uses `BLOCK_RUNTIME` environment variable:

| Value | Description | Auth | Data | AI |
|-------|-------------|------|------|----|
| `local` (default) | Development | In-memory | JSON files | Deterministic |
| `aws` | Production | Cognito | DynamoDB | Bedrock |

The frontend and business logic are **identical** in both modes. Only the Block adapters differ.

## DynamoDB Access Patterns

| Pattern | Implementation |
|---------|---------------|
| Get record by ID | `GetItem(id)` on primary key |
| List user's records | `Query GSI(userId, ScanIndexForward=false)` |
| List with date range | `Query GSI(userId, date BETWEEN start AND end)` |
| Create record | `PutItem` with `condition: attribute_not_exists(id)` |
| Update record | `UpdateItem` with version increment |
| Delete record | `DeleteItem(id)` |

## Security

- **Authentication**: Cognito JWT tokens (never trust frontend-supplied userId)
- **Ownership**: Server-side enforcement via `apiBlock.enforceOwnership()`
- **IAM**: Least-privilege policies (specific actions on specific resources)
- **DynamoDB**: Encrypted at rest (SSE), Point-in-Time Recovery enabled
- **Cognito**: User enumeration prevention enabled
- **AI**: No direct database access - data flows through typed tools only

## Project Structure

```
src/
├── aws-blocks/
│   ├── core/              # Block base class, registry
│   ├── schemas/           # Zod schemas (auth, wellness, insight)
│   ├── blocks/            # Block implementations (local)
│   ├── client/            # Typed frontend API
│   ├── runtime/
│   │   ├── config.ts      # Runtime configuration
│   │   ├── interfaces.ts  # Abstract Block interfaces
│   │   ├── resolver.ts    # Runtime selector (local vs aws)
│   │   └── adapters/
│   │       ├── local/     # Local adapters (wrap existing)
│   │       └── aws/       # AWS adapters (Cognito, DynamoDB, Bedrock)
│   └── index.ts           # Public API surface
├── server/                # Express server
├── scripts/               # reset, validate-aws
└── tests/                 # Contract tests
infra/
└── cloudformation.yaml    # Production IaC
docs/
└── architecture.drawio    # Architecture diagram (draw.io)
public/
└── index.html             # Frontend UI
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run reset` | Seed deterministic test data |
| `npm test` | Run contract tests |
| `npm run typecheck` | TypeScript type checking |
| `npm run validate:aws` | Validate CloudFormation + config |
| `npm run synth` | Alias for validate:aws |
| `npm run build` | Compile TypeScript |
| `npm run deploy` | Deploy CloudFormation stack to AWS |

## License

Private
