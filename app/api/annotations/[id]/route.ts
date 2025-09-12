import { NextRequest, NextResponse } from 'next/server';

// Mock data for development - replace with your actual database
let mockAnnotations: any[] = [];

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const annotationId = params.id;

    if (!annotationId) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    // Find and remove annotation
    const index = mockAnnotations.findIndex((annotation) => annotation.id === annotationId);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    mockAnnotations.splice(index, 1);

    return NextResponse.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}