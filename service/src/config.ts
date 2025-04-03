import { createCache } from 'async-cache-dedupe'
import consola from 'consola'
import { storage } from './storage.ts'

class Config {
  cache = createCache({ ttl: 30, stale: 300 }).define(
    'fetchConfigValue',
    async (key: string) => {
      const value = storage.get(key)
      consola.debug('Refreshed config value for:', key)
      return value
    }
  )
  async get(key: string) {
    return this.cache.fetchConfigValue(key)
  }
  async set(key: string, value: any) {
    await storage.set(key, value)
    consola.info('Updated config value for:', key)
    this.cache.clear('fetchConfigValue', [key])
    return value
  }
}

export const config = new Config()
