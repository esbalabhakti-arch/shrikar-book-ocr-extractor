/*
========================================================
SHRIKAR READING
TEXT REGION DETECTOR — VERSION 1.3
========================================================

Purpose:

Tesseract sometimes sees shapes inside children's-book
illustrations and interprets them as letters.

Instead of blindly accepting every OCR line, we examine
Tesseract's detected text lines and use:

- OCR confidence
- number of words
- alphabetic content
- word structure
- location/layout consistency

to identify plausible prose.

IMPORTANT:

We do NOT assume that story text is always at the bottom.
Text can appear anywhere on a children's-book page.
========================================================
*/


function getWords(line) {

    if (!line) {
        return [];
    }

    return line.match(
        /[A-Za-z]+(?:['’\-][A-Za-z]+)*/g
    ) || [];
}


/*
--------------------------------------------------------
Calculate how "English-like" an OCR line appears.
--------------------------------------------------------
*/

function scoreLine(line) {

    if (!line || !line.text) {
        return 0;
    }


    const text =
        line.text
            .replace(/\s+/g, " ")
            .trim();


    if (!text) {
        return 0;
    }


    const words =
        getWords(text);


    const letters =
        (text.match(/[A-Za-z]/g) || [])
            .length;


    const digits =
        (text.match(/[0-9]/g) || [])
            .length;


    const visibleCharacters =
        text
            .replace(/\s/g, "")
            .length;


    if (!visibleCharacters) {
        return 0;
    }


    const letterRatio =
        letters / visibleCharacters;


    /*
    Start with OCR confidence.
    Tesseract confidence is normally 0–100.
    */

    let score =
        typeof line.confidence === "number"
            ? line.confidence
            : 0;


    /*
    Real prose usually contains multiple words.
    */

    if (words.length >= 2) {
        score += 10;
    }

    if (words.length >= 4) {
        score += 10;
    }


    /*
    Alphabet-heavy lines are more plausible.
    */

    if (letterRatio >= 0.75) {
        score += 10;
    }

    if (letterRatio >= 0.9) {
        score += 5;
    }


    /*
    Sentence punctuation is a useful signal.
    */

    if (/[.!?,]["'”’]?$/.test(text)) {
        score += 5;
    }


    /*
    Penalize digit-heavy garbage.
    */

    if (
        digits > 0 &&
        digits / visibleCharacters > 0.08
    ) {
        score -= 25;
    }


    /*
    Artwork OCR frequently creates many
    one-character pseudo-words.
    */

    const oneLetterWords =
        words.filter(
            word => word.length === 1
        ).length;


    if (
        words.length >= 2 &&
        oneLetterWords / words.length > 0.3
    ) {
        score -= 30;
    }


    /*
    Random uppercase fragments are common
    when OCR examines illustrations.
    */

    const uppercaseWords =
        words.filter(
            word =>
                word.length >= 2 &&
                word === word.toUpperCase()
        ).length;


    if (
        words.length >= 2 &&
        uppercaseWords / words.length > 0.6
    ) {
        score -= 20;
    }


    return score;
}


/*
--------------------------------------------------------
Convert OCR result into candidate lines.
--------------------------------------------------------
*/

export function detectStoryLines(ocrData) {

    /*
    Different Tesseract.js versions expose layout data
    slightly differently. Prefer lines when available.
    */

    let lines = [];


    if (
        ocrData &&
        Array.isArray(ocrData.lines)
    ) {

        lines =
            ocrData.lines;

    }


    /*
    If detailed line information is unavailable,
    fall back to raw text.

    This keeps the application functional.
    */

    if (!lines.length) {

        const rawText =
            ocrData?.text || "";


        return rawText
            .split(/\r?\n/)
            .map(text => ({
                text: text.trim(),
                confidence: 0,
                bbox: null,
                score: 0
            }))
            .filter(item => item.text);

    }


    /*
    Score each detected OCR line.
    */

    const candidates =
        lines
            .map(line => {

                const item = {

                    text:
                        (line.text || "")
                            .replace(/\s+/g, " ")
                            .trim(),

                    confidence:
                        typeof line.confidence === "number"
                            ? line.confidence
                            : 0,

                    bbox:
                        line.bbox || null

                };


                item.score =
                    scoreLine(item);


                return item;

            })
            .filter(
                item => item.text.length > 0
            );


    /*
    ----------------------------------------------------
    FIRST PASS

    Keep lines that look reasonably text-like.
    ----------------------------------------------------
    */

    let accepted =
        candidates.filter(
            item => item.score >= 55
        );


    /*
    ----------------------------------------------------
    SECOND PASS

    A legitimate short line such as:

        I need help.

    may have lower confidence.

    If it is spatially close to accepted prose,
    keep it.

    This is particularly important for children's
    books where sentences are often spread over
    several short printed lines.
    ----------------------------------------------------
    */

    if (
        accepted.length &&
        candidates.some(item => item.bbox)
    ) {

        const acceptedBoxes =
            accepted
                .filter(item => item.bbox);


        for (const candidate of candidates) {

            if (
                accepted.includes(candidate) ||
                !candidate.bbox
            ) {
                continue;
            }


            const words =
                getWords(candidate.text);


            if (!words.length) {
                continue;
            }


            /*
            Only rescue moderately plausible lines.
            */

            if (candidate.score < 30) {
                continue;
            }


            const nearby =
                acceptedBoxes.some(
                    good => {

                        const verticalGap =
                            Math.min(

                                Math.abs(
                                    candidate.bbox.y0 -
                                    good.bbox.y1
                                ),

                                Math.abs(
                                    good.bbox.y0 -
                                    candidate.bbox.y1
                                )

                            );


                        const goodHeight =
                            Math.max(
                                1,
                                good.bbox.y1 -
                                good.bbox.y0
                            );


                        /*
                        Allow approximately 2.5 line heights
                        between neighboring prose lines.
                        */

                        return (
                            verticalGap <
                            goodHeight * 2.5
                        );

                    }
                );


            if (nearby) {

                accepted.push(
                    candidate
                );

            }

        }

    }


    /*
    Sort lines into natural reading order.
    */

    accepted.sort(
        (a, b) => {

            if (
                a.bbox &&
                b.bbox
            ) {

                const yDifference =
                    a.bbox.y0 -
                    b.bbox.y0;


                if (
                    Math.abs(yDifference) > 8
                ) {
                    return yDifference;
                }


                return (
                    a.bbox.x0 -
                    b.bbox.x0
                );

            }


            return 0;

        }
    );


    return accepted;
}