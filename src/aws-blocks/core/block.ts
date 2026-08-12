/**
 * Block - The core abstraction for WellnessBlock AI.
 * Every Block has a stable ID, schema, local implementation, AWS service mapping, and CloudFormation mapping.
 */

export interface AwsServiceMapping {
  serviceName: string;
  serviceDescription: string;
}

export interface CloudFormationResource {
  type: string;
  properties: Record<string, unknown>;
}

export interface CloudFormationMapping {
  resources: Record<string, CloudFormationResource>;
}

export interface BlockDefinition {
  id: string;
  name: string;
  description: string;
  awsServiceMapping: AwsServiceMapping[];
  cloudFormationMapping: CloudFormationMapping;
}

export abstract class Block {
  abstract readonly definition: BlockDefinition;

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get awsServices(): AwsServiceMapping[] {
    return this.definition.awsServiceMapping;
  }

  get cloudFormation(): CloudFormationMapping {
    return this.definition.cloudFormationMapping;
  }
}
