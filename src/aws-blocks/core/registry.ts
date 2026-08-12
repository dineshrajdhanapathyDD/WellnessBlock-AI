/**
 * BlockRegistry - Central registry for all Blocks in the application.
 * Used to generate CloudFormation and display architecture.
 */

import { Block } from './block';

class BlockRegistry {
  private blocks: Map<string, Block> = new Map();

  register(block: Block): void {
    this.blocks.set(block.id, block);
  }

  get(id: string): Block | undefined {
    return this.blocks.get(id);
  }

  getAll(): Block[] {
    return Array.from(this.blocks.values());
  }

  has(id: string): boolean {
    return this.blocks.has(id);
  }
}

export const blockRegistry = new BlockRegistry();
