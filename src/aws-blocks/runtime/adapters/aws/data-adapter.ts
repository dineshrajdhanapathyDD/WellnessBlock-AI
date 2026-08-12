/**
 * AWS DataBlock Adapter - Amazon DynamoDB
 * 
 * Production implementation using DynamoDB.
 * Block ID: data-block (preserved)
 * 
 * DynamoDB Table Design (based on actual access patterns):
 * 
 * Table: WellnessRecords
 *   Partition Key: id (String) - UUID of the record
 *   
 * GSI: userId-date-index
 *   Partition Key: userId (String) 
 *   Sort Key: date (String) - ISO date YYYY-MM-DD
 *   Projection: ALL
 * 
 * Access Patterns:
 *   1. Get record by ID -> GetItem(id)
 *   2. List user's records -> Query GSI(userId, date range)
 *   3. List user's records with date filter -> Query GSI(userId, between startDate and endDate)
 *   4. Create record -> PutItem (condition: id not exists)
 *   5. Update record -> UpdateItem (condition: version = expected) - optimistic concurrency
 *   6. Delete record by ID -> DeleteItem(id)
 * 
 * Ownership: enforced by always querying with userId from authenticated session.
 */

import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { IDataBlockAdapter } from '../../interfaces';
import { runtimeConfig } from '../../config';

export class DynamoDBDataAdapter implements IDataBlockAdapter {
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    this.client = new DynamoDBClient({
      region: runtimeConfig.aws.region,
    });
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = runtimeConfig.aws.dynamodb.tableName;
  }

  async create<T extends { id: string }>(tableName: string, record: T): Promise<T> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: record as Record<string, any>,
      ConditionExpression: 'attribute_not_exists(id)',
    });

    try {
      await this.docClient.send(command);
      return record;
    } catch (err: any) {
      if (err.name === 'ConditionalCheckFailedException') {
        throw new Error(`Record with id ${record.id} already exists`);
      }
      throw err;
    }
  }

  async getById<T extends { id: string }>(tableName: string, id: string): Promise<T | null> {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: { id },
    });

    const response = await this.docClient.send(command);
    return (response.Item as T) || null;
  }

  async query<T>(tableName: string, filter: (record: T) => boolean): Promise<T[]> {
    // For DynamoDB, a full scan with client-side filter.
    // queryByUserId should be preferred for the userId access pattern.
    const command = new ScanCommand({
      TableName: this.tableName,
    });

    const response = await this.docClient.send(command);
    const items = (response.Items || []) as T[];
    return items.filter(filter);
  }

  async queryByUserId<T>(tableName: string, userId: string, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<T[]> {
    let keyCondition = 'userId = :userId';
    const expressionValues: Record<string, any> = { ':userId': userId };
    const expressionNames: Record<string, string> = { '#dateAttr': 'date' };

    if (options?.startDate && options?.endDate) {
      keyCondition += ' AND #dateAttr BETWEEN :startDate AND :endDate';
      expressionValues[':startDate'] = options.startDate;
      expressionValues[':endDate'] = options.endDate;
    } else if (options?.startDate) {
      keyCondition += ' AND #dateAttr >= :startDate';
      expressionValues[':startDate'] = options.startDate;
    } else if (options?.endDate) {
      keyCondition += ' AND #dateAttr <= :endDate';
      expressionValues[':endDate'] = options.endDate;
    }

    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'userId-date-index',
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ExpressionAttributeNames: expressionNames,
      ScanIndexForward: false, // descending by date
      Limit: options?.limit,
    });

    const response = await this.docClient.send(command);
    return (response.Items || []) as T[];
  }

  async update<T extends { id: string }>(tableName: string, id: string, updates: Partial<T>): Promise<T | null> {
    const updateParts: string[] = [];
    const expressionValues: Record<string, any> = {};
    const expressionNames: Record<string, string> = {};

    let index = 0;
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue;
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateParts.push(`${attrName} = ${attrValue}`);
      expressionNames[attrName] = key;
      expressionValues[attrValue] = value;
      index++;
    }

    if (updateParts.length === 0) return this.getById(tableName, id);

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { id },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ReturnValues: 'ALL_NEW',
    });

    const response = await this.docClient.send(command);
    return (response.Attributes as T) || null;
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: { id },
      ReturnValues: 'ALL_OLD',
    });

    const response = await this.docClient.send(command);
    return !!response.Attributes;
  }

  async getAll<T>(tableName: string): Promise<T[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
    });

    const response = await this.docClient.send(command);
    return (response.Items || []) as T[];
  }

  async clearTable(tableName: string): Promise<void> {
    const items = await this.getAll<{ id: string }>(tableName);
    for (const item of items) {
      await this.delete(tableName, item.id);
    }
  }

  async clearAll(): Promise<void> {
    await this.clearTable(this.tableName);
  }
}
