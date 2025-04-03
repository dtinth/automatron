import { readFileSync } from 'fs'
import { parse } from 'yaml'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { config } from '../config.ts'

const argv = yargs(hideBin(process.argv))
  .option('file', {
    alias: 'f',
    describe: 'YAML file containing configuration values',
    type: 'string',
    demandOption: true,
  })
  .help()
  .epilogue('Example: pnpm node src/scripts/updateConfig.ts --file config.yaml')
  .parseSync()

async function main() {
  const fileContent = readFileSync(argv.file, 'utf-8')
  const configs = parse(fileContent)

  if (typeof configs !== 'object' || configs === null) {
    throw new Error('YAML file must contain an object')
  }

  for (const [key, value] of Object.entries(configs)) {
    await config.set(key, value)
  }

  console.log(`Configuration updated from file: ${argv.file}`)
}

await main()
