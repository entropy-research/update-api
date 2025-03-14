/*
Should download the version JSON file from the VSCodium repo
the JSON file should conform to this schema:
{
  "url": "<url to release download>",
  "name": "1.33.1", // the version number
  "version": "51b0b28134d51361cf996d2f0a1c698247aeabd8", // the latest commit hash
  "productVersion": "1.33.1", // the version number
  "hash": "cb4109f196d23b9d1e8646ce43145c5bb62f55a8", // sha1 of the release download
  "timestamp": 1554971059007,
  "sha256hash": "ac2a1c8772501732cd5ff539a04bb4dc566b58b8528609d2b34bbf970d08cf01" // sha256 of the release download
}
The hashes can be ignored by this api/lambda -- we are only concerned with whether
the commit hash in the url parameter matches the "version" identifier in the above payload
*/


const { parse } = require('url')
const got = require('got')

const INSIDER = 'insider'
const STABLE = 'stable'

const DARWIN = 'darwin'
const WINDOWS = 'win32'
const LINUX = 'linux'

const ARM64 = 'arm64'
const IA32 = 'ia32'
const X64 = 'x64'

const SYSTEM = 'system'
const ARCHIVE = 'archive'
const MSI = 'msi'
const USER = 'user'

const QUALITIES = new Set([INSIDER, STABLE])
const OS = new Set([DARWIN, LINUX, WINDOWS])
const TYPES = new Set([ARCHIVE, MSI, USER, SYSTEM])
const ARCH = new Set([ARM64, IA32, X64])

const VERSION_BASE_URL = 'https://raw.githubusercontent.com/entropy-research/versions/master'

async function getJSON ({ quality, os, arch, type }) {
  // get os/arch/type specific JSON file from a repo where these files are stored
  let versionUrl = `${VERSION_BASE_URL}/${quality}/${os}/${arch}`

  if (type) versionUrl += `/${type}`

  try {
    console.log(`${versionUrl}/latest.json`);
    const response = await got(`${versionUrl}/latest.json`)
    console.log(response.body);
    if (!response.body) return null
    return response.body
  } catch (e) {
    console.log(e.message);
    return null
  }
}

// returns false if invalid, or an object of os, arch, type if valid
function validateInput (platform, quality) {
  // a bunch of validation rules for the different permutations
  if (!QUALITIES.has(quality)) return false

  let [os, arch, type] = platform.split('-')
  if (!OS.has(os)) return false

  if (os === WINDOWS) {
    if (!type) {
      if (!arch) {
        type = SYSTEM
        arch = IA32
      } else if (TYPES.has(arch)) {
        type = arch
        arch = IA32
      } else {
        type = SYSTEM
      }
    } 

    if (!TYPES.has(type)) return false
  } else if (os === DARWIN) {
     if (!arch) arch = X64
  }

  if (!ARCH.has(arch)) return false

  return { quality, os, arch, type }
}

module.exports = async (req, res) => {
  const { query } = parse(req.url, true)
  const { platform, quality, commit } = query
  const input = validateInput(platform, quality)
  if (!input) {
    res.writeHead(404)
    res.end()
    return
  }

  console.log(platform, quality, commit)

  const latest = await getJSON(input)
  console.log(latest)

  // vercel supports cache-control header; we can use this to cut down on cost
  // currently set to cache for 4hrs
  // res.setHeader('cache-control', 's-maxage=14400')
  // if (!latest || commit === latest.version) {
  //   res.writeHead(204)
  //   res.end()
  //   return
  // }
  res.setHeader('Content-Type', 'application/json')
  res.write(latest)
  res.end()
}
