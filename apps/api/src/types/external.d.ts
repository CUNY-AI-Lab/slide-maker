declare module 'pdf-parse' {
  const pdfParse: (buffer: Buffer) => Promise<{ text: string }>
  export default pdfParse
}

declare module 'turndown' {
  export default class TurndownService {
    constructor(options?: { headingStyle?: string; codeBlockStyle?: string })
    turndown(html: string): string
  }
}

