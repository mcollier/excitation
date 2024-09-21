import { BoundingRegion, DocumentIntelligenceResponse } from "./Types";

// Rounds a number to the given precision
const round = (value: number, precision = 0) => {
    const multiplier = Math.pow(10, precision);
    return Math.round(value * multiplier) / multiplier;
}

// Return true if polygons overlap (ncluding sharing borders); false otherwise
const adjacent = (poly0: number[], poly1: number[]) => {
    const x0 = [round(poly0[0], 1), round(poly0[2], 1)];
    const y0 = [round(poly0[1], 1), round(poly0[5], 1)];

    const x1 = [round(poly1[0], 1), round(poly1[2], 1)];
    const y1 = [round(poly1[1], 1), round(poly1[5], 1)];

    // The rectangles don't overlap if one rectangle's minimum in some
    // dimension is greater than the other's maximum in that dimension
    const noOverlap = x0[0] > x1[1] ||
        x1[0] > x0[1] ||
        y0[0] > y1[1] ||
        y1[0] > y0[1];
    return !noOverlap;
}

// from x(x0, x1) and y(y0, y1) create an 8 value polygon
const polygonize = (x: number[], y: number[]) => {
    return [
        x[0], y[0],
        x[1], y[0],
        x[1], y[1],
        x[0], y[1]
    ]
}

// Combine two squared up polygons and return the combination
// if the two polygons are NOT adjacent you will get weird results!!!
const combinePolygons = (poly0: number[], poly1: number[]) => {
    const x = [
        Math.min(poly0[0], poly1[0]),
        Math.max(poly0[2], poly1[2])
    ];
    const y = [
        Math.min(poly0[1], poly1[1]),
        Math.max(poly0[5], poly1[5])
    ]
    return polygonize(x, y);
}

// Return a polygon with sides that are parallel to the major axes
const squareUp = (poly: number[]) => {
    const x = [
        Math.min(poly[0], poly[6]),
        Math.max(poly[2], poly[4])
    ];
    const y = [
        Math.min(poly[1], poly[3]),
        Math.max(poly[5], poly[7])
    ];
    return polygonize(x, y);
}

// return the given boundingRegions combined into the minimum possible
// number of boundingRegions
export const condenseRegions = (boundingRegions: BoundingRegion[]) => {
    if (boundingRegions.length === 0) return boundingRegions;

    const condensedRegions: BoundingRegion[] = [
        {
            pageNumber: boundingRegions[0].pageNumber,
            polygon: squareUp(boundingRegions[0].polygon)
        }
    ]

    let last = condensedRegions.length - 1;
    for (let index = 1; index < boundingRegions.length; index++) {
        boundingRegions[index].polygon = squareUp(boundingRegions[index].polygon);

        if (condensedRegions[last].pageNumber === boundingRegions[index].pageNumber) {
            if (adjacent(condensedRegions[last].polygon, boundingRegions[index].polygon)) {
                // adding to existing polygon
                condensedRegions[last].polygon = combinePolygons(condensedRegions[last].polygon, boundingRegions[index].polygon);
            } else {
                // New column or similar
                condensedRegions.push(boundingRegions[index]);
                last++;
            }
        } else {
            // new page
            condensedRegions.push(boundingRegions[index]);
            last++;
        }
    }
    return condensedRegions;
}

// creates a polygon on provided canvas using provided scale and polygon data
export const drawPolygon = (context: CanvasRenderingContext2D, scale: number = 1, polygon: number[]): void => {
    const multiplier = 72 * (window.devicePixelRatio || 1) * scale;
    context.fillStyle = 'rgba(252, 207, 8, 0.3)';
    context.strokeStyle = '#fccf08';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(polygon[0] * multiplier, polygon[1] * multiplier);
    for (let i = 2; i < polygon.length; i += 2) {
        context.lineTo(polygon[i] * multiplier, polygon[i + 1] * multiplier);
    }
    context.closePath();
    context.fill();
    context.stroke();
};

// Match a subline to a line if at least 75% of its words/word fragments
// are found in the line, used for creating a reference from selection.
const fuzzyMatch = (line: string, subline: string, threshold = 0.6) => {
    const words = subline.split(' ');
    let wordsMatched = 0;

    for (let i = 0; i < words.length; i++) {
        if (line.includes(words[i])) wordsMatched++;
    }

    const matchRate = wordsMatched / words.length;
    if (matchRate >= threshold) {
        console.log("matched DocInt line:\t", line,
            "\nto OCR subline:\t\t", subline,
            "\nwith match rate:", matchRate);
        return true;
    } if (matchRate > 0.4) {
        console.log("did not match DocInt line:\t", line,
            "\nto OCR subline:\t\t", subline,
            "\nwith match rate:", matchRate);
    }
    else return false;
};

const findTextBoundingRegions = (text: string[], response: DocumentIntelligenceResponse) => {
    let nextLine = 0;

    const pages = response.analyzeResult.pages;
    const boundingRegions: BoundingRegion[] = [];

    for (let i = 0; i < pages.length; i++) {
        const pageLines = pages[i].lines;
        for (let j = 0; j < pageLines.length; j++) {
            if (fuzzyMatch(pageLines[j].content, text[nextLine])) {
                boundingRegions.push({
                    pageNumber: i + 1,
                    polygon: pageLines[j].polygon,
                });
                nextLine++;
                if (nextLine == text.length) return boundingRegions;
            }
        }
    }
    console.log("Failed to find all lines in document")
    return boundingRegions;
}

export const returnTextPolygonsFromDI = (text: string, response: DocumentIntelligenceResponse) => {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) lines[i] = lines[i].trim();
    const foundBoundingRegions = findTextBoundingRegions(lines, response);
    const boundingRegions = condenseRegions(foundBoundingRegions);
    if (boundingRegions.length === 0) {
        console.log("No match found for selected text");
        return;
    }
    return boundingRegions;
    // what happens if we don't find any bounding regions?
    // The question exists, the reference exists, the document exists, Document Intelligence just didn't do its job
}

import { Doc, Citation } from "./Types";

export function locateCitations(docs: Doc[], citations: Citation[][]) {
  return citations.map(questionCitations => questionCitations.map(citation => ({
    ... citation,
    boundingRegions: returnTextPolygonsFromDI(citation.excerpt, docs[citation.docIndex].response!),
  })));
}