export async function openPDF(file) {

    const arrayBuffer =
        await file.arrayBuffer();

    return await pdfjsLib.getDocument({
        data: arrayBuffer
    }).promise;
}


export async function extractEmbeddedText(page) {

    try {

        const content =
            await page.getTextContent();

        return content.items
            .map(item => item.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

    } catch {

        return "";
    }
}


/*
==================================================
RENDER PAGE
==================================================

rotation can be:
0, 90, 180, or 270 degrees.

The rotation is applied to BOTH:
- parent review image
- OCR image

so Shrikar's book is processed in the same
orientation that the parent sees.
==================================================
*/

export async function renderPage(
    page,
    scale = 2.4,
    rotation = 0
) {

    const normalizedRotation =
        ((rotation % 360) + 360) % 360;


    const viewport =
        page.getViewport({
            scale: scale,
            rotation: normalizedRotation
        });


    const canvas =
        document.createElement("canvas");


    canvas.width =
        Math.floor(viewport.width);


    canvas.height =
        Math.floor(viewport.height);


    const context =
        canvas.getContext(
            "2d",
            {
                willReadFrequently: true
            }
        );


    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;


    return canvas;
}