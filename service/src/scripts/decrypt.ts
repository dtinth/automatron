import { decryptText } from '../encryption.ts'
import * as readline from 'readline'

async function main() {
  // Read from stdin
  let input = ''
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  rl.on('line', (line) => {
    input += line + '\n'
  })

  rl.on('close', async () => {
    try {
      // Trim trailing newline if present
      input = input.trim()
      
      // Decrypt the input
      const decrypted = await decryptText(input)
      
      // Output the decrypted content
      console.log(decrypted)
    } catch (error) {
      if (error instanceof Error) {
        console.error('Decryption failed:', error.message)
      } else {
        console.error('Decryption failed:', String(error))
      }
      process.exit(1)
    }
  })
}

main().catch(e => { // Renamed error to e to avoid conflict if it's not an Error instance
  if (e instanceof Error) {
    console.error('Error:', e.message)
  } else {
    console.error('Error:', String(e))
  }
  process.exit(1)
})