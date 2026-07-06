# AI Photo Studio - Free GitHub Pages Project

Ye static website/PWA starter project hai jo GitHub Pages par free host ho sakta hai.

## Features

- Text prompt se AI photo generate
- Generator me frame/ratio: 1:1, 9:16, 16:9, 4:5, custom size
- Uploaded photo browser me edit: brightness, contrast, saturation, blur, resize, rotate, flip
- Uploaded photo frame/ratio: Original, 1:1, 9:16, 16:9, 4:5, custom
- Photo fit: crop/cover, full photo/padding, stretch
- Target KB export option, example: 190 KB, 200 KB
- Custom download file name
- JPG/PNG/WEBP export
- Drag & drop upload
- Mobile friendly UI
- Installable PWA basic support
- Optional real AI uploaded-image edit endpoint slot

## Important limitation

GitHub Pages static hosting hai. Isme secret API key safe tarike se hide nahi hoti. Isliye:

- Local uploaded photo editor bina server ke free chalega.
- Text-to-image public image endpoint se try karta hai.
- Real uploaded photo AI edit ke liye backend/proxy use karo.
- Private keys ko `app.js`, HTML, CSS, public GitHub repo, ya browser code me mat daalo.

## GitHub Pages deploy steps

1. GitHub par new repository banao, example: `ai-photo-studio`.
2. Is folder ke saare files upload karo.
3. Repository me **Settings → Pages** open karo.
4. Source: **Deploy from a branch** select karo.
5. Branch: `main`, folder: `/root`, Save.
6. Kuch time baad link milega: `https://your-username.github.io/ai-photo-studio/`.

## Ratio aur KB use kaise karein

1. Photo upload karo.
2. Frame/Ratio select karo: `1:1`, `9:16`, `16:9`, `4:5`, ya `Custom`.
3. Photo Fit choose karo:
   - `Crop / Cover`: frame full bharega, side crop ho sakti hai.
   - `Full Photo / Padding`: full photo dikhegi, background padding aa sakti hai.
   - `Stretch`: photo ko frame me force fit karega.
4. Target KB me number likho, example `190`.
5. Format me `JPG` ya `WEBP` choose karo.
6. File name likho aur Download karo.

Note: Exact KB image detail aur dimensions par depend karta hai. App target ke aas-paas compress/resize karta hai. PNG me exact KB control reliable nahi hota.

## Prompt examples

```text
premium realistic birthday cake photo, white background, studio lighting, sharp focus, no text
```

```text
modern app icon for photo editor, red black white theme, minimal, centered, no text
```

```text
cute cartoon delivery boy on bike, clean background, high quality, no watermark
```

## Real AI photo edit ka safe method

Agar uploaded image ko AI se genuinely change karwana hai, backend zaroori hai. Frontend me endpoint URL add karke image + prompt POST hota hai. Backend API key ko environment variable me rakhega aur edited image blob return karega.

Example expected endpoint:

```http
POST https://your-worker.workers.dev/edit-image
Content-Type: multipart/form-data
fields: image, prompt
```

Response should be image file blob.
