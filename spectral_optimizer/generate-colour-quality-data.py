import json
from pathlib import Path

import colour
from colour import SpectralShape
from colour.colorimetry import SDS_BASIS_FUNCTIONS_CIE_ILLUMINANT_D_SERIES
from colour.quality import SDS_TCS
from colour.quality.cfi2017 import load_TCS_CIE2017

SHAPE = SpectralShape(380, 780, 5)


def values(distribution):
    return distribution.copy().align(SHAPE).values.tolist()


cmf2 = colour.MSDS_CMFS["CIE 1931 2 Degree Standard Observer"].copy().align(SHAPE)
cmf10 = colour.MSDS_CMFS["CIE 1964 10 Degree Standard Observer"].copy().align(SHAPE)
ces = load_TCS_CIE2017(SHAPE)

data = {
    "wavelengths": SHAPE.wavelengths.tolist(),
    "cmf2": cmf2.values.T.tolist(),
    "cmf10": cmf10.values.T.tolist(),
    "tcs14": [values(distribution) for distribution in SDS_TCS.values()],
    "ces99": ces.values.T.tolist(),
    "daylightBasis": {
        name.lower(): values(distribution)
        for name, distribution in SDS_BASIS_FUNCTIONS_CIE_ILLUMINANT_D_SERIES.items()
    },
    "d65": values(colour.SDS_ILLUMINANTS["D65"]),
}

payload = json.dumps(data, separators=(",", ":"), ensure_ascii=True)
output = (
    "/* Generated from CIE open datasets through Colour Science 0.4.4. "
    "Do not edit manually. */\n"
    "(function(root,factory){const data=factory();"
    "if(typeof module==='object'&&module.exports)module.exports=data;"
    "root.CIE_COLOUR_QUALITY_DATA=data;})(typeof globalThis!=='undefined'?globalThis:this,"
    f"function(){{return {payload};}});\n"
)

Path(__file__).with_name("colour-quality-data.js").write_text(output, encoding="utf-8")
