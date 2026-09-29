/*
========================================================
SHRIKAR BOOK OCR EXTRACTOR
BOOK EXPORTER — VERSION 1.7
========================================================

Exports:

1. Clean Text PDF
2. Machine-readable Book Data JSON

IMPORTANT DESIGN RULE:

Source PDF Page N must always correspond to
Exported PDF Page N.

Therefore even pages marked "No Story Text"
still receive their own output PDF page.
========================================================
*/


/*
--------------------------------------------------------
SAFE FILE NAME
--------------------------------------------------------
*/

function createBaseFileName(fileName) {

    const withoutExtension =
        fileName.replace(
            /\.pdf$/i,
            ""
        );


    return withoutExtension
        .replace(
            /[^a-zA-Z0-9_\- ]/g,
            ""
        )
        .trim()
        .replace(
            /\s+/g,
            "_"
        );
}


/*
--------------------------------------------------------
DOWNLOAD GENERIC FILE
--------------------------------------------------------
*/

function downloadBlob(
    blob,
    fileName
) {

    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        fileName;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );
}


/*
========================================================
EXPORT BOOK DATA JSON
========================================================
*/

export function exportBookData(
    bookState
) {

    if (
        !bookState ||
        !Array.isArray(bookState.pages) ||
        !bookState.pages.length
    ) {

        throw new Error(
            "There is no reviewed book to export."
        );

    }


    const reviewed =
        bookState.pages.every(
            page =>
                page.approved ||
                page.noStoryText
        );


    if (!reviewed) {

        throw new Error(
            "Every page must be reviewed before export."
        );

    }


    const exportData = {

        format:
            "ShrikarBookOCR",

        formatVersion:
            "1.0",

        application:
            "Shrikar Book OCR Extractor",

        exportedAt:
            new Date().toISOString(),

        sourceFileName:
            bookState.fileName,

        sourcePageCount:
            bookState.pages.length,

        pages:
            bookState.pages.map(
                page => ({

                    sourcePageNumber:
                        page.pageNumber,

                    text:
                        page.noStoryText
                            ? ""
                            : page.text.trim(),

                    noStoryText:
                        Boolean(
                            page.noStoryText
                        ),

                    approved:
                        Boolean(
                            page.approved
                        ),

                    rotation:
                        page.rotation || 0,

                    extractionMethod:
                        page.extractionMethod || ""

                })
            )

    };


    const json =
        JSON.stringify(
            exportData,
            null,
            2
        );


    const blob =
        new Blob(
            [json],
            {
                type:
                    "application/json"
            }
        );


    const baseName =
        createBaseFileName(
            bookState.fileName
        );


    downloadBlob(

        blob,

        `${baseName}_CleanBookData.json`

    );


    return exportData;
}


/*
========================================================
EXPORT CLEAN TEXT PDF
========================================================
*/

export function exportCleanTextPDF(
    bookState
) {

    if (
        !bookState ||
        !Array.isArray(bookState.pages) ||
        !bookState.pages.length
    ) {

        throw new Error(
            "There is no reviewed book to export."
        );

    }


    const reviewed =
        bookState.pages.every(
            page =>
                page.approved ||
                page.noStoryText
        );


    if (!reviewed) {

        throw new Error(
            "Every page must be reviewed before export."
        );

    }


    /*
    jsPDF was loaded globally in index.html.
    */

    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        throw new Error(
            "The PDF export library did not load."
        );

    }


    const {
        jsPDF
    } = window.jspdf;


    /*
    Letter size is convenient for printing
    in the United States.

    This PDF is intentionally a clean-text
    document rather than a visual reproduction
    of the original book.
    */

    const pdf =
        new jsPDF({

            orientation:
                "portrait",

            unit:
                "pt",

            format:
                "letter"

        });


    const pageWidth =
        pdf.internal.pageSize.getWidth();


    const pageHeight =
        pdf.internal.pageSize.getHeight();


    const leftMargin =
        58;


    const rightMargin =
        58;


    const topMargin =
        62;


    const bottomMargin =
        55;


    const usableWidth =
        pageWidth -
        leftMargin -
        rightMargin;


    const totalSourcePages =
        bookState.pages.length;


    /*
    ----------------------------------------------------
    CRITICAL:

    We create exactly ONE output page for every
    ONE source PDF page.

    We do NOT allow story text to automatically
    spill onto an additional PDF page because that
    would destroy page-to-page correspondence.
    ----------------------------------------------------
    */


    bookState.pages.forEach(
        (
            page,
            index
        ) => {

            if (index > 0) {

                pdf.addPage();

            }


            /*
            HEADER
            */

            pdf.setFont(
                "helvetica",
                "bold"
            );


            pdf.setFontSize(
                11
            );


            pdf.text(

                `Source PDF Page ${page.pageNumber} of ${totalSourcePages}`,

                leftMargin,

                38

            );


            pdf.setDrawColor(
                190
            );


            pdf.line(

                leftMargin,

                47,

                pageWidth -
                    rightMargin,

                47

            );


            /*
            PAGE TITLE
            */

            pdf.setFont(
                "helvetica",
                "bold"
            );


            pdf.setFontSize(
                15
            );


            pdf.text(

                "Extracted Story Text",

                leftMargin,

                topMargin

            );


            /*
            NO STORY TEXT PAGE
            */

            if (page.noStoryText) {

                pdf.setFont(
                    "helvetica",
                    "italic"
                );


                pdf.setFontSize(
                    12
                );


                pdf.text(

                    "No story text on this source page.",

                    leftMargin,

                    topMargin + 35

                );


                addFooter(
                    pdf,
                    page,
                    pageHeight,
                    leftMargin,
                    rightMargin
                );


                return;
            }


            /*
            STORY TEXT
            */

            const storyText =
                (page.text || "")
                    .trim();


            if (!storyText) {

                pdf.setFont(
                    "helvetica",
                    "italic"
                );


                pdf.setFontSize(
                    12
                );


                pdf.text(

                    "No extracted text.",

                    leftMargin,

                    topMargin + 35

                );


                addFooter(
                    pdf,
                    page,
                    pageHeight,
                    leftMargin,
                    rightMargin
                );


                return;
            }


            /*
            Use a readable serif font.
            */

            pdf.setFont(
                "times",
                "normal"
            );


            /*
            Start at a comfortable size.
            If the text does not fit on ONE page,
            progressively reduce the font.

            We preserve the one-source-page /
            one-output-page rule.
            */

            let fontSize =
                15;


            let lineHeight =
                21;


            let wrappedLines =
                [];


            const maximumTextHeight =
                pageHeight -
                topMargin -
                bottomMargin -
                45;


            while (
                fontSize >= 9
            ) {

                pdf.setFontSize(
                    fontSize
                );


                lineHeight =
                    fontSize * 1.42;


                wrappedLines =
                    pdf.splitTextToSize(
                        storyText,
                        usableWidth
                    );


                const requiredHeight =
                    wrappedLines.length *
                    lineHeight;


                if (
                    requiredHeight <=
                    maximumTextHeight
                ) {

                    break;

                }


                fontSize -=
                    1;

            }


            /*
            Extreme fallback.

            Children's-book pages should almost
            never reach this point, but we protect
            page mapping regardless.
            */

            if (fontSize < 9) {

                fontSize =
                    9;


                lineHeight =
                    12;


                pdf.setFontSize(
                    fontSize
                );


                wrappedLines =
                    pdf.splitTextToSize(
                        storyText,
                        usableWidth
                    );

            }


            const maximumLines =
                Math.floor(
                    maximumTextHeight /
                    lineHeight
                );


            let linesToPrint =
                wrappedLines;


            let textWasTruncated =
                false;


            if (
                wrappedLines.length >
                maximumLines
            ) {

                linesToPrint =
                    wrappedLines.slice(
                        0,
                        Math.max(
                            1,
                            maximumLines - 2
                        )
                    );


                linesToPrint.push(
                    ""
                );


                linesToPrint.push(
                    "[Text exceeds single-page export capacity. See Book Data JSON for complete text.]"
                );


                textWasTruncated =
                    true;

            }


            pdf.text(

                linesToPrint,

                leftMargin,

                topMargin + 31,

                {
                    lineHeightFactor:
                        1.42
                }

            );


            addFooter(
                pdf,
                page,
                pageHeight,
                leftMargin,
                rightMargin,
                textWasTruncated
            );

        }
    );


    const baseName =
        createBaseFileName(
            bookState.fileName
        );


    pdf.save(
        `${baseName}_CleanText.pdf`
    );


    return {
        pageCount:
            totalSourcePages
    };
}


/*
========================================================
PDF FOOTER
========================================================
*/

function addFooter(
    pdf,
    page,
    pageHeight,
    leftMargin,
    rightMargin,
    textWasTruncated = false
) {

    const pageWidth =
        pdf.internal.pageSize.getWidth();


    pdf.setDrawColor(
        210
    );


    pdf.line(

        leftMargin,

        pageHeight - 38,

        pageWidth -
            rightMargin,

        pageHeight - 38

    );


    pdf.setFont(
        "helvetica",
        "normal"
    );


    pdf.setFontSize(
        8
    );


    pdf.setTextColor(
        100
    );


    let footer =
        `Source PDF Page ${page.pageNumber}`;


    if (
        page.rotation &&
        page.rotation !== 0
    ) {

        footer +=
            ` | Source corrected ${page.rotation}°`;

    }


    if (textWasTruncated) {

        footer +=
            " | Full text preserved in Book Data JSON";

    }


    pdf.text(

        footer,

        leftMargin,

        pageHeight - 22

    );


    /*
    Restore normal text color.
    */

    pdf.setTextColor(
        0
    );
}