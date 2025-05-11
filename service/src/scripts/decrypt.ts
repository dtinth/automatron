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
      console.error('Decryption failed:', error.message)
      process.exit(1)
    }
  })
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})