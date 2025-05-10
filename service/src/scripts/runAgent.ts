import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createNewThread, runAgent } from '../agent/index.ts'

const argv = yargs(hideBin(process.argv))
  .option('text', {
    alias: 't',
    describe: 'Input text for the agent',
    type: 'string',
    demandOption: true,
  })
  .help()
  .epilogue('Example: pnpm node src/scripts/runAgent.ts --text "Hello, Virta!"')
  .parseSync()

async function main() {
  const messages = createNewThread({ text: argv.text })
  const result = await runAgent(messages)
  // console.log('Agent response:', result.text)
}

await main()
