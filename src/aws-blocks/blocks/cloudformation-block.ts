/**
 * CloudFormationBlock - Generates AWS CloudFormation templates from the Block graph.
 * AWS Mapping: AWS CloudFormation
 * 
 * Scans the block registry and produces a complete CloudFormation template
 * based on the actual blocks used by the application.
 */

import { Block, BlockDefinition, CloudFormationResource } from '../core/block';
import { blockRegistry } from '../core/registry';

export interface CloudFormationTemplate {
  AWSTemplateFormatVersion: string;
  Description: string;
  Resources: Record<string, CloudFormationResource>;
  Outputs: Record<string, { Description: string; Value: Record<string, unknown> }>;
}

export interface BlockArchitectureInfo {
  blockId: string;
  blockName: string;
  localImplementation: string;
  awsServices: string[];
  cloudFormationResources: string[];
}

export class CloudFormationBlockImpl extends Block {
  readonly definition: BlockDefinition = {
    id: 'cloudformation-block',
    name: 'CloudFormationBlock',
    description: 'Generates AWS CloudFormation templates from the Block graph. Maps to AWS CloudFormation.',
    awsServiceMapping: [
      {
        serviceName: 'AWS CloudFormation',
        serviceDescription: 'Infrastructure as Code service for provisioning AWS resources',
      },
    ],
    cloudFormationMapping: {
      resources: {},
    },
  };

  /**
   * Generate a complete CloudFormation template from all registered blocks.
   */
  generateCloudFormation(): CloudFormationTemplate {
    const allBlocks = blockRegistry.getAll();
    const resources: Record<string, CloudFormationResource> = {};
    const outputs: Record<string, { Description: string; Value: Record<string, unknown> }> = {};

    for (const block of allBlocks) {
      // Skip the CloudFormation block itself
      if (block.id === this.id) continue;

      const cfnMapping = block.cloudFormation;
      for (const [logicalId, resource] of Object.entries(cfnMapping.resources)) {
        resources[logicalId] = resource;
      }
    }

    // Generate outputs
    if (resources['UserPool']) {
      outputs['UserPoolId'] = {
        Description: 'Cognito User Pool ID',
        Value: { Ref: 'UserPool' },
      };
    }
    if (resources['UserPoolClient']) {
      outputs['UserPoolClientId'] = {
        Description: 'Cognito User Pool Client ID',
        Value: { Ref: 'UserPoolClient' },
      };
    }
    if (resources['WellnessTable']) {
      outputs['DynamoDBTableName'] = {
        Description: 'DynamoDB Table Name',
        Value: { Ref: 'WellnessTable' },
      };
    }
    if (resources['ApiGateway']) {
      outputs['ApiEndpoint'] = {
        Description: 'API Gateway Endpoint URL',
        Value: {
          'Fn::Sub': 'https://${ApiGateway}.execute-api.${AWS::Region}.amazonaws.com/prod',
        },
      };
    }

    return {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'WellnessBlock AI - Generated from Block architecture graph',
      Resources: resources,
      Outputs: outputs,
    };
  }

  /**
   * Get architecture info for all blocks (used by the UI).
   */
  getArchitectureInfo(): BlockArchitectureInfo[] {
    const allBlocks = blockRegistry.getAll();
    return allBlocks.map(block => ({
      blockId: block.id,
      blockName: block.name,
      localImplementation: this.getLocalImplementationDescription(block.id),
      awsServices: block.awsServices.map(s => s.serviceName),
      cloudFormationResources: Object.entries(block.cloudFormation.resources).map(
        ([logicalId, resource]) => `${logicalId} (${resource.type})`
      ),
    }));
  }

  private getLocalImplementationDescription(blockId: string): string {
    switch (blockId) {
      case 'auth-block':
        return 'In-memory session store with deterministic test users';
      case 'data-block':
        return 'JSON file-based persistence (.data/ directory)';
      case 'api-block':
        return 'Express.js HTTP server with session middleware';
      case 'ai-insight-block':
        return 'Deterministic local AI adapter with typed tools';
      case 'cloudformation-block':
        return 'Template generator from Block registry';
      default:
        return 'Local implementation';
    }
  }
}

export const cloudFormationBlock = new CloudFormationBlockImpl();
blockRegistry.register(cloudFormationBlock);
