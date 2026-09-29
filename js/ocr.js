import {
    cleanOCRText
} from "./text-cleaner.js";


import {
    detectStoryLines
} from "./text-region-detector.js";


export async function recognizePage(
    canvas,
    pageNumber,
    totalPages,
    statusCallback
) {

    /*
    --------------------------------------------------
    OCR THE PAGE
    --------------------------------------------------
    */

    const result =
        await Tesseract.recognize(

            canvas,

            "eng",

            {

                logger: message => {

                    if (
                        message.status ===
                        "recognizing text"
                    ) {

                        const percent =
                            Math.round(
                                message.progress * 100
                            );


                        statusCallback(

                            `Scanning page ${pageNumber} ` +
                            `of ${totalPages} — ${percent}%`

                        );

                    }

                }

            }

        );


    /*
    --------------------------------------------------
    DETECT PLAUSIBLE STORY TEXT
    --------------------------------------------------

    Instead of immediately using result.data.text,
    inspect Tesseract's layout information.
    */

    const storyLines =
        detectStoryLines(
            result.data
        );


    /*
    --------------------------------------------------
    BUILD TEXT FROM ACCEPTED REGIONS
    --------------------------------------------------
    */

    let regionText =
        storyLines
            .map(line => line.text)
            .join("\n");


    /*
    --------------------------------------------------
    FINAL CONSERVATIVE CLEANUP
    --------------------------------------------------
    */

    regionText =
        cleanOCRText(
            regionText
        );


    return regionText;
}