document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const resultSection = document.getElementById('result-section');
    const downloadBtn = document.getElementById('download-btn');
    const compressionStats = document.getElementById('compression-stats');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when dragging over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);
    
    // Handle file input change
    fileInput.addEventListener('change', handleFiles);

    // Handle form submission
    uploadForm.addEventListener('submit', handleSubmit);

    function preventDefaults (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.classList.add('border-blue-600');
    }

    function unhighlight(e) {
        dropZone.classList.remove('border-blue-600');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files instanceof FileList) {
            files = Array.from(files);
        } else if (files instanceof Event) {
            files = Array.from(files.target.files);
        }
        
        files = files.filter(file => file.type === 'application/pdf');
        
        if (files.length === 0) {
            alert('Please upload PDF files only');
            return;
        }

        if (files[0].size > 10 * 1024 * 1024) { // 10MB limit
            alert('File size must be less than 10MB');
            return;
        }

        files.forEach(compressPDF);
    }

    async function compressPDF(file) {
        try {
            // Show progress section and hide result
            document.getElementById('progress-section').classList.remove('hidden');
            resultSection.classList.add('hidden');
            
            updateProgress(10);
            
            // Read the PDF file
            const arrayBuffer = await file.arrayBuffer();
            updateProgress(20);
            
            // Load the PDF document with error handling for password protection
            let pdfDoc;
            try {
                pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
            } catch (err) {
                if (err.message && err.message.toLowerCase().includes('encrypted')) {
                    throw new Error('The PDF is password protected. Please upload an unprotected file.');
                } else {
                    throw err;
                }
            }
            updateProgress(50);

            // Create a new document
            const compressedPdf = await PDFLib.PDFDocument.create();
            updateProgress(60);

            // Copy pages from original to new document
            const pages = await compressedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            updateProgress(70);

            // Add pages to new document
            pages.forEach(page => compressedPdf.addPage(page));
            updateProgress(85);

            // Save with compression options
            const compressedPdfBytes = await compressedPdf.save({
                useObjectStreams: true,
                addDefaultPage: false,
                objectsPerTick: 20,
                updateFieldAppearances: false,
                compress: true
            });
            
            updateProgress(95);

            // Create download blob
            const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            
            // Calculate compression stats
            const originalSize = file.size;
            const compressedSize = blob.size;
            const savedSize = originalSize - compressedSize;
            const savingPercentage = Math.round((savedSize / originalSize) * 100);
            
            // Update compression stats
            compressionStats.innerHTML = `
                <p class="mb-2">Original size: ${formatBytes(originalSize)}</p>
                <p class="mb-2">Compressed size: ${formatBytes(compressedSize)}</p>
                <p class="text-green-600">Saved: ${formatBytes(savedSize)} (${savingPercentage}%)</p>
            `;
            
            // Enable and setup download button
            downloadBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            downloadBtn.classList.add('hover:bg-blue-700');
            downloadBtn.disabled = false;
            
            // Setup download handler
            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `compressed_${file.name}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
            };
            
            // Show results
            document.getElementById('progress-section').classList.add('hidden');
            resultSection.classList.remove('hidden');
            updateProgress(100);
            
        } catch (error) {
            console.error('Error compressing PDF:', error);
            alert(error.message || 'Error compressing PDF. Please make sure the file is not corrupted or password protected.');
            document.getElementById('progress-section').classList.add('hidden');
            resultSection.classList.add('hidden');
        }
    }

    function updateProgress(percent) {
        progressBar.style.width = percent + '%';
        progressText.textContent = percent + '%';
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleSubmit(e) {
        e.preventDefault();
        const files = fileInput.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    }
});
