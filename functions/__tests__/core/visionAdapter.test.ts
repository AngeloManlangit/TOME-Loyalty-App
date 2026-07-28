import {
  makeSimpleReceipt,
  makeTwoColumnReceipt,
  makeVisionResponse,
} from '../../__fixtures__/synth/makeVisionResponse';
import { visionToOcrDocument } from '../../src/receipts/core/visionAdapter';

describe('visionToOcrDocument', () => {
  describe('empty and degenerate input', () => {
    it('returns an empty document when Vision found no text at all', () => {
      const doc = visionToOcrDocument({});
      expect(doc.lines).toEqual([]);
      expect(doc.words).toEqual([]);
      expect(doc.text).toBe('');
      expect(doc.meanConfidence).toBe(0);
    });

    it('returns an empty document for an explicitly null fullTextAnnotation', () => {
      const doc = visionToOcrDocument({ fullTextAnnotation: null });
      expect(doc.lines).toEqual([]);
      expect(doc.meanConfidence).toBe(0);
    });

    it('tolerates a page with no blocks', () => {
      const doc = visionToOcrDocument({ fullTextAnnotation: { pages: [{ blocks: [] }] } });
      expect(doc.lines).toEqual([]);
    });

    it('tolerates blocks with no paragraphs and paragraphs with no words', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: { pages: [{ blocks: [{ paragraphs: [{ words: [] }, {}] }, {}] }] },
      });
      expect(doc.lines).toEqual([]);
    });

    it('tolerates a page with no blocks key at all', () => {
      const doc = visionToOcrDocument({ fullTextAnnotation: { pages: [{}] } });
      expect(doc.lines).toEqual([]);
    });

    it('tolerates a word with no symbols key at all', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: { pages: [{ blocks: [{ paragraphs: [{ words: [{}] }] }] }] },
      });
      expect(doc.lines).toEqual([]);
    });

    it('skips symbols whose text is null while keeping the rest of the word', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          symbols: [{ text: 'A' }, { text: null }, { text: 'B' }],
                          boundingBox: { vertices: [{ x: 0, y: 0 }, { x: 20, y: 10 }] },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(doc.lines[0]!.text).toBe('AB');
    });

    it('drops words whose symbols carry no readable text', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [{ blocks: [{ paragraphs: [{ words: [{ symbols: [{ text: '  ' }] }] }] }] }],
        },
      });
      expect(doc.lines).toEqual([]);
    });
  });

  describe('single column', () => {
    it('reconstructs lines in reading order', () => {
      const doc = visionToOcrDocument(
        makeSimpleReceipt(['OUTLETS MALL', 'INVOICE NO 12345', 'TOTAL 500.00']),
      );

      expect(doc.lines.map((l) => l.text)).toEqual([
        'OUTLETS MALL',
        'INVOICE NO 12345',
        'TOTAL 500.00',
      ]);
      expect(doc.text).toBe('OUTLETS MALL\nINVOICE NO 12345\nTOTAL 500.00');
    });

    it('assigns sequential line indices top to bottom', () => {
      const doc = visionToOcrDocument(makeSimpleReceipt(['A', 'B', 'C']));
      expect(doc.lines.map((l) => l.index)).toEqual([0, 1, 2]);
    });

    it('uppercases and collapses whitespace in line text', () => {
      const doc = visionToOcrDocument(makeSimpleReceipt(['invoice   no']));
      expect(doc.lines[0]!.text).toBe('INVOICE NO');
    });
  });

  describe('two-column receipts — the case the adapter exists for', () => {
    it('reunites label and value that Vision split into SEPARATE BLOCKS', () => {
      // per-column strategy puts every label in one block and every value in another, which is what
      // Vision really does. Relying on fullTextAnnotation.text newlines here would give you
      // "ACCN" and "116-000123456789" as unrelated lines.
      const response = makeTwoColumnReceipt([
        ['ACCN', '116-000123456789'],
        ['INVOICE NO', 'SI-004512'],
        ['DATE', '07/28/2026'],
      ]);

      const doc = visionToOcrDocument(response);

      expect(doc.lines.map((l) => l.text)).toEqual([
        'ACCN 116-000123456789',
        'INVOICE NO SI-004512',
        'DATE 07/28/2026',
      ]);
    });

    it('proves the fixture really did split the columns across blocks', () => {
      const response = makeTwoColumnReceipt([['ACCN', '116-000123456789']]);
      const blocks = response.fullTextAnnotation!.pages![0]!.blocks!;
      expect(blocks).toHaveLength(2);

      // ...and Vision's own flat text keeps them apart, which is exactly the trap.
      expect(response.fullTextAnnotation!.text).toBe('ACCN\n116-000123456789');
    });

    it('orders merged words left to right regardless of block order', () => {
      const response = makeVisionResponse({
        blockStrategy: 'per-column',
        rows: [
          {
            y: 100,
            cells: [
              { text: 'RIGHT', x: 500 },
              { text: 'LEFT', x: 50 },
            ],
          },
        ],
      });

      expect(visionToOcrDocument(response).lines[0]!.text).toBe('LEFT RIGHT');
    });
  });

  describe('skew', () => {
    // `skew: n` drifts a word down by n pixels per 100px of x, i.e. atan(n/100) of rotation.
    // 4 -> ~2.3 degrees, 10 -> ~5.7, 20 -> ~11.3.
    it.each([
      [4, '~2.3 degrees'],
      [10, '~5.7 degrees'],
      [20, '~11.3 degrees'],
    ])('still groups a row skewed by %s (%s) into one line', (skew) => {
      const response = makeTwoColumnReceipt(
        [
          ['ACCN', '116-000123456789'],
          ['INVOICE NO', 'SI-004512'],
          ['DATE', '07/28/2026'],
          ['TOTAL', '1250.00'],
        ],
        { skew },
      );

      const doc = visionToOcrDocument(response);
      expect(doc.lines.map((l) => l.text)).toEqual([
        'ACCN 116-000123456789',
        'INVOICE NO SI-004512',
        'DATE 07/28/2026',
        'TOTAL 1250.00',
      ]);
    });

    it('keeps a word with no geometry even on a skewed page', () => {
      // Deskewing cannot place a word Vision gave no box for, but dropping it would lose text that
      // might be the invoice number itself.
      const response = makeVisionResponse({
        skew: 20,
        rows: [
          { y: 100, cells: [{ text: 'ACCN', x: 50 }, { text: '116-000123456789', x: 400 }] },
          { y: 140, cells: [{ text: 'INVOICE NO', x: 50 }, { text: 'SI-004512', x: 400 }] },
          { y: 180, cells: [{ text: 'DATE', x: 50 }, { text: '07/28/2026', x: 400 }] },
          { y: 220, cells: [{ text: 'ORPHAN-VALUE', x: 400, noGeometry: true }] },
        ],
      });

      expect(visionToOcrDocument(response).text).toContain('ORPHAN-VALUE');
    });

    it('emits TRUE page geometry, not deskewed coordinates', () => {
      // Deskewing is an internal device for grouping. A consumer asking where a word is on the page
      // must get the real answer.
      const straight = visionToOcrDocument(makeTwoColumnReceipt([['ACCN', '123456']]));
      const skewed = visionToOcrDocument(
        makeTwoColumnReceipt(
          [
            ['ACCN', '123456'],
            ['INVOICE NO', 'SI-1'],
            ['DATE', '07/28/2026'],
          ],
          { skew: 20 },
        ),
      );

      expect(skewed.lines[0]!.box.y0).toBeGreaterThan(straight.lines[0]!.box.y0);
    });

    it('does NOT merge rows that are genuinely separate', () => {
      const doc = visionToOcrDocument(
        makeSimpleReceipt(['LINE ONE', 'LINE TWO', 'LINE THREE']),
      );
      expect(doc.lines).toHaveLength(3);
    });
  });

  describe('missing geometry', () => {
    it('keeps the text of a word Vision gave no bounding box', () => {
      const response = makeVisionResponse({
        rows: [
          { y: 100, cells: [{ text: 'INVOICE NO', x: 50 }] },
          { y: 130, cells: [{ text: 'SI-004512', x: 50, noGeometry: true }] },
        ],
      });

      const doc = visionToOcrDocument(response);
      expect(doc.text).toContain('SI-004512');
    });

    it('falls back to the hull of symbol boxes when the word box is absent', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          // no word-level boundingBox
                          symbols: [
                            { text: 'A', boundingBox: { vertices: [{ x: 10, y: 20 }, { x: 20, y: 40 }] } },
                            { text: 'B', boundingBox: { vertices: [{ x: 20, y: 20 }, { x: 30, y: 40 }] } },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(doc.lines[0]!.text).toBe('AB');
      expect(doc.lines[0]!.box).toEqual({ x0: 10, y0: 20, x1: 30, y1: 40 });
    });

    it('treats a poly with no vertices as absent geometry', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    { words: [{ symbols: [{ text: 'X' }], boundingBox: { vertices: [] } }] },
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(doc.lines[0]!.text).toBe('X');
    });

    it('defaults an omitted vertex coordinate to 0 (protobuf elides zero values)', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        { symbols: [{ text: 'Z' }], boundingBox: { vertices: [{ y: 10 }, { x: 40, y: 30 }] } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(doc.lines[0]!.box).toEqual({ x0: 0, y0: 10, x1: 40, y1: 30 });
    });
  });

  describe('confidence', () => {
    it('averages word confidences across the document', () => {
      const response = makeVisionResponse({
        rows: [
          { y: 100, cells: [{ text: 'AA', x: 50, confidence: 0.6 }] },
          { y: 130, cells: [{ text: 'BB', x: 50, confidence: 1.0 }] },
        ],
      });
      expect(visionToOcrDocument(response).meanConfidence).toBeCloseTo(0.8, 5);
    });

    it('substitutes 0 for unknown confidence rather than assuming the read was good', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [{ blocks: [{ paragraphs: [{ words: [{ symbols: [{ text: 'Q' }] }] }] }] }],
        },
      });
      expect(doc.meanConfidence).toBe(0);
    });

    it('falls back to the mean of symbol confidences when the word has none', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        { symbols: [{ text: 'A', confidence: 0.4 }, { text: 'B', confidence: 0.8 }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      expect(doc.lines[0]!.confidence).toBeCloseTo(0.6, 5);
    });
  });

  describe('detectedBreak handling', () => {
    it('accepts numeric protobuf enum break types', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          symbols: [
                            { text: 'A', property: { detectedBreak: { type: 5 } } }, // LINE_BREAK
                          ],
                          boundingBox: { vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
                        },
                        {
                          symbols: [{ text: 'B' }],
                          boundingBox: { vertices: [{ x: 0, y: 100 }, { x: 10, y: 110 }] },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(doc.lines.map((l) => l.text)).toEqual(['A', 'B']);
    });

    it('ignores an unrecognised numeric break type', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          symbols: [{ text: 'A', property: { detectedBreak: { type: 99 } } }],
                          boundingBox: { vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
                        },
                        {
                          symbols: [{ text: 'B' }],
                          boundingBox: { vertices: [{ x: 20, y: 0 }, { x: 30, y: 10 }] },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(doc.lines.map((l) => l.text)).toEqual(['A B']);
    });

    it('falls back to a word-level detectedBreak when the symbol has none', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          symbols: [{ text: 'A' }],
                          property: { detectedBreak: { type: 'LINE_BREAK' } },
                          boundingBox: { vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
                        },
                        {
                          symbols: [{ text: 'B' }],
                          boundingBox: { vertices: [{ x: 0, y: 100 }, { x: 10, y: 110 }] },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(doc.lines.map((l) => l.text)).toEqual(['A', 'B']);
    });

    it('treats HYPHEN as a line-ending break', () => {
      const doc = visionToOcrDocument({
        fullTextAnnotation: {
          pages: [
            {
              blocks: [
                {
                  paragraphs: [
                    {
                      words: [
                        {
                          symbols: [{ text: 'A', property: { detectedBreak: { type: 'HYPHEN' } } }],
                          boundingBox: { vertices: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
                        },
                        {
                          symbols: [{ text: 'B' }],
                          boundingBox: { vertices: [{ x: 0, y: 100 }, { x: 10, y: 110 }] },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      expect(doc.lines.map((l) => l.text)).toEqual(['A', 'B']);
    });
  });

  it('exposes every word of the document in reading order', () => {
    const doc = visionToOcrDocument(makeSimpleReceipt(['ONE TWO', 'THREE']));
    expect(doc.words.map((w) => w.text)).toEqual(['ONE', 'TWO', 'THREE']);
  });
});
