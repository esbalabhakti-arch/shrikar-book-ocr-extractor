export function cleanOCRText(rawText) {

    if (!rawText) {
        return "";
    }

    const lines = rawText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const accepted = [];

    for (let line of lines) {

        line = line.replace(/\s+/g, " ").trim();

        if (line.length < 2) {
            continue;
        }

        // Remove standalone page numbers.
        if (/^\d{1,3}$/.test(line)) {
            continue;
        }

        const letters =
            (line.match(/[A-Za-z]/g) || []).length;

        const chars =
            line.replace(/\s/g, "").length;

        if (!chars) {
            continue;
        }

        const letterRatio = letters / chars;

        if (letterRatio < 0.65) {
            continue;
        }

        const words =
            line.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];

        const digits =
            (line.match(/[0-9]/g) || []).length;

        if (digits / chars > 0.12) {
            continue;
        }

        const tinyWords =
            words.filter(word => word.length === 1).length;

        if (
            words.length >= 3 &&
            tinyWords / words.length > 0.4
        ) {
            continue;
        }

        accepted.push(line);
    }

    /*
     * IMPORTANT:
     *
     * Version 1.2 deliberately DOES NOT attempt
     * sentence reconstruction here.
     *
     * Preserve OCR lines first.
     *
     * Sentence reconstruction will happen only
     * after the parent reviews/corrects the book.
     */

    return accepted.join("\n");
}
