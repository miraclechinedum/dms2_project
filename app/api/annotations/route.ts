import { NextRequest, NextResponse } from 'next/server';

// Mock data for development - replace with your actual database
let mockAnnotations: any[] = [];
let nextId = 1;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const pageNumber = searchParams.get('pageNumber');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Filter annotations by document ID and optionally by page number
    let filteredAnnotations = mockAnnotations.filter(
      (annotation) => annotation.document_id === documentId
    );

    if (pageNumber) {
      filteredAnnotations = filteredAnnotations.filter(
        (annotation) => annotation.page_number === parseInt(pageNumber)
      );
    }

    return NextResponse.json({ annotations: filteredAnnotations });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      documentId,
      pageNumber,
      annotationType,
      content,
      sequenceNumber,
      positionX,
      positionY,
    } = body;

    // Validate required fields
    if (!documentId || !pageNumber || !annotationType || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create new annotation
    const newAnnotation = {
      id: `annotation_${nextId++}`,
      document_id: documentId,
      user_id: 'current_user_id', // Replace with actual user ID from session
      page_number: pageNumber,
      annotation_type: annotationType,
      content,
      sequence_number: sequenceNumber || 1,
      position_x: positionX || 0,
      position_y: positionY || 0,
      created_at: new Date().toISOString(),
      user_name: 'Current User', // Replace with actual user name
    };

    mockAnnotations.push(newAnnotation);

    return NextResponse.json({ annotation: newAnnotation }, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('id');

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