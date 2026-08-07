'use strict';

const sharp = require('sharp');

const SOURCE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Zhu_Cheng_-_A_Chinese_ink_painting_on_paper_by_Zhu_Cheng_of_a_bird_on_bamboo_with_flowers.jpg/500px-Zhu_Cheng_-_A_Chinese_ink_painting_on_paper_by_Zhu_Cheng_of_a_bird_on_bamboo_with_flowers.jpg';
const MASK_WIDTH = 60;
const PALETTE = [
    '',
    'paper_warm',
    'paper_shadow',
    'ink_light',
    'ink_mid',
    'ink_deep',
    'seal_red'
];

function luminance(red, green, blue) {
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function encodeRle(values) {
    if (!values.length) return '';
    const bytes = [];
    let code = values[0];
    let count = 1;
    function flush() {
        let remaining = count;
        while (remaining > 255) {
            bytes.push(255, code);
            remaining -= 255;
        }
        if (remaining > 0) bytes.push(remaining, code);
    }
    for (let index = 1; index < values.length; index++) {
        if (values[index] === code) {
            count++;
            continue;
        }
        flush();
        code = values[index];
        count = 1;
    }
    flush();
    return Buffer.from(bytes).toString('base64');
}

function smoothMask(values, width, height) {
    let current = values;
    for (let pass = 0; pass < 2; pass++) {
        const next = current.slice();
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const index = y * width + x;
                if (current[index] === 6) continue;
                const counts = new Uint8Array(PALETTE.length);
                for (let offsetY = -1; offsetY <= 1; offsetY++) {
                    for (let offsetX = -1; offsetX <= 1; offsetX++) {
                        counts[current[(y + offsetY) * width + x + offsetX]]++;
                    }
                }
                let dominant = current[index];
                let dominantCount = counts[dominant];
                for (let code = 1; code < counts.length; code++) {
                    if (counts[code] > dominantCount) {
                        dominant = code;
                        dominantCount = counts[code];
                    }
                }
                if (dominantCount >= 6) next[index] = dominant;
            }
        }
        current = next;
    }
    return current;
}

(async () => {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Unable to fetch source image: ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    const resized = sharp(source).resize({ width: MASK_WIDTH, withoutEnlargement: true }).removeAlpha();
    const { data, info } = await resized.clone().raw().toBuffer({ resolveWithObject: true });
    const localBackground = await resized.clone().blur(5.5).raw().toBuffer();
    const values = new Uint8Array(info.width * info.height);

    for (let pixel = 0; pixel < values.length; pixel++) {
        const offset = pixel * info.channels;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const localRed = localBackground[offset];
        const localGreen = localBackground[offset + 1];
        const localBlue = localBackground[offset + 2];
        const light = luminance(red, green, blue);
        const localLight = luminance(localRed, localGreen, localBlue);
        const localDrop = localLight - light;
        const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);

        if (red > green + 28 && red > blue + 34 && saturation > 38 && light < 170) {
            values[pixel] = 6;
        } else if (light < 62 || localDrop > 58) {
            values[pixel] = 5;
        } else if (light < 100 || localDrop > 32) {
            values[pixel] = 4;
        } else if (light < 144 || localDrop > 15) {
            values[pixel] = 3;
        } else if (light < 188 || localDrop > 5) {
            values[pixel] = 2;
        } else {
            values[pixel] = 1;
        }
    }

    const smoothed = smoothMask(values, info.width, info.height);
    const counts = Object.fromEntries(PALETTE.slice(1).map(sampleId => [sampleId, 0]));
    let classified = 0;
    for (const code of smoothed) {
        if (code > 0) {
            classified++;
            counts[PALETTE[code]]++;
        }
    }
    const total = smoothed.length;
    const payload = {
        version: 1,
        type: 'rle-json',
        source: SOURCE_URL,
        width: info.width,
        height: info.height,
        palette: PALETTE,
        encoding: 'pair-base64',
        rle: encodeRle(smoothed),
        coverage: classified / total,
        unclassified: (total - classified) / total,
        counts
    };
    process.stdout.write(JSON.stringify(payload));
})().catch(error => {
    console.error(error);
    process.exit(1);
});
