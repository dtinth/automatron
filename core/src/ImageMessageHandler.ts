import vision from '@google-cloud/vision'
import { ref } from './PersistentState'
import { getBlob, getBlobUrl } from './TemporaryBlobStorage'
import { TextMessage, TextMessageHandler } from './types'

export const ImageMessageHandler: TextMessageHandler = (text, context) => {
  if (text.startsWith('image:')) {
    return async () => {
      const blobName = text.slice(6)
      await ref(context, 'latestImage').set(blobName)
      return [{ type: 'text', text: blobName }]
    }
  }
  if (text === 'annotate') {
    return async () => {
      const blobName = await ref(context, 'latestImage').get()
      return await annotateImage(blobName)
    }
  }
  if (text === 'image url') {
    return async () => {
      const blobName = await ref(context, 'latestImage').get()
      return await getBlobUrl(blobName)
    }
  }
}

async function annotateImage(blobName: string) {
  const buffer = await getBlob(blobName)
  const imageAnnotator = new vision.ImageAnnotatorClient()
  const results = await imageAnnotator.documentTextDetection(buffer)
  const fullTextAnnotation = results[0].fullTextAnnotation
  const blocks: string[] = []
  for (const page of fullTextAnnotation.pages) {
    blocks.push(
      ...page.blocks.map((block) => {
        return block.paragraphs
          .map((p) =>
            p.words.map((w) => w.symbols.map((s) => s.text).join('')).join(' ')
          )
          .join('\n\n')
      })
    )
  }
  const blocksToResponses = (blocks: string[]) => {
    if (blocks.length <= 4) return blocks
    let processedIndex = 0
    const outBlocks = []
    for (let i = 0; i < 4; i++) {
      const targetIndex = Math.ceil(((i + 1) * blocks.length) / 4)
      outBlocks.push(
        blocks
          .slice(processedIndex, targetIndex)
          .map((x) => `・ ${x}`)
          .join('\n')
      )
      processedIndex = targetIndex
    }
    return outBlocks
  }
  const responses = blocksToResponses(blocks)
  return [...responses.map((r): TextMessage => ({ type: 'text', text: r }))]
}
