import { db } from './firebase-config.js';
import { ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// DOM Elements
const imgCodeInput = document.getElementById('img-code');
const imgDescInput = document.getElementById('img-desc');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('img-file');
const startCamBtn = document.getElementById('start-cam-btn');
const camModal = document.getElementById('camera-modal');
const closeCamBtn = document.getElementById('close-cam-btn');
const video = document.getElementById('webcam-video');
const captureBtn = document.getElementById('capture-btn');
const camLoading = document.getElementById('cam-loading');

const canvas = document.getElementById('editor-canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const canvasPlaceholder = document.getElementById('canvas-placeholder');

const saveImageBtn = document.getElementById('save-image-btn');
const statusMsg = document.getElementById('status-msg');
const gallery = document.getElementById('gallery');

// Tools
const addTextBtn = document.getElementById('add-text-btn');
const addLogoBtn = document.getElementById('add-logo-btn');
const cropBtn = document.getElementById('crop-btn');
const resetCanvasBtn = document.getElementById('reset-canvas-btn');
const textToolOptions = document.getElementById('text-tool-options');
const cancelTextBtn = document.getElementById('cancel-text-btn');

// Cropping Elements
const cropActions = document.getElementById('crop-actions');
const applyCropBtn = document.getElementById('apply-crop-btn');
const cancelCropBtn = document.getElementById('cancel-crop-btn');

// State
let originalImage = null; // HTMLImageElement
let currentImage = null; // HTMLImageElement (modified)
let stream = null;
let cropper = null;
let isTextMode = false;

// Setup Drag & Drop
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-brand', 'bg-red-50');
});
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-brand', 'bg-red-50');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-brand', 'bg-red-50');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
    }
});

// Setup Paste
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf('image') === 0) {
            handleFile(item.getAsFile());
            break;
        }
    }
});

// File Handling
function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => loadToCanvas(e.target.result);
    reader.readAsDataURL(file);
}

// Load Image to Canvas
function loadToCanvas(dataUrl) {
    const img = new Image();
    img.onload = () => {
        originalImage = img;
        currentImage = img;
        drawToCanvas(img);
        canvas.classList.remove('hidden');
        canvasPlaceholder.classList.add('hidden');
    };
    img.src = dataUrl;
}

// Draw Image Element to Canvas
function drawToCanvas(imgElement) {
    const maxWidth = canvasContainer.clientWidth - 40;
    const maxHeight = canvasContainer.clientHeight - 40;
    
    let w = imgElement.width;
    let h = imgElement.height;

    // Optional: scale down if extremely large to prevent browser crash
    if (w > 2000 || h > 2000) {
        const ratio = Math.min(2000/w, 2000/h);
        w *= ratio;
        h *= ratio;
    }

    canvas.width = w;
    canvas.height = h;

    // CSS scaling to fit container visually
    const cssRatio = Math.min(maxWidth/w, maxHeight/h);
    canvas.style.width = (w * cssRatio) + 'px';
    canvas.style.height = (h * cssRatio) + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
}

// Reset
resetCanvasBtn.addEventListener('click', () => {
    if (originalImage) {
        currentImage = originalImage;
        drawToCanvas(originalImage);
    }
});

// Camera Logic
startCamBtn.addEventListener('click', async () => {
    camModal.classList.remove('hidden');
    camModal.classList.add('flex');
    camLoading.classList.remove('hidden');
    video.classList.add('hidden');
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            camLoading.classList.add('hidden');
            video.classList.remove('hidden');
        };
    } catch (err) {
        console.error(err);
        alert('Could not access camera. Please allow permissions.');
        closeCamera();
    }
});

function closeCamera() {
    camModal.classList.add('hidden');
    camModal.classList.remove('flex');
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

closeCamBtn.addEventListener('click', closeCamera);
captureBtn.addEventListener('click', () => {
    if (!video.videoWidth) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(video, 0, 0);
    loadToCanvas(tempCanvas.toDataURL('image/jpeg', 0.9));
    closeCamera();
});

// Add Text Tool
addTextBtn.addEventListener('click', () => {
    if (!currentImage) return alert('Load an image first!');
    if (cropper) return alert('Please finish cropping first!');
    
    isTextMode = true;
    textToolOptions.classList.remove('hidden');
    canvas.style.cursor = 'crosshair';
});

cancelTextBtn.addEventListener('click', () => {
    isTextMode = false;
    textToolOptions.classList.add('hidden');
    canvas.style.cursor = 'default';
});

// Canvas click to place text
canvas.addEventListener('click', (e) => {
    if (!isTextMode || !currentImage || cropper) return;
    
    const text = document.getElementById('overlay-text').value.trim();
    if (!text) return;
    const color = document.getElementById('overlay-color').value;
    const size = document.getElementById('overlay-size').value;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.font = `bold ${size} Inter, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Add some shadow for visibility
    ctx.shadowColor="black";
    ctx.shadowBlur=7;
    ctx.lineWidth = 5;
    
    // Draw text outline then fill
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);

    // Save state
    saveCurrentCanvasState();
});

// Add Logo Tool
addLogoBtn.addEventListener('click', () => {
    if (!currentImage) return alert('Load an image first!');
    
    // Create a generic logo for now. In real app, load from ../assets/logo.png
    ctx.font = "bold 40px 'Inter', sans-serif";
    const text = "Royal Pallette";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    
    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    
    ctx.fillText(text, canvas.width - 20, canvas.height - 20);
    
    // Also draw a small crown icon next to it
    ctx.font = "30px Arial";
    ctx.fillText("👑", canvas.width - ctx.measureText(text).width - 30, canvas.height - 23);

    saveCurrentCanvasState();
});

function saveCurrentCanvasState() {
    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => { currentImage = img; };
    img.src = dataUrl;
}

// Crop Tool - Cropper.js implementation
cropBtn.addEventListener('click', () => {
    if (!currentImage) return alert('Load an image first!');
    if (cropper) return; // Already cropping

    cropActions.classList.remove('hidden');
    cropActions.classList.add('flex');
    
    cropper = new Cropper(canvas, {
        viewMode: 1,
        dragMode: 'crop',
        autoCropArea: 0.8,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
    });
});

cancelCropBtn.addEventListener('click', () => {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    cropActions.classList.add('hidden');
    cropActions.classList.remove('flex');
});

applyCropBtn.addEventListener('click', () => {
    if (!cropper) return;
    
    const croppedCanvas = cropper.getCroppedCanvas();
    if (croppedCanvas) {
        const dataUrl = croppedCanvas.toDataURL('image/png');
        cropper.destroy();
        cropper = null;
        
        cropActions.classList.add('hidden');
        cropActions.classList.remove('flex');
        
        loadToCanvas(dataUrl);
    }
});

// ===== STAMP PRODUCT CODE ON CANVAS =====
function stampProductCode(code) {
    if (!code) return;

    const padding = 10;
    const labelText = `#${code}`;

    // Determine font size relative to canvas
    const fontSize = Math.max(20, Math.min(48, canvas.width * 0.045));
    ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;

    const textWidth = ctx.measureText(labelText).width;
    const boxW = textWidth + padding * 2.5;
    const boxH = fontSize + padding * 1.5;
    const boxX = padding;
    const boxY = canvas.height - boxH - padding;

    // Background pill
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#1a1a1a';
    const r = boxH / 2;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
    ctx.lineTo(boxX + boxW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();

    // Left accent strip
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + r + fontSize * 0.8, boxY);
    ctx.lineTo(boxX + r + fontSize * 0.8, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Text
    ctx.save();
    ctx.font = `bold ${fontSize}px 'Inter', Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(labelText, boxX + padding * 1.2 + fontSize * 0.8 + 2, boxY + boxH / 2);
    ctx.restore();

    // Save stamped state as current image
    saveCurrentCanvasState();
}

// Save logic
saveImageBtn.addEventListener('click', async () => {
    const code = imgCodeInput.value.trim();
    const desc = imgDescInput.value.trim();

    if (!code) {
        showMessage('Item Code is required!', 'error');
        return;
    }
    if (!currentImage) {
        showMessage('Please load an image first!', 'error');
        return;
    }

    saveImageBtn.disabled = true;
    saveImageBtn.innerHTML = '⏳ Processing...';

    try {
        // Stamp the product code onto the image before saving
        stampProductCode(code);

        // Small delay to let canvas state update
        await new Promise(r => setTimeout(r, 80));

        // Compress the final canvas image
        const finalBase64 = canvas.toDataURL('image/jpeg', 0.88);

        // Save to Firebase
        await set(ref(db, `product_images/${code}`), {
            imageBase64: finalBase64,
            code: code,
            description: desc,
            savedAt: new Date().toISOString()
        });

        showMessage('✅ Image saved successfully!', 'success');
        
        // Reset
        imgCodeInput.value = '';
        imgDescInput.value = '';
        canvas.classList.add('hidden');
        canvasPlaceholder.classList.remove('hidden');
        originalImage = null;
        currentImage = null;

    } catch (err) {
        console.error(err);
        showMessage('❌ Error saving image.', 'error');
    } finally {
        saveImageBtn.disabled = false;
        saveImageBtn.innerHTML = '<span>💾</span> Save to Database';
    }
});

function showMessage(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = `text-sm font-medium ${type === 'error' ? 'text-red-500' : 'text-green-500'}`;
    setTimeout(() => { statusMsg.textContent = ''; }, 4000);
}

// Render Gallery
function renderGallery(data) {
    gallery.innerHTML = '';
    if (!data) {
        gallery.innerHTML = '<div class="col-span-full text-center py-10 text-gray-400">No images saved yet.</div>';
        return;
    }
    
    Object.entries(data).reverse().forEach(([code, item]) => {
        const div = document.createElement('div');
        div.className = 'bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition group relative';
        div.innerHTML = `
            <div class="relative h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
                <img src="${item.imageBase64}" class="w-full h-full object-cover">
                <!-- Product Code Badge overlay on image -->
                <div class="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5"
                     style="background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%);">
                    <span style="background:#fb7185; color:#fff; font-size:9px; font-weight:800;
                                 padding:2px 6px; border-radius:4px; letter-spacing:0.5px; text-transform:uppercase;"
                          >#${code}</span>
                </div>
            </div>
            <div class="p-2">
                <div class="flex items-center gap-1 mb-0.5">
                    <span class="text-xs font-extrabold text-gray-800">${code}</span>
                </div>
                <p class="text-[10px] text-gray-500 truncate">${item.description || 'No description'}</p>
            </div>
            <button class="delete-btn absolute top-1 right-1 bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition hover:bg-red-50 z-10">
                &times;
            </button>
        `;
        
        div.querySelector('.delete-btn').onclick = async () => {
            if(confirm(`Delete image for code ${code}?`)) {
                try {
                    await remove(ref(db, `product_images/${code}`));
                } catch(e) {
                    alert('Error deleting image');
                }
            }
        };
        
        gallery.appendChild(div);
    });
}

onValue(ref(db, 'product_images'), (snapshot) => {
    renderGallery(snapshot.exists() ? snapshot.val() : null);
});
