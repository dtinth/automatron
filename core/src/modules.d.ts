declare module '@google-cloud/vision' {
  export class ImageAnnotatorClient {
    constructor(options?: any)
    documentTextDetection(
      imageBuffer: Buffer
    ): Promise<
      {
        fullTextAnnotation: {
          pages: {
            blocks: {
              paragraphs: {
                words: {
                  symbols: {
                    text: string
                  }[]
                }[]
              }[]
            }[]
          }[]
        }
      }[]
    >
  }
}

declare module 'airtable' {
  export interface AirtableRecord {
    get(field: string): any
    getId(): string
  }
  export default class Airtable {
    constructor(options: any)
    base(
      id: string
    ): {
      table(
        name: string
      ): {
        select(
          options?: any
        ): {
          all(): Promise<AirtableRecord[]>
        }
        create(data: any, options?: any): Promise<AirtableRecord>
        update(id: string, data: any): Promise<AirtableRecord>
      }
    }
  }
}
