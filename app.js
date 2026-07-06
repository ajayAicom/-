const $ = (id) => document.getElementById(id);

const state = {
  sourceImage: null,
  sourceName: '',
  rotation: 0,
  flipped: false,
  generatedUrl: '',
};

const ratioPresets = {
  '1:1': { width: 1024, height: 1024 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

const genRatioPresets = {
  '1:1': { width: 1024, height: 1024 },
  '9:16': { width: 768, height: 1365 },
  '16:9': { width: 1365, height: 768 },
  '4:5': { width: 1024, height: 1280 },
};

function sanitizeFileName(name, fallback = 'photo') {
  const safe = String(name || fallback)
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  return safe || fallback;
}

function extFromMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function setStatus(text, ok = true) {
  const el = $('apiStatus');
  el.textContent = text;
  el.style.background = ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  el.style.color = ok ? '#bbf7d0' : '#fecaca';
}

function updateSliderLabels() {
  $('brightnessVal').textContent = `${$('brightness').value}%`;
  $('contrastVal').textContent = `${$('contrast').value}%`;
  $('saturationVal').textContent = `${$('saturation').value}%`;
  $('blurVal').textContent = `${$('blur').value}px`;
}

function applyRatioPreset() {
  const value = $('ratioSelect').value;
  if (value === 'original' && state.sourceImage) {
    $('outWidth').value = state.sourceImage.naturalWidth;
    $('outHeight').value = state.sourceImage.naturalHeight;
  } else if (ratioPresets[value]) {
    $('outWidth').value = ratioPresets[value].width;
    $('outHeight').value = ratioPresets[value].height;
  }
  drawEditor();
}

function applyGenRatioPreset() {
  const value = $('genRatioSelect').value;
  if (genRatioPresets[value]) {
    $('genWidth').value = genRatioPresets[value].width;
    $('genHeight').value = genRatioPresets[value].height;
  }
}

function drawEditor() {
  if (!state.sourceImage) return;

  const canvas = $('editorCanvas');
  const ctx = canvas.getContext('2d');
  const width = Math.max(100, Math.min(5000, Number($('outWidth').value) || state.sourceImage.naturalWidth));
  const height = Math.max(100, Math.min(5000, Number($('outHeight').value) || state.sourceImage.naturalHeight));
  const fit = $('fitMode').value;

  canvas.width = width;
  canvas.height = height;

  ctx.save();
  ctx.fillStyle = $('bgColor').value || '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const sourceW = state.sourceImage.naturalWidth;
  const sourceH = state.sourceImage.naturalHeight;
  const rotated = state.rotation % 180 !== 0;
  const baseW = rotated ? sourceH : sourceW;
  const baseH = rotated ? sourceW : sourceH;

  let drawW = width;
  let drawH = height;
  if (fit === 'cover') {
    const scale = Math.max(width / baseW, height / baseH);
    drawW = baseW * scale;
    drawH = baseH * scale;
  } else if (fit === 'contain') {
    const scale = Math.min(width / baseW, height / baseH);
    drawW = baseW * scale;
    drawH = baseH * scale;
  }

  ctx.filter = `brightness(${$('brightness').value}%) contrast(${$('contrast').value}%) saturate(${$('saturation').value}%) blur(${$('blur').value}px)`;
  ctx.translate(width / 2, height / 2);
  if (state.flipped) ctx.scale(-1, 1);
  ctx.rotate((state.rotation * Math.PI) / 180);

  if (fit === 'stretch') {
    const rotatedW = rotated ? height : width;
    const rotatedH = rotated ? width : height;
    ctx.drawImage(state.sourceImage, -rotatedW / 2, -rotatedH / 2, rotatedW, rotatedH);
  } else {
    const renderW = rotated ? drawH : drawW;
    const renderH = rotated ? drawW : drawH;
    ctx.drawImage(state.sourceImage, -renderW / 2, -renderH / 2, renderW, renderH);
  }
  ctx.restore();

  $('editEmpty').style.display = 'none';
  $('downloadEditBtn').disabled = false;
  $('aiEditBtn').disabled = false;
  $('editMeta').textContent = `${width}×${height} px`;
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

async function exportBlobWithTargetKB() {
  const canvas = $('editorCanvas');
  let mime = $('formatSelect').value;
  const targetKB = Number($('targetKB').value);
  const baseQuality = Number($('qualitySelect').value) || 0.82;

  if (!targetKB || targetKB <= 0 || mime === 'image/png') {
    const blob = await canvasToBlob(canvas, mime, baseQuality);
    return { blob, mime, note: mime === 'image/png' && targetKB ? 'PNG me exact target KB apply nahi hua.' : '' };
  }

  let low = 0.1;
  let high = 0.98;
  let best = null;
  const targetBytes = targetKB * 1024;

  for (let i = 0; i < 10; i += 1) {
    const q = (low + high) / 2;
    const blob = await canvasToBlob(canvas, mime, q);
    if (!blob) break;
    best = blob;
    if (blob.size > targetBytes) high = q;
    else low = q;
  }

  if (!best) best = await canvasToBlob(canvas, mime, baseQuality);

  // If the canvas is still too large at very low quality, resize down gradually.
  if (best && best.size > targetBytes * 1.08) {
    let tempCanvas = canvas;
    for (let i = 0; i < 8 && best.size > targetBytes * 1.08; i += 1) {
      const scaled = document.createElement('canvas');
      scaled.width = Math.max(100, Math.round(tempCanvas.width * 0.92));
      scaled.height = Math.max(100, Math.round(tempCanvas.height * 0.92));
      scaled.getContext('2d').drawImage(tempCanvas, 0, 0, scaled.width, scaled.height);
      tempCanvas = scaled;
      best = await canvasToBlob(tempCanvas, mime, 0.72);
    }
  }

  return { blob: best, mime, note: '' };
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

function loadImageFromFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.sourceImage = img;
      state.sourceName = file.name;
      state.rotation = 0;
      state.flipped = false;
      $('editFileName').value = sanitizeFileName(file.name, 'edited-photo');
      if ($('ratioSelect').value === 'original') {
        $('outWidth').value = img.naturalWidth;
        $('outHeight').value = img.naturalHeight;
      } else {
        applyRatioPreset();
      }
      drawEditor();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function buildPollinationsUrl(prompt, width, height) {
  const fullPrompt = `${prompt}, high quality, no watermark`;
  const encoded = encodeURIComponent(fullPrompt);
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;
}

async function generateImage() {
  const prompt = $('promptInput').value.trim();
  if (!prompt) {
    setStatus('Prompt likho', false);
    return;
  }

  const style = $('styleSelect').value;
  const width = Math.max(256, Math.min(2048, Number($('genWidth').value) || 1024));
  const height = Math.max(256, Math.min(2048, Number($('genHeight').value) || 1024));
  const url = buildPollinationsUrl(`${prompt}, ${style}`, width, height);

  setStatus('Generating...');
  $('generateBtn').disabled = true;
  $('downloadGenBtn').disabled = true;
  $('generatedImage').hidden = true;
  $('genEmpty').style.display = 'grid';
  $('genEmpty').textContent = 'Photo generate ho rahi hai...';

  const img = $('generatedImage');
  img.onload = () => {
    state.generatedUrl = url;
    img.hidden = false;
    $('genEmpty').style.display = 'none';
    $('downloadGenBtn').disabled = false;
    $('genMeta').textContent = `${width}×${height} px`;
    setStatus('Generated');
    $('generateBtn').disabled = false;
  };
  img.onerror = () => {
    $('genEmpty').style.display = 'grid';
    $('genEmpty').textContent = 'Generation fail hui. Prompt ya internet check karo.';
    setStatus('Generation failed', false);
    $('generateBtn').disabled = false;
  };
  img.src = url;
}

async function downloadGenerated() {
  if (!state.generatedUrl) return;
  const safeName = sanitizeFileName($('genFileName').value, 'ai-photo');
  try {
    const response = await fetch(state.generatedUrl);
    const blob = await response.blob();
    downloadBlob(blob, `${safeName}.jpg`);
  } catch (err) {
    const link = document.createElement('a');
    link.href = state.generatedUrl;
    link.download = `${safeName}.jpg`;
    link.target = '_blank';
    link.click();
  }
}

async function downloadEdited() {
  if (!state.sourceImage) return;
  drawEditor();
  const { blob, mime, note } = await exportBlobWithTargetKB();
  if (!blob) return;
  const sizeKB = Math.round(blob.size / 1024);
  const filename = `${sanitizeFileName($('editFileName').value, 'edited-photo')}.${extFromMime(mime)}`;
  downloadBlob(blob, filename);
  const target = Number($('targetKB').value);
  $('downloadInfo').textContent = `${filename} downloaded. Final size approx ${sizeKB} KB.${target ? ` Target: ${target} KB.` : ''} ${note}`;
}

async function sendToAiEndpoint() {
  if (!state.sourceImage) return;
  const endpoint = $('endpointUrl').value.trim();
  const prompt = $('editPrompt').value.trim();
  if (!endpoint || !prompt) {
    $('endpointResult').textContent = 'Endpoint URL aur prompt dono bharna zaroori hai.';
    return;
  }

  drawEditor();
  $('endpointResult').textContent = 'AI endpoint par bhej rahe hain...';
  const currentBlob = await canvasToBlob($('editorCanvas'), 'image/png', 0.95);
  const form = new FormData();
  form.append('image', currentBlob, 'upload.png');
  form.append('prompt', prompt);

  try {
    const response = await fetch(endpoint, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      state.sourceImage = img;
      state.rotation = 0;
      state.flipped = false;
      drawEditor();
      URL.revokeObjectURL(url);
      $('endpointResult').textContent = 'AI edited image preview me load ho gayi.';
    };
    img.src = url;
  } catch (err) {
    $('endpointResult').textContent = `Endpoint error: ${err.message}`;
  }
}

function initEvents() {
  $('genRatioSelect').addEventListener('change', applyGenRatioPreset);
  $('generateBtn').addEventListener('click', generateImage);
  $('downloadGenBtn').addEventListener('click', downloadGenerated);

  $('photoUpload').addEventListener('change', (e) => loadImageFromFile(e.target.files[0]));

  const dropZone = $('dropZone');
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });
  dropZone.addEventListener('drop', (e) => loadImageFromFile(e.dataTransfer.files[0]));

  ['ratioSelect', 'fitMode', 'outWidth', 'outHeight', 'bgColor', 'formatSelect', 'qualitySelect'].forEach((id) => {
    $(id).addEventListener('input', id === 'ratioSelect' ? applyRatioPreset : drawEditor);
    $(id).addEventListener('change', id === 'ratioSelect' ? applyRatioPreset : drawEditor);
  });

  ['brightness', 'contrast', 'saturation', 'blur'].forEach((id) => {
    $(id).addEventListener('input', () => {
      updateSliderLabels();
      drawEditor();
    });
  });

  $('enhanceBtn').addEventListener('click', () => {
    $('brightness').value = 108;
    $('contrast').value = 112;
    $('saturation').value = 110;
    $('blur').value = 0;
    updateSliderLabels();
    drawEditor();
  });

  $('resetBtn').addEventListener('click', () => {
    $('brightness').value = 100;
    $('contrast').value = 100;
    $('saturation').value = 100;
    $('blur').value = 0;
    state.rotation = 0;
    state.flipped = false;
    updateSliderLabels();
    applyRatioPreset();
  });

  $('rotateBtn').addEventListener('click', () => {
    state.rotation = (state.rotation + 90) % 360;
    drawEditor();
  });

  $('flipBtn').addEventListener('click', () => {
    state.flipped = !state.flipped;
    drawEditor();
  });

  $('downloadEditBtn').addEventListener('click', downloadEdited);
  $('aiEditBtn').addEventListener('click', sendToAiEndpoint);
}

function initPwa() {
  let deferredPrompt;
  const btn = $('installBtn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

updateSliderLabels();
applyGenRatioPreset();
initEvents();
initPwa();
