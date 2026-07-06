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
const applyTextBtn = document.getElementById('apply-text-btn');
const cancelTextBtn = document.getElementById('cancel-text-btn');

// Cropping Elements
const cropOverlay = document.getElementById('crop-overlay');
const cropBox = document.getElementById('crop-box');
const applyCropBtn = document.getElementById('apply-crop-btn');
const cancelCropBtn = document.getElementById('cancel-crop-btn');

// State
let originalImage = null; // HTMLImageElement
let currentImage = null; // HTMLImageElement (modified)
let stream = null;
let isCropping = false;
let startX, startY, endX, endY;

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
    textToolOptions.classList.remove('hidden');
});
cancelTextBtn.addEventListener('click', () => {
    textToolOptions.classList.add('hidden');
});

applyTextBtn.addEventListener('click', () => {
    if (!currentImage) return alert('Load an image first!');
    const text = document.getElementById('overlay-text').value.trim();
    if (!text) return;
    const color = document.getElementById('overlay-color').value;
    const size = document.getElementById('overlay-size').value;

    ctx.font = `bold ${size} Inter, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    
    // Add some shadow for visibility
    ctx.shadowColor="black";
    ctx.shadowBlur=7;
    ctx.lineWidth = 5;
    
    const x = canvas.width / 2;
    const y = canvas.height - 20;

    // Draw text outline then fill
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);

    // Save state
    saveCurrentCanvasState();
    textToolOptions.classList.add('hidden');
    document.getElementById('overlay-text').value = '';
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

// Crop Tool - Basic implementation
cropBtn.addEventListener('click', () => {
    if (!currentImage) return alert('Load an image first!');
    isCropping = true;
    cropOverlay.classList.remove('hidden');
    cropOverlay.classList.add('flex');
    
    // Reset crop box
    cropBox.style.left = '10%';
    cropBox.style.top = '10%';
    cropBox.style.width = '80%';
    cropBox.style.height = '80%';
});

cancelCropBtn.addEventListener('click', () => {
    isCropping = false;
    cropOverlay.classList.add('hidden');
    cropOverlay.classList.remove('flex');
});

applyCropBtn.addEventListener('click', () => {
    if (!isCropping) return;
    
    // Calculate actual canvas coordinates from css coordinates
    const rect = canvas.getBoundingClientRect();
    const boxRect = cropBox.getBoundingClientRect();
    
    // Scale factor
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const cropX = (boxRect.left - rect.left) * scaleX;
    const cropY = (boxRect.top - rect.top) * scaleY;
    const cropW = boxRect.width * scaleX;
    const cropH = boxRect.height * scaleY;

    // Create temp canvas to extract cropped area
    const tCanvas = document.createElement('canvas');
    tCanvas.width = cropW;
    tCanvas.height = cropH;
    const tCtx = tCanvas.getContext('2d');
    
    tCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    
    loadToCanvas(tCanvas.toDataURL('image/png'));
    
    isCropping = false;
    cropOverlay.classList.add('hidden');
    cropOverlay.classList.remove('flex');
});

// Draggable Crop Box logic
let isDraggingBox = false;
let dragStartX, dragStartY;
let boxStartLeft, boxStartTop;

cropBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('handle')) return; // Ignore handles
    isDraggingBox = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    boxStartLeft = parseFloat(cropBox.style.left) || 0;
    boxStartTop = parseFloat(cropBox.style.top) || 0;
});

document.addEventListener('mousemove', (e) => {
    if (!isDraggingBox) return;
    const containerRect = canvasContainer.getBoundingClientRect();
    
    // Calculate percentage change
    const dx = ((e.clientX - dragStartX) / containerRect.width) * 100;
    const dy = ((e.clientY - dragStartY) / containerRect.height) * 100;
    
    cropBox.style.left = `${Math.min(Math.max(0, boxStartLeft + dx), 100 - parseFloat(cropBox.style.width))}%`;
    cropBox.style.top = `${Math.min(Math.max(0, boxStartTop + dy), 100 - parseFloat(cropBox.style.height))}%`;
});

document.addEventListener('mouseup', () => {
    isDraggingBox = false;
});

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
    saveImageBtn.innerHTML = 'Processing...';

    try {
        // Compress the final canvas image
        const finalBase64 = canvas.toDataURL('image/jpeg', 0.85);

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
        div.className = 'bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition group relative';
        div.innerHTML = `
            <div class="h-24 bg-gray-100 flex items-center justify-center overflow-hidden">
                <img src="${item.imageBase64}" class="w-full h-full object-cover">
            </div>
            <div class="p-2">
                <p class="text-xs font-bold text-gray-800">Code: ${code}</p>
                <p class="text-[10px] text-gray-500 truncate">${item.description || 'No description'}</p>
            </div>
            <button class="delete-btn absolute top-1 right-1 bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition hover:bg-red-50">
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
