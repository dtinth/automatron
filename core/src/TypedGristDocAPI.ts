import type { GristDocAPI } from 'grist-api'

// From: https://dt.in.th/GristTypeGenerator
export interface TypedGristDocAPI<Tables extends AnyTables>
  extends Omit<
    GristDocAPI,
    | 'fetchTable'
    | 'addRecords'
    | 'deleteRecords'
    | 'updateRecords'
    | 'syncTable'
  > {
  fetchTable<TableName extends keyof Tables>(
    tableName: TableName,
    filters?: FilterSpec<Tables[TableName]>
  ): Promise<Tables[TableName][]>
  addRecords<TableName extends keyof Tables>(
    tableName: TableName,
    records: Partial<Tables[TableName]>[]
  ): Promise<number[]>
  deleteRecords<TableName extends keyof Tables>(
    tableName: TableName,
    recordIds: number[]
  ): Promise<void>
  updateRecords<TableName extends keyof Tables>(
    tableName: TableName,
    records: (Partial<Tables[TableName]> & { id: number })[]
  ): Promise<void>
  syncTable<TableName extends keyof Tables>(
    tableName: TableName,
    records: Partial<Tables[TableName]>[],
    keyColIds: (keyof Tables[TableName])[],
    options?: { filters?: FilterSpec<Tables[TableName]> }
  ): Promise<void>
}
export type AnyTable = { [colId: string]: unknown }
export type AnyTables = { [table: string]: AnyTable }
export type FilterSpec<Table extends AnyTable> = {
  [ColId in keyof Table]?: Table[ColId][]
}
