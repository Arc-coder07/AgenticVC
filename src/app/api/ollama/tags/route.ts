import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      cache: 'no-store'
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch tags from Ollama' }, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
