import { NextRequest, NextResponse } from 'next/server';
import PDFParser from 'pdf2json';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new Promise<NextResponse>((resolve) => {
      const pdfParser = new PDFParser(null, true);
      
      pdfParser.on("pdfParser_dataError", errData => {
        console.error("Error parsing PDF:", (errData as any).parserError || errData);
        resolve(NextResponse.json({ error: 'Failed to parse PDF file.' }, { status: 500 }));
      });
      
      pdfParser.on("pdfParser_dataReady", pdfData => {
        resolve(NextResponse.json({ text: pdfParser.getRawTextContent() }));
      });
      
      pdfParser.parseBuffer(buffer);
    });
    
  } catch (error) {
    console.error("Error handling PDF upload:", error);
    return NextResponse.json({ error: 'Failed to process request.' }, { status: 500 });
  }
}
