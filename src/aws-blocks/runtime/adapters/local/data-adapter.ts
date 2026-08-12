/**
 * Local DataBlock Adapter
 * 
 * Wraps the existing DataBlockImpl to conform to IDataBlockAdapter.
 * No changes to existing local logic - just async interface compliance.
 */

import { IDataBlockAdapter } from '../../interfaces';
import { DataBlockImpl } from '../../../blocks/data-block';

interface HasUserIdAndDate {
  userId: string;
  date: string;
}

export class LocalDataAdapter implements IDataBlockAdapter {
  private impl: DataBlockImpl;

  constructor(impl: DataBlockImpl) {
    this.impl = impl;
  }

  async create<T extends { id: string }>(tableName: string, record: T): Promise<T> {
    return this.impl.create(tableName, record);
  }

  async getById<T extends { id: string }>(tableName: string, id: string): Promise<T | null> {
    return this.impl.getById<T>(tableName, id);
  }

  async query<T>(tableName: string, filter: (record: T) => boolean): Promise<T[]> {
    return this.impl.query<T>(tableName, filter);
  }

  async queryByUserId<T>(tableName: string, userId: string, options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<T[]> {
    let records = this.impl.query<T & HasUserIdAndDate>(
      tableName,
      (r: T & HasUserIdAndDate) => r.userId === userId
    );

    if (options?.startDate) {
      records = records.filter((r: HasUserIdAndDate) => r.date >= options.startDate!);
    }
    if (options?.endDate) {
      records = records.filter((r: HasUserIdAndDate) => r.date <= options.endDate!);
    }

    records.sort((a: HasUserIdAndDate, b: HasUserIdAndDate) => b.date.localeCompare(a.date));

    if (options?.limit) {
      records = records.slice(0, options.limit);
    }

    return records as unknown as T[];
  }

  async update<T extends { id: string }>(tableName: string, id: string, updates: Partial<T>): Promise<T | null> {
    return this.impl.update<T>(tableName, id, updates);
  }

  async delete(tableName: string, id: string): Promise<boolean> {
    return this.impl.delete(tableName, id);
  }

  async getAll<T>(tableName: string): Promise<T[]> {
    return this.impl.getAll<T>(tableName);
  }

  async clearTable(tableName: string): Promise<void> {
    this.impl.clearTable(tableName);
  }

  async clearAll(): Promise<void> {
    this.impl.clearAll();
  }
}
