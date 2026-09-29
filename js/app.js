import {
    openPDF,
    extractEmbeddedText,
    renderPage
} from "./pdf-reader.js";

import {
    recognizePage
} from "./ocr.js";

import {
    exportCleanTextPDF,
    exportBookData
} from "./book-exporter.js";


pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


/*
==================================================
DOM ELEMENTS
==================================================
*/

const pdfFile =
    document.getElementById("pdfFile");

const processButton =
    document.getElementById("processButton");

const processingCard =
    document.getElementById("processingCard");

const reviewCard =
    document.getElementById("reviewCard");

const statusText =
    document.getElementById("statusText");

const progressBar =
    document.getElementById("progressBar");

const progressText =
    document.getElementById("progressText");

const pagesContainer =
    document.getElementById("pagesContainer");

const fileInfo =
    document.getElementById("fileInfo");

const errorBox =
    document.getElementById("errorBox");

const approvedCount =
    document.getElementById("approvedCount");

const totalReviewPages =
    document.getElementById("totalReviewPages");

const approveBookButton =
    document.getElementById("approveBookButton");

const bookApprovalMessage =
    document.getElementById("bookApprovalMessage");

const bookReadyBox =
    document.getElementById("bookReadyBox");

const showStoryButton =
    document.getElementById("showStoryButton");

const downloadPDFButton =
    document.getElementById(
        "downloadPDFButton"
    );

const downloadJSONButton =
    document.getElementById(
        "downloadJSONButton"
    );

const exportStatus =
    document.getElementById(
        "exportStatus"
    );

const storyPreview =
    document.getElementById("storyPreview");

const cleanStoryText =
    document.getElementById("cleanStoryText");

/*
==================================================
VERSION 1.6 — REVIEW NAVIGATOR ELEMENTS
==================================================
*/

const previousPageButton =
    document.getElementById(
        "previousPageButton"
    );

const nextPageButton =
    document.getElementById(
        "nextPageButton"
    );

const previousPageButtonBottom =
    document.getElementById(
        "previousPageButtonBottom"
    );

const nextPageButtonBottom =
    document.getElementById(
        "nextPageButtonBottom"
    );

const currentPageNumber =
    document.getElementById(
        "currentPageNumber"
    );

const currentPageNumberBottom =
    document.getElementById(
        "currentPageNumberBottom"
    );

const reviewPageCount =
    document.getElementById(
        "reviewPageCount"
    );

const reviewPageCountBottom =
    document.getElementById(
        "reviewPageCountBottom"
    );

const jumpPageInput =
    document.getElementById(
        "jumpPageInput"
    );

const jumpPageButton =
    document.getElementById(
        "jumpPageButton"
    );

const nextUnreviewedButton =
    document.getElementById(
        "nextUnreviewedButton"
    );

const navigatorStatus =
    document.getElementById(
        "navigatorStatus"
    );


let currentReviewPage =
    1;
/*
==================================================
STATE
==================================================
*/

let bookState = {
    fileName: "",
    pages: []
};


/*
Keep the currently opened PDF in memory.

This lets us re-render/re-OCR an individual
page when the parent rotates it.
*/

let currentPDF = null;


const STORAGE_KEY =
    "shrikarBookReviewV15";

const APPROVED_BOOK_KEY =
    "shrikarApprovedBook";


/*
==================================================
UTILITIES
==================================================
*/

function showError(message) {

    errorBox.textContent =
        message;

    errorBox.classList.remove(
        "hidden"
    );
}


function updateProgress(
    current,
    total,
    message
) {

    const percent =
        Math.round(
            (current / total) * 100
        );


    progressBar.style.width =
        percent + "%";


    progressText.textContent =
        percent + "%";


    statusText.textContent =
        message;
}


function normalizeRotation(rotation) {

    return (
        (rotation % 360) + 360
    ) % 360;
}


function saveReviewState() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(bookState)
    );
}

/*
==================================================
VERSION 1.6 — REVIEW NAVIGATION
==================================================
*/

function showReviewPage(
    pageNumber,
    scrollToTop = true
) {

    const total =
        bookState.pages.length;


    if (!total) {
        return;
    }


    /*
    Prevent invalid page numbers.
    */

    pageNumber =
        Math.max(
            1,
            Math.min(
                pageNumber,
                total
            )
        );


    currentReviewPage =
        pageNumber;


    /*
    Hide every review card except the
    currently selected page.
    */

    document
        .querySelectorAll(
            ".page-review"
        )
        .forEach(
            card => {

                const cardPage =
                    Number(
                        card.dataset.pageCard
                    );


                if (
                    cardPage ===
                    currentReviewPage
                ) {

                    card.classList.remove(
                        "navigator-hidden"
                    );

                } else {

                    card.classList.add(
                        "navigator-hidden"
                    );

                }

            }
        );


    /*
    Update page indicators.
    */

    currentPageNumber.textContent =
        currentReviewPage;


    currentPageNumberBottom.textContent =
        currentReviewPage;


    reviewPageCount.textContent =
        total;


    reviewPageCountBottom.textContent =
        total;


    jumpPageInput.value =
        currentReviewPage;


    jumpPageInput.max =
        total;


    /*
    Previous/Next button state.
    */

    previousPageButton.disabled =
        currentReviewPage === 1;


    previousPageButtonBottom.disabled =
        currentReviewPage === 1;


    nextPageButton.disabled =
        currentReviewPage === total;


    nextPageButtonBottom.disabled =
        currentReviewPage === total;


    /*
    Show page review state.
    */

    const pageData =
        bookState.pages.find(
            page =>
                page.pageNumber ===
                currentReviewPage
        );


    if (pageData) {

        if (pageData.noStoryText) {

            navigatorStatus.textContent =
                `Page ${currentReviewPage} is marked “No Story Text”.`;

        }
        else if (pageData.approved) {

            navigatorStatus.textContent =
                `✓ Page ${currentReviewPage} is approved.`;

        }
        else {

            navigatorStatus.textContent =
                `Page ${currentReviewPage} still needs review.`;

        }

    }


    if (scrollToTop) {

        const navigator =
            document.getElementById(
                "reviewNavigator"
            );


        if (navigator) {

            navigator.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        }

    }
}


/*
--------------------------------------------------
MOVE TO NEXT/PREVIOUS PAGE
--------------------------------------------------
*/

function goToNextPage() {

    if (
        currentReviewPage <
        bookState.pages.length
    ) {

        showReviewPage(
            currentReviewPage + 1
        );

    }
}


function goToPreviousPage() {

    if (
        currentReviewPage > 1
    ) {

        showReviewPage(
            currentReviewPage - 1
        );

    }
}


/*
--------------------------------------------------
FIND NEXT PAGE NEEDING REVIEW
--------------------------------------------------
*/

function findNextUnreviewedPage(
    startAfterCurrent = true
) {

    const total =
        bookState.pages.length;


    if (!total) {
        return null;
    }


    /*
    First search forward from current page.
    */

    const start =
        startAfterCurrent
            ? currentReviewPage
            : currentReviewPage - 1;


    for (
        let i = start;
        i < total;
        i++
    ) {

        const page =
            bookState.pages[i];


        if (
            !page.approved &&
            !page.noStoryText
        ) {

            return page.pageNumber;

        }

    }


    /*
    If none are ahead, wrap around and
    search from the beginning.
    */

    for (
        let i = 0;
        i < start;
        i++
    ) {

        const page =
            bookState.pages[i];


        if (
            !page.approved &&
            !page.noStoryText
        ) {

            return page.pageNumber;

        }

    }


    return null;
}


/*
--------------------------------------------------
AUTO-ADVANCE AFTER APPROVAL
--------------------------------------------------
*/

function advanceAfterReview(
    reviewedPageNumber
) {

    /*
    Prefer the next sequential page if it
    still needs review.
    */

    const nextSequential =
        bookState.pages.find(
            page =>
                page.pageNumber ===
                reviewedPageNumber + 1
        );


    if (
        nextSequential &&
        !nextSequential.approved &&
        !nextSequential.noStoryText
    ) {

        showReviewPage(
            nextSequential.pageNumber
        );

        return;
    }


    /*
    Otherwise locate the next unfinished page.
    */

    const nextUnreviewed =
        findNextUnreviewedPage(
            true
        );


    if (nextUnreviewed !== null) {

        showReviewPage(
            nextUnreviewed
        );

        return;
    }


    /*
    Everything has been reviewed.
    */

    navigatorStatus.textContent =
        "🎉 Every page has been reviewed.";

}


/*
--------------------------------------------------
NAVIGATOR BUTTON EVENTS
--------------------------------------------------
*/

previousPageButton.addEventListener(
    "click",
    goToPreviousPage
);


previousPageButtonBottom.addEventListener(
    "click",
    goToPreviousPage
);


nextPageButton.addEventListener(
    "click",
    goToNextPage
);


nextPageButtonBottom.addEventListener(
    "click",
    goToNextPage
);


jumpPageButton.addEventListener(
    "click",
    () => {

        const requested =
            Number(
                jumpPageInput.value
            );


        if (
            Number.isInteger(requested) &&
            requested >= 1 &&
            requested <= bookState.pages.length
        ) {

            showReviewPage(
                requested
            );

        } else {

            alert(
                `Enter a page number between 1 and ${bookState.pages.length}.`
            );

        }

    }
);


jumpPageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            jumpPageButton.click();

        }

    }
);


nextUnreviewedButton.addEventListener(
    "click",
    () => {

        const pageNumber =
            findNextUnreviewedPage(
                true
            );


        if (pageNumber === null) {

            navigatorStatus.textContent =
                "🎉 Every page has been reviewed.";

            return;
        }


        showReviewPage(
            pageNumber
        );

    }
);


/*
==================================================
BOOK APPROVAL
==================================================
*/

function saveApprovedBook() {

    const approvedBook = {

        fileName:
            bookState.fileName,

        approvedAt:
            new Date().toISOString(),

        pages:
            bookState.pages.map(
                page => ({

                    pageNumber:
                        page.pageNumber,

                    text:
                        page.noStoryText
                            ? ""
                            : page.text,

                    noStoryText:
                        page.noStoryText,

                    rotation:
                        page.rotation

                })
            )

    };


    localStorage.setItem(
        APPROVED_BOOK_KEY,
        JSON.stringify(approvedBook)
    );


    return approvedBook;
}


/*
==================================================
APPROVAL SUMMARY
==================================================
*/

function updateApprovalSummary() {

    const reviewed =
        bookState.pages.filter(
            page =>
                page.approved ||
                page.noStoryText
        ).length;


    const total =
        bookState.pages.length;


    approvedCount.textContent =
        reviewed;


    totalReviewPages.textContent =
        total;


    if (!total) {

        approveBookButton.disabled =
            true;

        return;
    }


    if (reviewed === total) {

        approveBookButton.disabled =
            false;


        bookApprovalMessage.textContent =
            "All pages have been reviewed. " +
            "You can now approve the book.";

    } else {

        approveBookButton.disabled =
            true;


        const remaining =
            total - reviewed;


        bookApprovalMessage.textContent =
            `${remaining} page${remaining === 1 ? "" : "s"} still need review.`;

    }
}


/*
==================================================
REFRESH PAGE STATE
==================================================
*/

function refreshPageCard(
    pageNumber
) {

    const pageData =
        bookState.pages.find(
            page =>
                page.pageNumber === pageNumber
        );


    const card =
        document.querySelector(
            `[data-page-card="${pageNumber}"]`
        );


    if (
        !pageData ||
        !card
    ) {
        return;
    }


    card.classList.remove(
        "page-approved",
        "page-no-text"
    );


    const stateLabel =
        card.querySelector(
            ".page-state"
        );


    const approveButton =
        card.querySelector(
            ".approve-button"
        );


    const noTextButton =
        card.querySelector(
            ".no-text-button"
        );


    const textarea =
        card.querySelector(
            "textarea"
        );


    const rotationStatus =
        card.querySelector(
            ".rotation-status"
        );


    if (rotationStatus) {

        rotationStatus.textContent =
            pageData.rotation === 0
                ? "Orientation: Original"
                : `Orientation: Rotated ${pageData.rotation}°`;

    }


    if (pageData.noStoryText) {

        card.classList.add(
            "page-no-text"
        );


        stateLabel.textContent =
            "No story text";


        approveButton.textContent =
            "✓ Approve Page";


        approveButton.classList.remove(
            "approved"
        );


        noTextButton.textContent =
            "↩ Restore Story Text";


        textarea.disabled =
            true;

    }
    else if (pageData.approved) {

        card.classList.add(
            "page-approved"
        );


        stateLabel.textContent =
            "✓ Approved";


        approveButton.textContent =
            "✓ Page Approved";


        approveButton.classList.add(
            "approved"
        );


        noTextButton.textContent =
            "No Story Text";


        textarea.disabled =
            false;

    }
    else {

        stateLabel.textContent =
            "Needs review";


        approveButton.textContent =
            "✓ Approve Page";


        approveButton.classList.remove(
            "approved"
        );


        noTextButton.textContent =
            "No Story Text";


        textarea.disabled =
            false;

    }


    updateApprovalSummary();
}


/*
==================================================
RENDER REVIEW IMAGE
==================================================
*/

async function refreshPageImage(
    pageData
) {

    if (!currentPDF) {
        return;
    }


    const card =
        document.querySelector(
            `[data-page-card="${pageData.pageNumber}"]`
        );


    if (!card) {
        return;
    }


    const holder =
        card.querySelector(
            ".page-image-holder"
        );


    if (!holder) {
        return;
    }


    const pdfPage =
        await currentPDF.getPage(
            pageData.pageNumber
        );


    const canvas =
        await renderPage(
            pdfPage,
            1.1,
            pageData.rotation
        );


    holder.innerHTML =
        "";


    holder.appendChild(
        canvas
    );
}


/*
==================================================
OCR ONE PAGE AGAIN
==================================================
*/

async function rerunOCR(
    pageData
) {

    if (!currentPDF) {
        return;
    }


    const card =
        document.querySelector(
            `[data-page-card="${pageData.pageNumber}"]`
        );


    const working =
        card.querySelector(
            ".rotation-working"
        );


    const textarea =
        card.querySelector(
            "textarea"
        );


    try {

        working.classList.remove(
            "hidden"
        );


        working.textContent =
            "🔍 Re-reading this page...";


        const pdfPage =
            await currentPDF.getPage(
                pageData.pageNumber
            );


        /*
        Render the OCR image in the selected
        orientation.
        */

        const ocrCanvas =
            await renderPage(
                pdfPage,
                2.4,
                pageData.rotation
            );


        const newText =
            await recognizePage(

                ocrCanvas,

                pageData.pageNumber,

                currentPDF.numPages,

                message => {

                    working.textContent =
                        "🔍 " + message;

                }

            );


        ocrCanvas.width =
            1;


        ocrCanvas.height =
            1;


        /*
        Replace the old bad OCR with OCR from
        the correctly oriented page.
        */

        pageData.text =
            newText;


        pageData.extractionMethod =
            "Scanned Page OCR";


        pageData.approved =
            false;


        pageData.noStoryText =
            false;


        textarea.value =
            newText;


        saveReviewState();


        refreshPageCard(
            pageData.pageNumber
        );


        working.textContent =
            "✓ Page re-read successfully";


        setTimeout(
            () => {

                working.classList.add(
                    "hidden"
                );

            },
            1800
        );

    }
    catch (error) {

        console.error(
            error
        );


        working.textContent =
            "Could not re-read this page.";

    }
}


/*
==================================================
ROTATE PAGE
==================================================
*/

async function rotatePage(
    pageData,
    amount
) {

    pageData.rotation =
        normalizeRotation(
            pageData.rotation + amount
        );


    /*
    Any orientation change invalidates
    previous approval.
    */

    pageData.approved =
        false;


    pageData.noStoryText =
        false;


    saveReviewState();


    refreshPageCard(
        pageData.pageNumber
    );


    /*
    Immediately rotate the parent-visible image.
    */

    await refreshPageImage(
        pageData
    );


    /*
    Then OCR the correctly oriented page again.
    */

    await rerunOCR(
        pageData
    );
}


/*
==================================================
CREATE REVIEW PAGE
==================================================
*/

async function createReviewPage(
    pdfPage,
    pageData
) {

    const review =
        document.createElement(
            "div"
        );


    review.className =
        "page-review";


    review.dataset.pageCard =
        pageData.pageNumber;


    /*
    LEFT SIDE
    */

    const imageSide =
        document.createElement(
            "div"
        );


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        `PDF Page ${pageData.pageNumber}`;


    imageSide.appendChild(
        title
    );


    const method =
        document.createElement(
            "div"
        );


    method.className =
        "page-status";


    method.textContent =
        `Extraction: ${pageData.extractionMethod}`;


    imageSide.appendChild(
        method
    );


    /*
    PAGE IMAGE HOLDER
    */

    const imageHolder =
        document.createElement(
            "div"
        );


    imageHolder.className =
        "page-image-holder";


    const displayCanvas =
        await renderPage(
            pdfPage,
            1.1,
            pageData.rotation
        );


    imageHolder.appendChild(
        displayCanvas
    );


    imageSide.appendChild(
        imageHolder
    );


    /*
    ORIENTATION CONTROLS
    */

    const orientationPanel =
        document.createElement(
            "div"
        );


    orientationPanel.className =
        "orientation-panel";


    const orientationTitle =
        document.createElement(
            "div"
        );


    orientationTitle.className =
        "orientation-title";


    orientationTitle.textContent =
        "Page upside-down or sideways?";


    orientationPanel.appendChild(
        orientationTitle
    );


    const orientationControls =
        document.createElement(
            "div"
        );


    orientationControls.className =
        "orientation-controls";


    const rotateLeft =
        document.createElement(
            "button"
        );


    rotateLeft.className =
        "rotate-button";


    rotateLeft.textContent =
        "↶ Rotate Left";


    rotateLeft.addEventListener(
        "click",
        async () => {

            rotateLeft.disabled =
                true;


            rotateRight.disabled =
                true;


            await rotatePage(
                pageData,
                -90
            );


            rotateLeft.disabled =
                false;


            rotateRight.disabled =
                false;

        }
    );


    const rotateRight =
        document.createElement(
            "button"
        );


    rotateRight.className =
        "rotate-button";


    rotateRight.textContent =
        "↷ Rotate Right";


    rotateRight.addEventListener(
        "click",
        async () => {

            rotateLeft.disabled =
                true;


            rotateRight.disabled =
                true;


            await rotatePage(
                pageData,
                90
            );


            rotateLeft.disabled =
                false;


            rotateRight.disabled =
                false;

        }
    );


    orientationControls.appendChild(
        rotateLeft
    );


    orientationControls.appendChild(
        rotateRight
    );


    orientationPanel.appendChild(
        orientationControls
    );


    const rotationStatus =
        document.createElement(
            "div"
        );


    rotationStatus.className =
        "rotation-status";


    orientationPanel.appendChild(
        rotationStatus
    );


    const working =
        document.createElement(
            "div"
        );


    working.className =
        "rotation-working hidden";


    orientationPanel.appendChild(
        working
    );


    imageSide.appendChild(
        orientationPanel
    );


    /*
    RIGHT SIDE
    */

    const textSide =
        document.createElement(
            "div"
        );


    const textTitle =
        document.createElement(
            "h3"
        );


    textTitle.textContent =
        "Extracted Story Text";


    textSide.appendChild(
        textTitle
    );


    const stateLabel =
        document.createElement(
            "div"
        );


    stateLabel.className =
        "page-state";


    textSide.appendChild(
        stateLabel
    );


    const textarea =
        document.createElement(
            "textarea"
        );


    textarea.value =
        pageData.text;


    textarea.dataset.page =
        pageData.pageNumber;


    textarea.addEventListener(
        "input",
        () => {

            pageData.text =
                textarea.value;


            if (pageData.approved) {

                pageData.approved =
                    false;

            }


            saveReviewState();


            refreshPageCard(
                pageData.pageNumber
            );

        }
    );


    textSide.appendChild(
        textarea
    );


    /*
    APPROVAL CONTROLS
    */

    const actions =
        document.createElement(
            "div"
        );


    actions.className =
        "page-actions";


    const approveButton =
        document.createElement(
            "button"
        );


    approveButton.className =
        "approve-button";


approveButton.addEventListener(
    "click",
    () => {

        pageData.noStoryText =
            false;


        /*
        If already approved, clicking again
        returns it to Needs Review.
        */

        if (pageData.approved) {

            pageData.approved =
                false;


            saveReviewState();


            refreshPageCard(
                pageData.pageNumber
            );


            showReviewPage(
                pageData.pageNumber,
                false
            );


            return;
        }


        /*
        Approve page.
        */

        pageData.approved =
            true;


        saveReviewState();


        refreshPageCard(
            pageData.pageNumber
        );


        /*
        Automatically move to next page
        needing attention.
        */

        setTimeout(
            () => {

                advanceAfterReview(
                    pageData.pageNumber
                );

            },
            250
        );

    }
);


    const noTextButton =
        document.createElement(
            "button"
        );


    noTextButton.className =
        "no-text-button";


noTextButton.addEventListener(
    "click",
    () => {

        /*
        Restore page if it had previously
        been marked No Story Text.
        */

        if (pageData.noStoryText) {

            pageData.noStoryText =
                false;


            pageData.approved =
                false;


            saveReviewState();


            refreshPageCard(
                pageData.pageNumber
            );


            showReviewPage(
                pageData.pageNumber,
                false
            );


            return;
        }


        /*
        Mark page as containing no story text.
        */

        pageData.noStoryText =
            true;


        pageData.approved =
            false;


        saveReviewState();


        refreshPageCard(
            pageData.pageNumber
        );


        setTimeout(
            () => {

                advanceAfterReview(
                    pageData.pageNumber
                );

            },
            250
        );

    }
);


    actions.appendChild(
        approveButton
    );


    actions.appendChild(
        noTextButton
    );


    textSide.appendChild(
        actions
    );


    const helper =
        document.createElement(
            "div"
        );


    helper.className =
        "helper-text";


    helper.textContent =
        "If the page is rotated, fix its orientation first. " +
        "The application will automatically OCR it again. " +
        "Then correct any remaining OCR mistakes and approve the page.";


    textSide.appendChild(
        helper
    );


    review.appendChild(
        imageSide
    );


    review.appendChild(
        textSide
    );


    pagesContainer.appendChild(
        review
    );


    refreshPageCard(
        pageData.pageNumber
    );
}


/*
==================================================
PROCESS PDF
==================================================
*/

processButton.addEventListener(
    "click",

    async () => {

        errorBox.classList.add(
            "hidden"
        );


        const file =
            pdfFile.files[0];


        if (!file) {

            showError(
                "Please choose a PDF first."
            );

            return;
        }


        try {

            processButton.disabled =
                true;


            processingCard.classList.remove(
                "hidden"
            );


            reviewCard.classList.add(
                "hidden"
            );


            bookReadyBox.classList.add(
                "hidden"
            );


            storyPreview.classList.add(
                "hidden"
            );


            pagesContainer.innerHTML =
                "";


            bookState = {

                fileName:
                    file.name,

                pages:
                    []

            };


            /*
            Open and retain PDF.
            */

            currentPDF =
                await openPDF(
                    file
                );


            const totalPages =
                currentPDF.numPages;


            fileInfo.textContent =
                `${file.name} — ${totalPages} pages`;


            for (
                let pageNumber = 1;
                pageNumber <= totalPages;
                pageNumber++
            ) {

                updateProgress(

                    pageNumber - 1,

                    totalPages,

                    `Preparing page ${pageNumber} of ${totalPages}...`

                );


                const pdfPage =
                    await currentPDF.getPage(
                        pageNumber
                    );


                let extractedText =
                    await extractEmbeddedText(
                        pdfPage
                    );


                let extractionMethod =
                    "Embedded PDF Text";


                /*
                Initial orientation is 0°.
                Manual orientation correction can
                be performed during review.
                */

                const rotation =
                    0;


                if (
                    extractedText.length < 40
                ) {

                    extractionMethod =
                        "Scanned Page OCR";


                    const ocrCanvas =
                        await renderPage(
                            pdfPage,
                            2.4,
                            rotation
                        );


                    extractedText =
                        await recognizePage(

                            ocrCanvas,

                            pageNumber,

                            totalPages,

                            message => {

                                statusText.textContent =
                                    message;

                            }

                        );


                    ocrCanvas.width =
                        1;


                    ocrCanvas.height =
                        1;

                }


                const pageData = {

                    pageNumber:
                        pageNumber,

                    text:
                        extractedText,

                    extractionMethod:
                        extractionMethod,

                    approved:
                        false,

                    noStoryText:
                        false,

                    rotation:
                        rotation

                };


                bookState.pages.push(
                    pageData
                );


                saveReviewState();


                await createReviewPage(
                    pdfPage,
                    pageData
                );


                updateProgress(

                    pageNumber,

                    totalPages,

                    `Finished page ${pageNumber} of ${totalPages}`

                );

            }


            statusText.textContent =
                "Book extraction complete.";


            progressBar.style.width =
                "100%";


            progressText.textContent =
                "100%";


            reviewCard.classList.remove(
                "hidden"
            );


updateApprovalSummary();


/*
Start parent review on Page 1.
Only one page is displayed at a time.
*/

currentReviewPage =
    1;


showReviewPage(
    1,
    false
);


reviewCard.scrollIntoView({
    behavior: "smooth"
});

        }


        catch (error) {

            console.error(
                error
            );


            processingCard.classList.add(
                "hidden"
            );


            showError(

                "The PDF could not be processed. " +
                "Technical message: " +
                error.message

            );

        }


        finally {

            processButton.disabled =
                false;

        }

    }
);


/*
==================================================
APPROVE BOOK
==================================================
*/

approveBookButton.addEventListener(
    "click",
    () => {

        const allReviewed =
            bookState.pages.every(
                page =>
                    page.approved ||
                    page.noStoryText
            );


        if (!allReviewed) {

            alert(
                "Please review every page first."
            );

            return;
        }


        saveApprovedBook();


        bookReadyBox.classList.remove(
            "hidden"
        );


        approveBookButton.disabled =
            true;


        bookApprovalMessage.textContent =
            "Book approved and saved.";

    }
);


/*
==================================================
PREVIEW CLEAN STORY
==================================================
*/

showStoryButton.addEventListener(
    "click",
    () => {

        const approvedBookJSON =
            localStorage.getItem(
                APPROVED_BOOK_KEY
            );


        if (!approvedBookJSON) {

            alert(
                "No approved book was found."
            );

            return;
        }


        const approvedBook =
            JSON.parse(
                approvedBookJSON
            );


        const story =
            approvedBook.pages

                .filter(
                    page =>
                        !page.noStoryText &&
                        page.text.trim()
                )

                .map(
                    page =>
                        page.text.trim()
                )

                .join("\n\n");


        cleanStoryText.textContent =
            story;


        storyPreview.classList.remove(
            "hidden"
        );


        storyPreview.scrollIntoView({
            behavior: "smooth"
        });

    }
);

/*
==================================================
VERSION 1.7 — EXPORT CLEAN BOOK
==================================================
*/

downloadPDFButton.addEventListener(
    "click",
    () => {

        try {

            exportStatus.classList.remove(
                "hidden"
            );

            exportStatus.textContent =
                "Creating clean text PDF...";


            const result =
                exportCleanTextPDF(
                    bookState
                );


            exportStatus.textContent =
                `✓ Clean text PDF created with ${result.pageCount} pages.`;

        }
        catch (error) {

            console.error(error);

            exportStatus.classList.remove(
                "hidden"
            );

            exportStatus.textContent =
                "Could not create PDF: " +
                error.message;
        }

    }
);


downloadJSONButton.addEventListener(
    "click",
    () => {

        try {

            exportStatus.classList.remove(
                "hidden"
            );

            exportStatus.textContent =
                "Creating book data file...";


            const data =
                exportBookData(
                    bookState
                );


            exportStatus.textContent =
                `✓ Book data saved — ${data.sourcePageCount} source pages preserved.`;

        }
        catch (error) {

            console.error(error);

            exportStatus.classList.remove(
                "hidden"
            );

            exportStatus.textContent =
                "Could not create book data: " +
                error.message;
        }

    }
);