# WebViewer Setup

To complete the Apryse WebViewer integration, you need to:

1. **Get a License Key**
   - Visit https://apryse.com/
   - Sign up for a free trial or purchase a license
   - Replace `YOUR_LICENSE_KEY_HERE` in the WebViewer component

2. **Download WebViewer Files**
   - Download the WebViewer package from Apryse
   - Extract the `/lib` folder contents to `/public/webviewer/`
   - The structure should be:
     ```
     /public/webviewer/
       - core/
       - ui/
       - webviewer.min.js
       - pdf.worker.min.js (and other worker files)
     ```

3. **Alternative: Use CDN (for development)**
   - You can also load WebViewer from CDN by modifying the WebViewer import:
   ```javascript
   // In WebViewer.tsx, replace the import with:
   const WebViewer = await import('https://lib.pdftron.com/webviewer/latest/webviewer.min.js');
   ```

## Features Included

- ✅ Sticky Note annotations
- ✅ Freehand drawing/writing
- ✅ Color customization for annotations
- ✅ Save annotations to your API
- ✅ Load existing annotations
- ✅ Export PDF with annotations
- ✅ Page navigation and zoom controls
- ✅ Professional PDF rendering

## License

This integration requires an Apryse WebViewer license for production use. 
The trial license includes a watermark that will be removed with a paid license.