// A self-contained ArUco marker SVG generator for DICT_MIP_36h12 dictionary.
// Since the dictionary is fixed, we list the hex code words here.

const MIP_36h12_CODES = [
  0xd2b63a09d, 0x6001134e5, 0x1206fbe72, 0xff8ad6cb4, 0x85da9bc49, 0xb461afe9c, 0x6db51fe13, 0x5248c541f, 0x8f34503, 0x8ea462ece,
  0xeac2be76d, 0x1af615c44, 0xb48a49f27, 0x2e4e1283b, 0x78b1f2fa8, 0x27d34f57e, 0x89222fff1, 0x4c1669406, 0xbf49b3511, 0xdc191cd5d,
  0x11d7c3f85, 0x16a130e35, 0xe29f27eff, 0x428d8ae0c, 0x90d548477, 0x2319cbc93, 0xc3b0c3dfc, 0x424bccc9, 0x2a081d630, 0x762743d96,
  0xd0645bf19, 0xf38d7fd60, 0xc6cbf9a10, 0x3c1be7c65, 0x276f75e63, 0x4490a3f63, 0xda60acd52, 0x3cc68df59, 0xab46f9dae, 0x88d533d78,
  0xb6d62ec21, 0xb3c02b646, 0x22e56d408, 0xac5f5770a, 0xaaa993f66, 0x4caa07c8d, 0x5c9b4f7b0, 0xaa9ef0e05, 0x705c5750, 0xac81f545e,
  0x735b91e74, 0x8cc35cee4, 0xe44694d04, 0xb5e121de0, 0x261017d0f, 0xf1d439eb5, 0xa1a33ac96, 0x174c62c02, 0x1ee27f716, 0x8b1c5ece9,
  0x6a05b0c6a, 0xd0568dfc, 0x192d25e5f, 0x1adbeccc8, 0xcfec87f00, 0xd0b9dde7a, 0x88dcef81e, 0x445681cb9, 0xdbb2ffc83, 0xa48d96df1,
  0xb72cc2e7d, 0xc295b53f, 0xf49832704, 0x9968edc29, 0x9e4e1af85, 0x8683e2d1b, 0x810b45c04, 0x6ac44bfe2, 0x645346615, 0x3990bd598,
  0x1c9ed0f6a, 0xc26729d65, 0x83993f795, 0x3ac05ac5d, 0x357adff3b, 0xd5c05565, 0x2f547ef44, 0x86c115041, 0x640fd9e5f, 0xce08bbcf7,
  0x109bb343e, 0xc21435c92, 0x35b4dfce4, 0x459752cf2, 0xec915b82c, 0x51881eed0, 0x2dda7dc97, 0x2e0142144, 0x42e890f99, 0x9a8856527
];

function hex2bin(hexVal, nBits) {
  let bin = hexVal.toString(2);
  while (bin.length < nBits) {
    bin = '0' + bin;
  }
  return bin;
}

export function getArucoGrid(id) {
  const codeVal = MIP_36h12_CODES[id];
  if (codeVal === undefined) return null;

  const code = hex2bin(codeVal, 36);
  const innerSize = 6;
  const totalSize = 8;
  const grid = [];

  for (let r = 0; r < totalSize; r++) {
    const row = [];
    for (let c = 0; c < totalSize; c++) {
      if (r === 0 || r === totalSize - 1 || c === 0 || c === totalSize - 1) {
        row.push(0); // Black outer border
      } else {
        const r_inner = r - 1;
        const c_inner = c - 1;
        const bitIndex = r_inner * innerSize + c_inner;
        row.push(code[bitIndex] === '1' ? 1 : 0);
      }
    }
    grid.push(row);
  }
  return grid;
}
