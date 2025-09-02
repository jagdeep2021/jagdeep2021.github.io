import { default as wasm, Mnist } from "./pkg/browser_models.js";

class ImageInferenceApp {
    constructor() {
        this.model = null;
        this.currentImage = null;
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        this.imageScale = 1;
        this.imageOffsetX = 0;
        this.imageOffsetY = 0;
        
        this.initElements();
        this.initEventListeners();
        this.loadModel();
    }
    
    initElements() {
        this.elements = {
            status: document.getElementById('status'),
            uploadSection: document.getElementById('uploadSection'),
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            instructions: document.getElementById('instructions'),
            canvasContainer: document.getElementById('canvasContainer'),
            originalCanvas: document.getElementById('originalCanvas'),
            croppedCanvas: document.getElementById('croppedCanvas'),
            resultCanvas: document.getElementById('resultCanvas'),
            clearBtn: document.getElementById('clearBtn'),
            inferenceBtn: document.getElementById('inferenceBtn'),
            cropInfo: document.getElementById('cropInfo'),
            croppedInfo: document.getElementById('croppedInfo'),
            resultInfo: document.getElementById('resultInfo')
        };
        
        this.ctx = {
            original: this.elements.originalCanvas.getContext('2d'),
            cropped: this.elements.croppedCanvas.getContext('2d'),
            result: this.elements.resultCanvas.getContext('2d')
        };
    }
    
    initEventListeners() {
        // File input
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        this.elements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.add('dragover');
        });
        
        this.elements.uploadArea.addEventListener('dragleave', () => {
            this.elements.uploadArea.classList.remove('dragover');
        });
        
        this.elements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
        
        // Click to upload
        this.elements.uploadArea.addEventListener('click', () => {
            this.elements.fileInput.click();
        });
        
        // Canvas mouse events
        this.elements.originalCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.elements.originalCanvas.addEventListener('mousemove', (e) => this.draw(e));
        this.elements.originalCanvas.addEventListener('mouseup', () => this.stopDrawing());
        this.elements.originalCanvas.addEventListener('mouseleave', () => this.stopDrawing());
    }
    
    async loadModel() {
        try {
            await wasm();
            this.model = new Mnist();
            this.updateStatus('Ready - Upload an image to get started', 'success');
        } catch (err) {
            this.updateStatus('Error loading WASM model: ' + err.message, 'error');
        }
    }
    
    updateStatus(message, type = 'loading') {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }
    
    handleFile(file) {
        if (!file.type.startsWith('image/')) {
            this.updateStatus('Please select a valid image file', 'error');
            return;
        }
        
        this.updateStatus('Loading image...', 'loading');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.displayImage();
                this.showInterface();
            };
            img.onerror = () => {
                this.updateStatus('Error loading image', 'error');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    displayImage() {
        // Use setTimeout to ensure container has rendered and has proper dimensions
        setTimeout(() => {
            const canvas = this.elements.originalCanvas;
            const ctx = this.ctx.original;
            
            // Get the container width to make canvas full width
            const container = canvas.parentElement;
            const containerWidth = container.offsetWidth - 40; // Account for padding
            
            const originalWidth = this.currentImage.width;
            const originalHeight = this.currentImage.height;
            
            // Calculate display size to fit container width while maintaining aspect ratio
            const aspectRatio = originalHeight / originalWidth;
            const displayWidth = Math.min(containerWidth, 1200); // Max width
            const displayHeight = displayWidth * aspectRatio;
            
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            
            // Calculate scale for coordinate conversion (canvas pixels to original image pixels)
            this.imageScale = originalWidth / displayWidth;
            this.imageScaleY = originalHeight / displayHeight;
            this.displayWidth = displayWidth;
            this.displayHeight = displayHeight;
            this.originalWidth = originalWidth;
            this.originalHeight = originalHeight;
            
            // Draw image
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(this.currentImage, 0, 0, displayWidth, displayHeight);
            
            // Update info display
            this.elements.cropInfo.textContent = `Image loaded: ${originalWidth}×${originalHeight}px - Draw selection box`;
            this.updateStatus(`Image ready (${originalWidth}×${originalHeight}) - Select area to crop`, 'success');
        }, 10); // Small delay to ensure layout is complete
    }
    
    showInterface() {
        this.elements.instructions.classList.remove('hidden');
        this.elements.canvasContainer.classList.remove('hidden');
    }
    
    getMousePos(e) {
        const rect = this.elements.originalCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startDrawing(e) {
        if (!this.currentImage) return;
        
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        this.endX = pos.x;
        this.endY = pos.y;
    }
    
    draw(e) {
        if (!this.isDrawing || !this.currentImage) return;
        
        const pos = this.getMousePos(e);
        this.endX = pos.x;
        this.endY = pos.y;
        
        this.redrawCanvas();
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        // Ensure we have a valid selection
        const width = Math.abs(this.endX - this.startX);
        const height = Math.abs(this.endY - this.startY);
        
        if (width > 5 && height > 5) {
            this.cropImage();
        }
    }
    
    redrawCanvas() {
        const canvas = this.elements.originalCanvas;
        const ctx = this.ctx.original;
        
        // Redraw image at display size
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.currentImage, 0, 0, this.displayWidth, this.displayHeight);
        
        // Draw selection rectangle
        if (this.isDrawing || (this.startX !== this.endX && this.startY !== this.endY)) {
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            
            const x = Math.min(this.startX, this.endX);
            const y = Math.min(this.startY, this.endY);
            const width = Math.abs(this.endX - this.startX);
            const height = Math.abs(this.endY - this.startY);
            
            ctx.strokeRect(x, y, width, height);
            
            // Semi-transparent overlay outside selection
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, canvas.width, y); // Top
            ctx.fillRect(0, y + height, canvas.width, canvas.height - y - height); // Bottom
            ctx.fillRect(0, y, x, height); // Left
            ctx.fillRect(x + width, y, canvas.width - x - width, height); // Right
            
            ctx.setLineDash([]);
            
            // Show crop dimensions in original image resolution
            const origWidth = Math.abs(this.endX - this.startX) * this.imageScale;
            const origHeight = Math.abs(this.endY - this.startY) * this.imageScaleY;
            
            if (origWidth > 10 && origHeight > 10) {
                ctx.fillStyle = '#007bff';
                ctx.font = 'bold 14px Arial';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(`${Math.round(origWidth)}×${Math.round(origHeight)}px`, x + 5, y - 8);
                ctx.fillText(`${Math.round(origWidth)}×${Math.round(origHeight)}px`, x + 5, y - 8);
                
                // Update info display
                this.elements.cropInfo.textContent = `Selection: ${Math.round(origWidth)}×${Math.round(origHeight)}px from original`;
            }
        }
    }
    
    cropImage() {
        // Calculate crop coordinates in ORIGINAL image space (full resolution)
        const displayX = Math.min(this.startX, this.endX);
        const displayY = Math.min(this.startY, this.endY);
        const displayWidth = Math.abs(this.endX - this.startX);
        const displayHeight = Math.abs(this.endY - this.startY);
        
        // Convert display coordinates to original image coordinates
        const originalX = displayX * this.imageScale;
        const originalY = displayY * this.imageScaleY;
        const originalWidth = displayWidth * this.imageScale;
        const originalHeight = displayHeight * this.imageScaleY;
        
        // Ensure we don't go outside image bounds
        const clampedX = Math.max(0, Math.min(originalX, this.originalWidth - 1));
        const clampedY = Math.max(0, Math.min(originalY, this.originalHeight - 1));
        const clampedWidth = Math.min(originalWidth, this.originalWidth - clampedX);
        const clampedHeight = Math.min(originalHeight, this.originalHeight - clampedY);
        
        console.log(`Cropping from original ${this.originalWidth}×${this.originalHeight} image:`);
        console.log(`  Display selection: ${displayX},${displayY} ${displayWidth}×${displayHeight}`);
        console.log(`  Original coords: ${clampedX.toFixed(1)},${clampedY.toFixed(1)} ${clampedWidth.toFixed(1)}×${clampedHeight.toFixed(1)}`);
        
        // Create temporary canvas for high-resolution cropping
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = clampedWidth;
        tempCanvas.height = clampedHeight;
        
        // Draw cropped portion directly from original full-resolution image
        tempCtx.drawImage(
            this.currentImage,
            clampedX, clampedY, clampedWidth, clampedHeight,  // Source rectangle (original image)
            0, 0, clampedWidth, clampedHeight                 // Destination rectangle (temp canvas)
        );
        
        // Now resize and convert to grayscale at 256x256
        this.processImage(tempCanvas);
    }
    
    processImage(sourceCanvas) {
        const croppedCanvas = this.elements.croppedCanvas;
        const ctx = this.ctx.cropped;
        
        console.log(`Processing image: ${sourceCanvas.width}×${sourceCanvas.height} → 256×256`);
        
        // Use high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw resized image to 256x256
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(sourceCanvas, 0, 0, 256, 256);
        
        // Convert to grayscale
        const imageData = ctx.getImageData(0, 0, 256, 256);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // Use luminance formula for better grayscale conversion
            const grayscale = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            data[i] = grayscale;     // Red
            data[i + 1] = grayscale; // Green
            data[i + 2] = grayscale; // Blue
            // Alpha remains unchanged
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Enable inference button
        this.elements.inferenceBtn.disabled = false;
        this.elements.croppedInfo.textContent = 'Processed to 256×256 grayscale - Ready for AI!';
        this.updateStatus('Image cropped from full resolution and processed - Ready for inference', 'success');
    }
    
    async runInference() {
        if (!this.model) {
            this.updateStatus('Model not loaded', 'error');
            return;
        }
        
        this.updateStatus('Running inference...', 'loading');
        this.elements.inferenceBtn.disabled = true;
        
        try {
            // Get image data from cropped canvas
            const imageData = this.ctx.cropped.getImageData(0, 0, 256, 256);
            const pixels = imageData.data;
            
            // Convert to Float32Array (normalized to 0-1)
            const input = new Float32Array(256 * 256);
            for (let i = 0; i < input.length; i++) {
                // Use red channel (they're all the same since it's grayscale)
                input[i] = pixels[i * 4] / 255.0;
            }
            
            // Run inference
            const output = await this.model.inference(input);
            const outputArray = new Float32Array(output);
            
            // Display result
            this.displayResult(outputArray);
            
            this.elements.resultInfo.textContent = `AI inference completed! Output: 256×256 result image`;
            this.updateStatus('🎉 Inference completed successfully!', 'success');
            
        } catch (err) {
            this.updateStatus('Inference failed: ' + err.message, 'error');
        } finally {
            this.elements.inferenceBtn.disabled = false;
        }
    }
    
    displayResult(outputArray) {
        const canvas = this.elements.resultCanvas;
        const ctx = this.ctx.result;
        
        // Create image data from output array
        const imageData = ctx.createImageData(256, 256);
        const data = imageData.data;
        
        for (let i = 0; i < outputArray.length; i++) {
            const value = Math.max(0, Math.min(255, outputArray[i] * 255));
            const pixelIndex = i * 4;
            
            data[pixelIndex] = value;     // Red
            data[pixelIndex + 1] = value; // Green
            data[pixelIndex + 2] = value; // Blue
            data[pixelIndex + 3] = 255;   // Alpha
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    clearSelection() {
        this.startX = 0;
        this.startY = 0;
        this.endX = 0;
        this.endY = 0;
        
        if (this.currentImage) {
            this.displayImage();
        }
        
        // Clear cropped and result canvases
        this.ctx.cropped.clearRect(0, 0, 256, 256);
        this.ctx.result.clearRect(0, 0, 256, 256);
        
        // Reset info displays
        this.elements.cropInfo.textContent = 'Draw a selection box to crop';
        this.elements.croppedInfo.textContent = '256×256 grayscale ready';
        this.elements.resultInfo.textContent = 'AI output will appear here';
        
        // Disable inference button
        this.elements.inferenceBtn.disabled = true;
    }
}

// Initialize the app
const app = new ImageInferenceApp();

// Make app available globally for button onclick handlers
window.app = app;
