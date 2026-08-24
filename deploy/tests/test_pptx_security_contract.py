import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[2]


class PptxSecurityContractTest(unittest.TestCase):
    def test_controlled_png_and_text_generate_a_valid_pptx(self):
        program = textwrap.dedent(
            """
            import assert from 'node:assert/strict'
            import PptxGenJS from 'pptxgenjs'

            const pptx = new PptxGenJS()
            const slide = pptx.addSlide()
            slide.addText('WARP security smoke', { x: 0.5, y: 0.5, w: 3, h: 0.5 })
            slide.addImage({
              data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
              x: 0.5, y: 1.2, w: 0.2, h: 0.2,
            })
            const output = await pptx.write({ outputType: 'nodebuffer' })
            const buffer = Buffer.from(output)
            assert.equal(buffer.subarray(0, 2).toString(), 'PK')
            assert.ok(buffer.length > 1000)
            """
        )
        result = subprocess.run(
            ["node", "--input-type=module", "-e", program],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
