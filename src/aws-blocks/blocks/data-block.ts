/**
 * DataBlock - Durable local persistence using JSON files.
 * AWS Mapping: Amazon DynamoDB
 * 
 * Data survives server restarts by persisting to disk.
 * All data operations go through this block - no direct file/DB access.
 */

import { Block, BlockDefinition } from '../core/block';
import { blockRegistry } from '../core/registry';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', '.data')
  : path.join(process.cwd(), '.data');

export class DataBlockImpl extends Block {
  readonly definition: BlockDefinition = {
    id: 'data-block',
    name: 'DataBlock',
    description: 'Durable local persistence using JSON file storage. Maps to Amazon DynamoDB in AWS.',
    awsServiceMapping: [
      {
        serviceName: 'Amazon DynamoDB',
        serviceDescription: 'Fully managed NoSQL database with single-digit millisecond performance',
      },
    ],
    cloudFormationMapping: {
      resources: {
        WellnessTable: {
          type: 'AWS::DynamoDB::Table',
          properties: {
            TableName: 'WellnessRecords',
            AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' },
              { AttributeName: 'userId', AttributeType: 'S' },
              { AttributeName: 'date', AttributeType: 'S' },
            ],
            KeySchema: [
              { AttributeName: 'id', KeyType: 'HASH' },
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'userId-date-index',
                KeySchema: [
                  { AttributeName: 'userId', KeyType: 'HASH' },
                  { AttributeName: 'date', KeyType: 'RANGE' },
                ],
                Projection: { ProjectionType: 'ALL' },
              },
            ],
            BillingMode: 'PAY_PER_REQUEST',
          },
        },
      },
    },
  };

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private getTablePath(tableName: string): string {
    return path.join(DATA_DIR, `${tableName}.json`);
  }

  private readTable<T>(tableName: string): T[] {
    this.ensureDataDir();
    const filePath = this.getTablePath(tableName);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T[];
  }

  private writeTable<T>(tableName: string, data: T[]): void {
    this.ensureDataDir();
    const filePath = this.getTablePath(tableName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Create a record in the specified table.
   */
  create<T extends { id: string }>(tableName: string, record: T): T {
    const records = this.readTable<T>(tableName);
    records.push(record);
    this.writeTable(tableName, records);
    return record;
  }

  /**
   * Get a single record by ID.
   */
  getById<T extends { id: string }>(tableName: string, id: string): T | null {
    const records = this.readTable<T>(tableName);
    return records.find(r => r.id === id) || null;
  }

  /**
   * Query records by a filter function.
   */
  query<T>(tableName: string, filter: (record: T) => boolean): T[] {
    const records = this.readTable<T>(tableName);
    return records.filter(filter);
  }

  /**
   * Update a record by ID.
   */
  update<T extends { id: string }>(tableName: string, id: string, updates: Partial<T>): T | null {
    const records = this.readTable<T>(tableName);
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;
    records[index] = { ...records[index], ...updates };
    this.writeTable(tableName, records);
    return records[index];
  }

  /**
   * Delete a record by ID.
   */
  delete(tableName: string, id: string): boolean {
    const records = this.readTable<{ id: string }>(tableName);
    const filtered = records.filter(r => r.id !== id);
    if (filtered.length === records.length) return false;
    this.writeTable(tableName, filtered);
    return true;
  }

  /**
   * Get all records from a table.
   */
  getAll<T>(tableName: string): T[] {
    return this.readTable<T>(tableName);
  }

  /**
   * Clear all data in a table.
   */
  clearTable(tableName: string): void {
    this.writeTable(tableName, []);
  }

  /**
   * Clear all data (used by reset script).
   */
  clearAll(): void {
    this.ensureDataDir();
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(DATA_DIR, file));
      }
    }
  }
}

export const dataBlock = new DataBlockImpl();
blockRegistry.register(dataBlock);
