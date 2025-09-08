const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  original_filename: string;
  bytes: number;
  format: string;
  resource_type: string;
}

export class CloudinaryService {
  /**
   * Upload a file buffer to Cloudinary
   */
  static async uploadFile(
    buffer: Buffer,
    originalName: string,
    folder: string = 'documents',
    options: any = {}
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: folder,
        resource_type: options.resource_type || 'raw', // Use 'raw' for PDFs
        public_id: `${Date.now()}-${originalName.replace(/\.[^/.]+$/, "")}`, // Remove extension, Cloudinary will add it
        use_filename: true,
        unique_filename: true,
        ...options,
      };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else if (result) {
            resolve({
              public_id: result.public_id,
              secure_url: result.secure_url,
              original_filename: result.original_filename || originalName,
              bytes: result.bytes,
              format: result.format,
              resource_type: result.resource_type,
            });
          } else {
            reject(new Error('Upload failed - no result returned'));
          }
        }
      ).end(buffer);
    });
  }

  /**
   * Delete a file from Cloudinary
   */
  static async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw error;
    }
  }

  /**
   * Get optimized URL for document viewing
   */
  static getOptimizedUrl(publicId: string, options?: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  }): string {
    return cloudinary.url(publicId, {
      ...options,
      secure: true,
      sign_url: true, // Add signature for security
    });
  }

  /**
   * Generate a signed URL for secure document access
   */
  static getSignedUrl(publicId: string, expiresIn: number = 86400): string {
    // 24 hours expiry for document access
    const timestamp = Math.round(Date.now() / 1000);
    
    return cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      expires_at: timestamp + expiresIn,
    });
  }

  /**
   * Get a public URL that works with PDF viewers
   */
  static getPublicPdfUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      secure: true,
      resource_type: 'raw', // Important for PDF files
      type: 'upload',
      flags: 'attachment', // This helps with PDF viewing
    });
  }
}

export default cloudinary;