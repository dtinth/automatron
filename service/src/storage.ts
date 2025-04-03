import { createStorage } from 'unstorage'
import azureStorageTableDriver from 'unstorage/drivers/azure-storage-table'
import { decrypter } from './encryption.ts'

export const azureStorageConnectionString = await decrypter.decrypt(
  Buffer.from(
    process.env.ENCRYPTED_AZURE_STORAGE_CONNECTION_STRING_BASE64!,
    'base64'
  ),
  'text'
)

export const storage = createStorage({
  driver: (
    azureStorageTableDriver as unknown as typeof azureStorageTableDriver.default
  )({
    connectionString: azureStorageConnectionString,
    accountName: 'automatron',
    tableName: 'config',
  }),
})
